import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  decodeCloudflareEmail,
  extractContacts,
  extractWhatsappNumber,
} from "@/lib/leads/enrichment/contact-extractor";
import { applyWebsiteCrawl, crawlWebsite } from "@/lib/leads/enrichment/website-crawler";
import type { SafeFetchResult } from "@/lib/leads/enrichment/safe-fetch";
import { makeLead } from "./helpers";

const PAGE = `
<html><head><title>Clínica Bella</title>
<script>var fake = "tracking@sentry.io";</script></head>
<body>
  <a href="mailto:Contato@ClinicaBella.com.br?subject=Oi">Fale conosco</a>
  <a href="tel:+551134567890">Ligue</a>
  <p>Atendimento: (11) 98765-4321 · CNPJ 12.345.678/0001-90 · CEP 06010-000</p>
  <a href="https://wa.me/5511998765432?text=Ola">WhatsApp</a>
  <a href="https://www.instagram.com/clinicabella/">Instagram</a>
  <a href="https://www.facebook.com/sharer/sharer.php?u=x">Compartilhar</a>
  <a href="https://facebook.com/clinicabellaosasco">Facebook</a>
  <a href="/contato">Contato</a>
  <a href="https://outrosite.com/contato">Parceiro</a>
  <img src="logo@2x.png">
  <span>financeiro&#64;clinicabella.com.br</span>
</body></html>`;

describe("extração de contatos do site", () => {
  const contacts = extractContacts(PAGE, "https://clinicabella.com.br/");

  test("e-mails de mailto e do texto, sem falsos positivos", () => {
    assert.deepEqual(contacts.emails, ["contato@clinicabella.com.br", "financeiro@clinicabella.com.br"]);
  });

  test("telefones de tel: e do texto; CNPJ e CEP ignorados", () => {
    assert.deepEqual(contacts.phones, ["551134567890", "5511987654321"]);
    assert.equal(contacts.hasMobilePhone, true);
  });

  test("WhatsApp confirmado por link wa.me", () => {
    assert.equal(contacts.hasWhatsappLink, true);
    assert.deepEqual(contacts.whatsappNumbers, ["5511998765432"]);
  });

  test("redes sociais: perfis reais, sem links de compartilhamento", () => {
    assert.equal(contacts.instagram, "https://www.instagram.com/clinicabella");
    assert.equal(contacts.facebook, "https://www.facebook.com/clinicabellaosasco");
    assert.equal(contacts.linkedin, null);
  });

  test("páginas de contato só do próprio site", () => {
    assert.deepEqual(contacts.contactPageLinks, ["https://clinicabella.com.br/contato"]);
  });

  test("página sem contatos devolve listas vazias e null", () => {
    const empty = extractContacts("<html><body><h1>Bem-vindo</h1></body></html>", "https://x.com.br/");
    assert.deepEqual(empty.emails, []);
    assert.deepEqual(empty.phones, []);
    assert.equal(empty.hasWhatsappLink, false);
    assert.equal(empty.instagram, null);
  });

  test("números de links do WhatsApp", () => {
    assert.equal(extractWhatsappNumber("https://api.whatsapp.com/send?phone=5511998765432&text=oi"), "5511998765432");
    assert.equal(extractWhatsappNumber("https://wa.me/message/ABCDEF"), null);
  });

  test("e-mail protegido pela Cloudflare é decodificado", () => {
    // "a@b.co" codificado com chave 0x42.
    const key = 0x42;
    const hex =
      key.toString(16) + [..."a@b.co"].map((char) => (char.charCodeAt(0) ^ key).toString(16).padStart(2, "0")).join("");
    assert.equal(decodeCloudflareEmail(hex), "a@b.co");
  });
});

function page(url: string, body: string, status = 200): SafeFetchResult {
  return { status, finalUrl: url, contentType: "text/html", body, truncated: false, redirects: 0 };
}

describe("crawler do site oficial", () => {
  test("lê a home e a página de contato, respeitando o máximo de páginas", async () => {
    const visited: string[] = [];
    const result = await crawlWebsite("https://clinica.com.br", {
      maxPages: 2,
      timeoutMs: 1000,
      maxBytes: 100_000,
      userAgent: "test",
      fetchPage: async (url) => {
        visited.push(url);
        if (url === "https://clinica.com.br") {
          return page(url, `<a href="/fale-conosco">Fale conosco</a><a href="https://instagram.com/clinica">ig</a>`);
        }
        return page(url, `<a href="mailto:oi@clinica.com.br">mail</a>`);
      },
    });

    assert.deepEqual(visited, ["https://clinica.com.br", "https://clinica.com.br/fale-conosco"]);
    assert.equal(result.status, "completed");
    assert.equal(result.email, "oi@clinica.com.br");
    assert.equal(result.instagram, "https://www.instagram.com/clinica");
    assert.equal(result.whatsappConfirmed, false);
  });

  test("site fora do ar: status failed e nenhum dado", async () => {
    const result = await crawlWebsite("https://fora.com.br", {
      maxPages: 3,
      timeoutMs: 1000,
      maxBytes: 1000,
      userAgent: "test",
      fetchPage: async () => {
        throw new Error("timeout");
      },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.email, null);
    assert.equal(result.phone, null);
  });

  test("aplicar leitura: preenche só vazios, marca origem e diferencia WhatsApp", () => {
    const lead = makeLead({
      website: "https://clinica.com.br",
      websiteStatus: "found",
      phone: "551134567890",
      phoneSource: "openstreetmap",
      enrichmentStatus: "pending",
    });
    const enriched = applyWebsiteCrawl(lead, {
      status: "completed",
      finalUrl: "https://clinica.com.br",
      pagesVisited: ["https://clinica.com.br"],
      email: "oi@clinica.com.br",
      phone: "5511987654321",
      hasMobilePhone: true,
      whatsappConfirmed: true,
      whatsapp: "5511987654321",
      instagram: null,
      facebook: null,
      linkedin: null,
    });
    assert.equal(enriched.phone, "551134567890");
    assert.equal(enriched.phoneSource, "openstreetmap");
    assert.equal(enriched.email, "oi@clinica.com.br");
    assert.equal(enriched.emailSource, "website");
    assert.equal(enriched.whatsappStatus, "confirmed");
    assert.equal(enriched.whatsappSource, "website");
    assert.equal(enriched.instagram, null);
    assert.equal(enriched.enrichmentStatus, "completed");
  });

  test("celular do site sem link de WhatsApp fica como possível", () => {
    const lead = makeLead({ website: "https://x.com.br", websiteStatus: "found" });
    const enriched = applyWebsiteCrawl(lead, {
      status: "completed",
      finalUrl: "https://x.com.br",
      pagesVisited: [],
      email: null,
      phone: "5511987654321",
      hasMobilePhone: true,
      whatsappConfirmed: false,
      whatsapp: null,
      instagram: null,
      facebook: null,
      linkedin: null,
    });
    assert.equal(enriched.whatsappStatus, "possible");
    assert.equal(enriched.whatsapp, null);
  });
});
