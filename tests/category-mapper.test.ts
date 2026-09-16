import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CATEGORY_RULES, labelFromTags, mapCategory, normalizeCategoryTerm } from "@/lib/leads/category-mapper";

describe("category mapper", () => {
  test("mapeia os nichos pedidos para etiquetas OSM", () => {
    const expectations: Array<[string, string, { key: string; value: string }]> = [
      ["barbearia", "barbearia", { key: "shop", value: "hairdresser" }],
      ["academia", "academia", { key: "leisure", value: "fitness_centre" }],
      ["restaurante", "restaurante", { key: "amenity", value: "restaurant" }],
      ["dentista", "dentista", { key: "amenity", value: "dentist" }],
      ["veterinário", "veterinario", { key: "amenity", value: "veterinary" }],
      ["farmácia", "farmacia", { key: "amenity", value: "pharmacy" }],
      ["ótica", "otica", { key: "shop", value: "optician" }],
      ["imobiliária", "imobiliaria", { key: "office", value: "estate_agent" }],
      ["contabilidade", "contabilidade", { key: "office", value: "accountant" }],
      ["advogado", "advogado", { key: "office", value: "lawyer" }],
      ["padaria", "padaria", { key: "shop", value: "bakery" }],
      ["cafeteria", "cafeteria", { key: "amenity", value: "cafe" }],
      ["pet shop", "pet-shop", { key: "shop", value: "pet" }],
      ["mercado", "mercado", { key: "shop", value: "supermarket" }],
    ];

    for (const [term, id, tag] of expectations) {
      const rule = mapCategory(term);
      assert.ok(rule, `"${term}" deveria ser reconhecido`);
      assert.equal(rule.id, id);
      assert.ok(
        rule.filters.some((filter) => filter.key === tag.key && filter.value === tag.value),
        `"${term}" deveria incluir ${tag.key}=${tag.value}`,
      );
    }
  });

  test("dentista usa amenity e healthcare", () => {
    const rule = mapCategory("dentista");
    const tags = rule?.filters.map((filter) => `${filter.key}=${filter.value}`);
    assert.deepEqual(tags, ["amenity=dentist", "healthcare=dentist"]);
  });

  test("sinônimos, acentos, caixa e plural apontam para a mesma regra", () => {
    for (const term of ["Barbearia", "BARBEARIAS", "barber", "barber shop", "Barbeiro"]) {
      assert.equal(mapCategory(term)?.id, "barbearia", term);
    }
    assert.equal(mapCategory("Salões de beleza")?.id, "salao-de-beleza");
    assert.equal(mapCategory("clínicas")?.id, "clinica");
  });

  test("o sinônimo mais específico vence", () => {
    assert.equal(mapCategory("clínica de estética")?.id, "clinica-de-estetica");
    assert.equal(mapCategory("clinica veterinaria")?.id, "veterinario");
    assert.equal(mapCategory("auto elétrica")?.id, "auto-eletrica");
    assert.equal(mapCategory("estética automotiva")?.id, "lava-rapido");
  });

  test("encontra o nicho dentro de uma frase, só por palavra inteira", () => {
    assert.equal(mapCategory("melhores pizzarias da zona norte")?.id, "pizzaria");
    // "bar" não pode casar dentro de "barbearia".
    assert.equal(mapCategory("barbearia")?.id, "barbearia");
  });

  test("termo desconhecido devolve null (busca cai no nome)", () => {
    assert.equal(mapCategory("fábrica de drones"), null);
    assert.equal(mapCategory("   "), null);
  });

  test("toda regra tem id único e ao menos um filtro", () => {
    const ids = CATEGORY_RULES.map((rule) => rule.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const rule of CATEGORY_RULES) assert.ok(rule.filters.length > 0, rule.id);
  });

  test("normaliza termos para comparação", () => {
    assert.equal(normalizeCategoryTerm("  Pet-Shops!! "), "pet shop");
  });

  test("rótulo a partir das etiquetas do elemento", () => {
    assert.equal(labelFromTags({ amenity: "dentist" }), "Dentista");
    assert.equal(labelFromTags({ shop: "unknown_thing" }), null);
  });
});
