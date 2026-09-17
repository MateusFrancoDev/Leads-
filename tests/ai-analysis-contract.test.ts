import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isAppError } from "@/lib/errors";
import { opportunityFromScore, parseAnalysis } from "@/server/ai/analysis-contract";

/** Resposta bem comportada; cada teste estraga só o campo que estuda. */
const valid = {
  score: 82,
  opportunity: "high",
  scoreReason: "Empresa com telefone público e nenhum site conhecido.",
  summary: "Empresa com bom potencial comercial.",
  problems: ["Nenhum site próprio informado."],
  opportunities: ["Criar presença própria."],
  recommendedServices: ["Site institucional"],
  salesApproach: "Perguntar como recebe contatos hoje.",
  confidence: 0.91,
};

describe("Contrato da análise por IA", () => {
  test("resposta válida vira o formato interno", () => {
    const analysis = parseAnalysis(valid);
    assert.equal(analysis.score, 82);
    assert.equal(analysis.opportunity, "HIGH");
    assert.deepEqual(analysis.services, ["Site institucional"]);
    assert.equal(analysis.approach, "Perguntar como recebe contatos hoje.");
  });

  test("JSON sem os campos obrigatórios é recusado", () => {
    assert.throws(
      () => parseAnalysis({ summary: "só isso" }),
      (error: unknown) => isAppError(error) && error.code === "PROVIDER_ERROR",
    );
  });

  test("resposta que não é objeto é recusada", () => {
    assert.throws(() => parseAnalysis("texto solto"));
    assert.throws(() => parseAnalysis(null));
  });

  test("a faixa vem do score, não do rótulo que o modelo escreveu", () => {
    // O modelo diz "high" com nota 12: o número manda.
    const analysis = parseAnalysis({ ...valid, score: 12, opportunity: "high" });
    assert.equal(analysis.opportunity, "LOW");
  });

  test("listas longas demais são cortadas", () => {
    const analysis = parseAnalysis({
      ...valid,
      problems: Array.from({ length: 12 }, (_, index) => `Problema ${index}`),
    });
    assert.equal(analysis.problems.length, 5);
  });

  test("score fora da faixa não passa", () => {
    assert.throws(() => parseAnalysis({ ...valid, score: 140 }));
    assert.throws(() => parseAnalysis({ ...valid, confidence: 7 }));
  });

  test("as faixas de oportunidade seguem o score", () => {
    assert.equal(opportunityFromScore(92), "HIGH");
    assert.equal(opportunityFromScore(70), "HIGH");
    assert.equal(opportunityFromScore(67), "MEDIUM");
    assert.equal(opportunityFromScore(40), "MEDIUM");
    assert.equal(opportunityFromScore(31), "LOW");
  });
});
