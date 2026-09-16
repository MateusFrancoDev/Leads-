import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildLocationUrl, buildOsmElementUrl, isValidCoordinate, parseOsmExternalId } from "@/lib/leads/location";
import { detectSocialPlatform, extractDomain, normalizeSocialProfileUrl, normalizeUrl } from "@/lib/normalize";

describe("URLs", () => {
  test("normalizeUrl aceita só http(s)", () => {
    assert.equal(normalizeUrl("clinicabella.com.br"), "https://clinicabella.com.br");
    assert.equal(normalizeUrl("http://clinicabella.com.br/"), "http://clinicabella.com.br");
    assert.equal(normalizeUrl("ftp://clinicabella.com.br"), null);
    assert.equal(normalizeUrl("file:///etc/passwd"), null);
    assert.equal(normalizeUrl("javascript:alert(1)"), null);
    assert.equal(normalizeUrl("não é url"), null);
  });

  test("domínio sem www", () => {
    assert.equal(extractDomain("https://www.Clinica.com.br/contato"), "clinica.com.br");
  });

  test("redes sociais não contam como site", () => {
    assert.equal(detectSocialPlatform("https://instagram.com/clinicabella"), "instagram");
    assert.equal(detectSocialPlatform("https://clinicabella.com.br"), null);
  });

  test("perfil social só a partir do que foi informado", () => {
    assert.equal(normalizeSocialProfileUrl("instagram", "@clinicabella"), "https://www.instagram.com/clinicabella");
    assert.equal(
      normalizeSocialProfileUrl("instagram", "https://www.instagram.com/clinicabella/?hl=pt"),
      "https://www.instagram.com/clinicabella",
    );
    // Post, compartilhamento e outra rede não são perfis.
    assert.equal(normalizeSocialProfileUrl("instagram", "https://instagram.com/p/Cx123"), null);
    assert.equal(normalizeSocialProfileUrl("facebook", "https://facebook.com/sharer/sharer.php?u=x"), null);
    assert.equal(normalizeSocialProfileUrl("instagram", "https://facebook.com/clinicabella"), null);
    assert.equal(
      normalizeSocialProfileUrl("linkedin", "https://www.linkedin.com/company/clinica-bella/about"),
      "https://www.linkedin.com/company/clinica-bella",
    );
    assert.equal(normalizeSocialProfileUrl("instagram", null), null);
  });

  test("coordenadas validadas antes de gerar link de localização", () => {
    assert.equal(isValidCoordinate(-23.53, -46.79), true);
    assert.equal(isValidCoordinate(0, 0), false);
    assert.equal(isValidCoordinate(91, 10), false);
    assert.equal(isValidCoordinate(Number.NaN, 10), false);
    assert.equal(
      buildLocationUrl(-23.532, -46.7917),
      "https://www.openstreetmap.org/?mlat=-23.532000&mlon=-46.791700#map=19/-23.532000/-46.791700",
    );
    assert.equal(buildLocationUrl(null, -46.79), null);
    assert.equal(buildLocationUrl(200, 0), null);
  });

  test("ids e links do OpenStreetMap", () => {
    assert.deepEqual(parseOsmExternalId("way/123"), { type: "way", id: "123" });
    assert.equal(parseOsmExternalId("place/123"), null);
    assert.equal(parseOsmExternalId("node/abc"), null);
    assert.equal(buildOsmElementUrl("relation/42"), "https://www.openstreetmap.org/relation/42");
    assert.equal(buildOsmElementUrl("mock_1"), null);
  });
});
