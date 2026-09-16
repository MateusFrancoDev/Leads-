import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { LEAD_SCORE_CONFIG } from "@/lib/config/lead-score";
import { calculateLeadScore, type LeadScoreInput } from "@/lib/leads/lead-score";

const base: LeadScoreInput = {
  websiteStatus: "HAS_WEBSITE",
  whatsappStatus: "UNKNOWN",
  phone: null,
  email: null,
  instagram: null,
  facebook: null,
  street: null,
  number: null,
  city: null,
};

const { weights } = LEAD_SCORE_CONFIG;

describe("Lead Score", () => {
  test("empresa sem nenhum sinal fica em 0", () => {
    const result = calculateLeadScore(base);
    assert.equal(result.score, 0);
    assert.equal(result.level, "LOW");
    assert.deepEqual(result.reasons, []);
  });

  test("site não informado vale menos que ausência comprovada", () => {
    const notProvided = calculateLeadScore({ ...base, websiteStatus: "NOT_PROVIDED" }).score;
    const confirmed = calculateLeadScore({ ...base, websiteStatus: "NO_WEBSITE" }).score;
    const unknown = calculateLeadScore({ ...base, websiteStatus: "UNKNOWN" }).score;
    assert.equal(notProvided, weights.websiteNotProvided);
    assert.equal(confirmed, weights.websiteConfirmedMissing);
    assert.ok(notProvided < confirmed);
    assert.equal(unknown, 0);
  });

  test("WhatsApp confirmado vale mais que possível", () => {
    const confirmed = calculateLeadScore({ ...base, whatsappStatus: "CONFIRMED" }).score;
    const possible = calculateLeadScore({ ...base, whatsappStatus: "POSSIBLE" }).score;
    assert.equal(confirmed, weights.confirmedWhatsapp);
    assert.equal(possible, weights.possibleWhatsapp);
  });

  test("perfil interessante: endereço, telefone, Instagram e site não informado", () => {
    const result = calculateLeadScore({
      ...base,
      websiteStatus: "NOT_PROVIDED",
      whatsappStatus: "POSSIBLE",
      phone: "5511987654321",
      instagram: "https://www.instagram.com/x",
      street: "Rua A",
      number: "10",
      city: "Osasco",
    });
    const expected =
      weights.websiteNotProvided +
      weights.possibleWhatsapp +
      weights.phone +
      weights.instagram +
      weights.fullAddress +
      weights.socialPresenceWithoutWebsite;
    assert.equal(result.score, expected);
    assert.equal(result.level, "HIGH");
    assert.ok(result.reasons.some((reason) => reason.includes("não confirmado")));
  });

  test("presença social só soma sem site conhecido", () => {
    const withSite = calculateLeadScore({ ...base, instagram: "x" }).score;
    assert.equal(withSite, weights.instagram);
  });

  test("score nunca passa de 100", () => {
    const result = calculateLeadScore({
      ...base,
      websiteStatus: "NO_WEBSITE",
      whatsappStatus: "CONFIRMED",
      phone: "x",
      email: "x",
      instagram: "x",
      facebook: "x",
      street: "x",
      number: "1",
      city: "x",
      websiteHasHttps: false,
    });
    assert.ok(result.score <= 100);
  });
});
