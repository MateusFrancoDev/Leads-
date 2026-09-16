import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { formatPhone, isBrazilianMobile, normalizeBrazilianPhone, whatsappLink } from "@/lib/normalize";

describe("normalizeBrazilianPhone", () => {
  test("aceita os formatos comuns de celular", () => {
    for (const raw of ["+55 (11) 98765-4321", "11987654321", "(11) 9 8765-4321", "5511987654321", "011 98765-4321"]) {
      const phone = normalizeBrazilianPhone(raw);
      assert.ok(phone, raw);
      assert.equal(phone.digits, "5511987654321", raw);
      assert.equal(phone.isMobile, true, raw);
    }
  });

  test("reconhece telefone fixo", () => {
    const phone = normalizeBrazilianPhone("(11) 3456-7890");
    assert.equal(phone?.digits, "551134567890");
    assert.equal(phone?.isMobile, false);
  });

  test("remove código de operadora e ramal", () => {
    assert.equal(normalizeBrazilianPhone("0 21 11 3456-7890")?.digits, "551134567890");
    assert.equal(normalizeBrazilianPhone("(11) 3456-7890 ramal 22")?.digits, "551134567890");
  });

  test("números não geográficos", () => {
    const phone = normalizeBrazilianPhone("0800 123 4567");
    assert.equal(phone?.digits, "08001234567");
    assert.equal(phone?.isNonGeographic, true);
    assert.equal(whatsappLink("08001234567"), null);
  });

  test("não completa número incompleto nem inválido", () => {
    // Celular antigo sem o nono dígito: adicionar o 9 seria inventar.
    assert.equal(normalizeBrazilianPhone("(11) 8765-4321"), null);
    // Sem DDD.
    assert.equal(normalizeBrazilianPhone("3456-7890"), null);
    // DDD inexistente.
    assert.equal(normalizeBrazilianPhone("(20) 3456-7890"), null);
    assert.equal(normalizeBrazilianPhone("+1 415 555 0100"), null);
    assert.equal(normalizeBrazilianPhone(""), null);
    assert.equal(normalizeBrazilianPhone(null), null);
  });

  test("celular é só possibilidade de WhatsApp", () => {
    assert.equal(isBrazilianMobile("11987654321"), true);
    assert.equal(isBrazilianMobile("1134567890"), false);
  });

  test("formata para exibição", () => {
    assert.equal(formatPhone("5511987654321"), "(11) 98765-4321");
    assert.equal(formatPhone("551134567890"), "(11) 3456-7890");
    assert.equal(formatPhone("08001234567"), "0800 123 4567");
  });
});
