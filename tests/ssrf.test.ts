import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";
import { assertUrlAllowed, isPublicIpAddress, safeFetch, SafeFetchError } from "@/lib/leads/enrichment/safe-fetch";

function expectBlocked(url: string, code: SafeFetchError["code"]) {
  assert.throws(
    () => assertUrlAllowed(url),
    (error: unknown) => error instanceof SafeFetchError && error.code === code,
    url,
  );
}

describe("proteção contra SSRF", () => {
  test("endereços privados, loopback e reservados são bloqueados", () => {
    for (const ip of [
      "127.0.0.1",
      "0.0.0.0",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.0.10",
      "169.254.169.254",
      "100.64.0.1",
      "::1",
      "::",
      "fe80::1",
      "fd00::1",
      "::ffff:127.0.0.1",
      "::ffff:a00:1",
    ]) {
      assert.equal(isPublicIpAddress(ip), false, ip);
    }
  });

  test("endereços públicos são permitidos", () => {
    for (const ip of ["8.8.8.8", "172.32.0.1", "200.147.67.142", "2606:4700:4700::1111"]) {
      assert.equal(isPublicIpAddress(ip), true, ip);
    }
  });

  test("URLs perigosas são recusadas antes de qualquer conexão", () => {
    expectBlocked("file:///etc/passwd", "BLOCKED_PROTOCOL");
    expectBlocked("ftp://example.com/", "BLOCKED_PROTOCOL");
    expectBlocked("http://localhost/", "BLOCKED_HOST");
    expectBlocked("http://api.localhost/", "BLOCKED_HOST");
    expectBlocked("http://intranet/", "BLOCKED_HOST");
    expectBlocked("http://127.0.0.1/", "BLOCKED_ADDRESS");
    expectBlocked("http://[::1]/", "BLOCKED_ADDRESS");
    expectBlocked("http://169.254.169.254/latest/meta-data", "BLOCKED_ADDRESS");
    // Formas alternativas de escrever 127.0.0.1 são normalizadas pelo parser de URL.
    expectBlocked("http://2130706433/", "BLOCKED_ADDRESS");
    expectBlocked("http://0x7f.0.0.1/", "BLOCKED_ADDRESS");
    expectBlocked("http://user:pass@example.com/", "INVALID_URL");
    expectBlocked("http://example.com:22/", "BLOCKED_PORT");
    assert.equal(assertUrlAllowed("https://example.com/").hostname, "example.com");
  });

  test("domínio público que resolve para IP interno é bloqueado na conexão", async () => {
    await assert.rejects(
      safeFetch("http://rebind.example.com/", {
        timeoutMs: 2000,
        maxBytes: 1000,
        userAgent: "test",
        resolveHost: async () => [{ address: "10.0.0.5", family: 4 }],
      }),
      (error: unknown) => error instanceof SafeFetchError && error.code === "BLOCKED_ADDRESS",
    );
  });
});

describe("safeFetch com servidor local", () => {
  let server: Server;
  let port: number;
  const TEST_HOST = "site-teste.example.com";

  // O servidor de teste roda em 127.0.0.1: só ele é liberado, e só nos testes.
  const options = () => ({
    timeoutMs: 1000,
    maxBytes: 64,
    maxRedirects: 2,
    userAgent: "test",
    allowedPorts: "any" as const,
    resolveHost: async () => [{ address: "127.0.0.1", family: 4 }],
    isAllowedAddress: (ip: string) => ip === "127.0.0.1" || isPublicIpAddress(ip),
  });

  before(async () => {
    server = createServer((request, response) => {
      if (request.url === "/redirect-private") {
        response.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data" });
        response.end();
        return;
      }
      if (request.url === "/redirect-loop") {
        response.writeHead(302, { Location: "/redirect-loop" });
        response.end();
        return;
      }
      if (request.url === "/slow") {
        setTimeout(() => response.end("tarde"), 3000);
        return;
      }
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end("<html>" + "x".repeat(500) + "</html>");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });

  after(() => {
    server.closeAllConnections();
    server.close();
  });

  test("corta a resposta no tamanho máximo", async () => {
    const result = await safeFetch(`http://${TEST_HOST}:${port}/`, options());
    assert.equal(result.status, 200);
    assert.equal(result.truncated, true);
    assert.ok(Buffer.byteLength(result.body) <= 64);
  });

  test("redirect para IP privado é bloqueado", async () => {
    await assert.rejects(
      safeFetch(`http://${TEST_HOST}:${port}/redirect-private`, options()),
      (error: unknown) => error instanceof SafeFetchError && error.code === "BLOCKED_ADDRESS",
    );
  });

  test("limite de redirects", async () => {
    await assert.rejects(
      safeFetch(`http://${TEST_HOST}:${port}/redirect-loop`, options()),
      (error: unknown) => error instanceof SafeFetchError && error.code === "TOO_MANY_REDIRECTS",
    );
  });

  test("timeout", async () => {
    await assert.rejects(
      safeFetch(`http://${TEST_HOST}:${port}/slow`, { ...options(), timeoutMs: 200 }),
      (error: unknown) => error instanceof SafeFetchError && error.code === "TIMEOUT",
    );
  });

  test("sem liberação explícita, o próprio localhost é recusado", async () => {
    await assert.rejects(
      safeFetch(`http://127.0.0.1:${port}/`, { timeoutMs: 1000, maxBytes: 100, userAgent: "test", allowedPorts: "any" }),
      (error: unknown) => error instanceof SafeFetchError && error.code === "BLOCKED_ADDRESS",
    );
  });
});
