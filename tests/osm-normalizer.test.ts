import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { normalizeOsmElement, type OsmNormalizationContext } from "@/lib/leads/normalizers/osm";

const context: OsmNormalizationContext = {
  categoryLabel: "Barbearia",
  area: { city: "Osasco", state: "SP", isMunicipalBoundary: true },
};

describe("normalização de elementos do OpenStreetMap", () => {
  test("elemento completo vira LeadResult com origem de cada dado", () => {
    const lead = normalizeOsmElement(
      {
        type: "node",
        id: 123456789,
        lat: -23.532,
        lon: -46.7917,
        tags: {
          name: "Barbearia do João",
          shop: "hairdresser",
          "addr:street": "Rua Antônio Agú",
          "addr:housenumber": "100",
          "addr:suburb": "Centro",
          "addr:postcode": "06013000",
          phone: "+55 11 3456-7890",
          "contact:mobile": "+55 11 98765-4321",
          website: "https://barbeariadojoao.com.br",
          "contact:instagram": "barbeariadojoao",
          email: "contato@barbeariadojoao.com.br",
          opening_hours: "Mo-Sa 09:00-19:00",
          note: "descartado",
        },
      },
      context,
    );

    assert.ok(lead);
    assert.equal(lead.externalId, "node/123456789");
    assert.equal(lead.source, "openstreetmap");
    assert.equal(lead.osmUrl, "https://www.openstreetmap.org/node/123456789");
    assert.equal(lead.address, "Rua Antônio Agú, 100");
    assert.equal(lead.street, "Rua Antônio Agú");
    assert.equal(lead.number, "100");
    assert.equal(lead.neighborhood, "Centro");
    assert.equal(lead.city, "Osasco");
    assert.equal(lead.state, "SP");
    assert.equal(lead.postalCode, "06013-000");
    assert.equal(lead.phone, "551134567890");
    assert.equal(lead.phoneSource, "openstreetmap");
    assert.equal(lead.website, "https://barbeariadojoao.com.br");
    assert.equal(lead.websiteStatus, "found");
    assert.equal(lead.websiteSource, "openstreetmap");
    assert.equal(lead.instagram, "https://www.instagram.com/barbeariadojoao");
    assert.equal(lead.email, "contato@barbeariadojoao.com.br");
    assert.equal(lead.enrichmentStatus, "pending");
    // Celular sozinho não confirma WhatsApp.
    assert.equal(lead.whatsappStatus, "possible");
    assert.equal(lead.whatsapp, null);

    const raw = lead.rawData.tags as Record<string, string>;
    assert.equal(raw.opening_hours, "Mo-Sa 09:00-19:00");
    assert.equal(raw.note, undefined);
  });

  test("dados ausentes ficam null - nada é inventado", () => {
    const lead = normalizeOsmElement(
      { type: "way", id: 42, center: { lat: -23.5, lon: -46.8 }, tags: { name: "Clínica Bella", shop: "beauty" } },
      context,
    );
    assert.ok(lead);
    assert.equal(lead.externalId, "way/42");
    assert.equal(lead.phone, null);
    assert.equal(lead.email, null);
    assert.equal(lead.website, null);
    assert.equal(lead.instagram, null);
    assert.equal(lead.facebook, null);
    assert.equal(lead.whatsapp, null);
    assert.equal(lead.address, null);
    assert.equal(lead.postalCode, null);
    // Sem etiqueta de site: "não verificado", nunca "não tem site".
    assert.equal(lead.websiteStatus, "not_checked");
    assert.equal(lead.whatsappStatus, "unknown");
    assert.equal(lead.phoneSource, null);
    assert.equal(lead.latitude, -23.5);
  });

  test("etiqueta de WhatsApp confirma o número", () => {
    const lead = normalizeOsmElement(
      { type: "node", id: 1, lat: -23.5, lon: -46.8, tags: { name: "Pet Feliz", "contact:whatsapp": "+55 11 99876-5432" } },
      context,
    );
    assert.equal(lead?.whatsappStatus, "confirmed");
    assert.equal(lead?.whatsapp, "5511998765432");
    assert.equal(lead?.whatsappSource, "openstreetmap");
  });

  test("site que é rede social vai para o campo certo e não conta como site", () => {
    const lead = normalizeOsmElement(
      { type: "node", id: 2, lat: -23.5, lon: -46.8, tags: { name: "Studio X", website: "https://instagram.com/studiox" } },
      context,
    );
    assert.equal(lead?.website, null);
    assert.equal(lead?.websiteStatus, "not_checked");
    assert.equal(lead?.instagram, "https://www.instagram.com/studiox");
  });

  test("valores múltiplos separados por ponto e vírgula", () => {
    const lead = normalizeOsmElement(
      { type: "node", id: 3, lat: -23.5, lon: -46.8, tags: { name: "Loja", phone: "invalido;(11) 3456-7890" } },
      context,
    );
    assert.equal(lead?.phone, "551134567890");
  });

  test("elementos sem nome, sem id ou de tipo desconhecido são descartados", () => {
    assert.equal(normalizeOsmElement({ type: "node", id: 4, tags: { shop: "bakery" } }, context), null);
    assert.equal(normalizeOsmElement({ type: "node", tags: { name: "X" } }, context), null);
    assert.equal(normalizeOsmElement({ type: "area", id: 5, tags: { name: "X" } }, context), null);
    assert.equal(normalizeOsmElement({ type: "node", id: 6 }, context), null);
  });

  test("coordenadas inválidas viram null", () => {
    const lead = normalizeOsmElement({ type: "node", id: 7, lat: 0, lon: 0, tags: { name: "X" } }, context);
    assert.equal(lead?.latitude, null);
    assert.equal(lead?.longitude, null);
  });

  test("cidade só é atribuída quando a área é o limite oficial do município", () => {
    const element = { type: "node", id: 8, lat: -23.5, lon: -46.8, tags: { name: "X" } };
    const bbox = normalizeOsmElement(element, {
      categoryLabel: null,
      area: { city: "Osasco", state: "SP", isMunicipalBoundary: false },
    });
    assert.equal(bbox?.city, null);
    assert.equal(bbox?.state, null);

    const tagged = normalizeOsmElement(
      { ...element, tags: { name: "X", "addr:city": "Barueri" } },
      context,
    );
    assert.equal(tagged?.city, "Barueri");
    assert.equal(tagged?.state, null);
  });
});
