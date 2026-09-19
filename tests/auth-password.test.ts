import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { hashPassword, verifyPassword } from "@/server/auth/password";

describe("hash de senha", () => {
  test("aceita a senha correta e recusa a errada", async () => {
    const hash = await hashPassword("senha-de-teste-123");
    assert.equal(await verifyPassword("senha-de-teste-123", hash), true);
    assert.equal(await verifyPassword("senha-de-teste-124", hash), false);
    assert.equal(await verifyPassword("", hash), false);
  });

  test("dois hashes da mesma senha são diferentes (sal aleatório)", async () => {
    const [first, second] = await Promise.all([hashPassword("mesma-senha-1"), hashPassword("mesma-senha-1")]);
    assert.notEqual(first, second);
    assert.equal(await verifyPassword("mesma-senha-1", first), true);
    assert.equal(await verifyPassword("mesma-senha-1", second), true);
  });

  test("grava os parâmetros do KDF junto do hash", async () => {
    const parts = (await hashPassword("qualquer-senha-1")).split("$");
    assert.equal(parts.length, 6);
    assert.equal(parts[0], "scrypt");
    assert.ok(Number(parts[1]) >= 16_384, "custo N precisa ser alto");
  });

  test("hash malformado devolve false em vez de lançar", async () => {
    for (const stored of ["", "x", "scrypt$1", "bcrypt$1$2$3$4$5", "scrypt$a$b$c$d$e"]) {
      assert.equal(await verifyPassword("qualquer", stored), false, stored);
    }
  });
});
