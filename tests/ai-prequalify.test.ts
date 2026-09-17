import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  rankForAiAnalysis,
  shouldAnalyzeWithAI,
  type AiPrequalifyInput,
} from "@/lib/leads/ai-prequalify";

/** Lead mínimo: nome e nada mais. Cada teste acrescenta só o sinal que estuda. */
const base: AiPrequalifyInput = {
  name: "Clínica Teste",
  category: null,
  phone: null,
  email: null,
  instagram: null,
  whatsappStatus: "UNKNOWN",
  website: null,
  websiteStatus: "UNKNOWN",
  city: null,
  state: null,
  score: 0,
};

describe("Pré-qualificação para IA", () => {
  test("registro sem nome utilizável nunca vale uma chamada", () => {
    const result = shouldAnalyzeWithAI({ ...base, name: " " });
    assert.equal(result.analyze, false);
    assert.equal(result.skipReason, "invalid-record");
  });

  test("sem telefone, e-mail, Instagram e site é descartado", () => {
    const result = shouldAnalyzeWithAI({ ...base, category: "Odontologia", city: "Osasco" });
    assert.equal(result.analyze, false);
    assert.equal(result.skipReason, "no-contact");
  });

  test("um contato solto, sem mais nenhum dado, ainda é pouco", () => {
    const result = shouldAnalyzeWithAI({ ...base, phone: "11999999999" });
    assert.equal(result.analyze, false);
    assert.equal(result.skipReason, "not-enough-data");
  });

  test("empresa sem site conhecido, com telefone e segmento, é analisada", () => {
    const result = shouldAnalyzeWithAI({
      ...base,
      phone: "11999999999",
      category: "Odontologia",
      city: "Osasco",
      state: "SP",
      websiteStatus: "NOT_PROVIDED",
    });
    assert.equal(result.analyze, true);
    assert.ok(result.priority > 50);
  });

  test("sem site conhecido tem prioridade maior que com site, tudo mais igual", () => {
    const comum = {
      ...base,
      phone: "11999999999",
      category: "Odontologia",
      city: "Osasco",
      state: "SP",
    };
    const semSite = shouldAnalyzeWithAI({ ...comum, websiteStatus: "NOT_PROVIDED" });
    const comSite = shouldAnalyzeWithAI({
      ...comum,
      website: "https://exemplo.com.br",
      websiteStatus: "HAS_WEBSITE",
    });

    assert.equal(semSite.analyze, true);
    assert.equal(comSite.analyze, true);
    // "Sem site" é oportunidade de vender site, não sinal de lead ruim.
    assert.ok(semSite.priority > comSite.priority);
  });

  test("site cadastrado com problema também vale analisar", () => {
    const result = shouldAnalyzeWithAI({
      ...base,
      phone: "11999999999",
      category: "Odontologia",
      websiteStatus: "UNREACHABLE_WEBSITE",
    });
    assert.equal(result.analyze, true);
  });

  test("a fila do lote sai ordenada e sem os descartados", () => {
    const fraco = { ...base, id: "fraco", name: "Sem contato", category: "Odontologia" };
    const medio = {
      ...base,
      name: "Com site",
      category: "Odontologia",
      phone: "1133333333",
      website: "https://exemplo.com.br",
      websiteStatus: "HAS_WEBSITE" as const,
    };
    const forte = {
      ...base,
      name: "Sem site",
      category: "Odontologia",
      city: "Osasco",
      state: "SP",
      phone: "1144444444",
      whatsappStatus: "CONFIRMED" as const,
      websiteStatus: "NOT_PROVIDED" as const,
    };

    const ranked = rankForAiAnalysis([fraco, medio, forte]);
    assert.deepEqual(
      ranked.map((entry) => entry.lead.name),
      ["Sem site", "Com site"],
    );
  });
});
