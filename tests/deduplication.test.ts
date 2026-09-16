import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { dedupeLeadResults, findDuplicateLead, normalizeBusinessName, normalizeStreet } from "@/lib/leads/deduplication";
import { makeLead } from "./helpers";

describe("deduplicação", () => {
  test("normaliza nome e rua para comparação", () => {
    assert.equal(normalizeBusinessName("BARBEARIA JOÃO LTDA."), "barbearia joao");
    assert.equal(normalizeBusinessName("Barbearia  João"), "barbearia joao");
    assert.equal(normalizeStreet("R. Antônio Agú"), "rua antonio agu");
    assert.equal(normalizeStreet("Av Dos Autonomistas"), "avenida dos autonomistas");
  });

  test("1. mesmo externalId", () => {
    const result = findDuplicateLead(makeLead({ externalId: "node/9" }), [makeLead({ externalId: "node/9", name: "Outro" })]);
    assert.equal(result?.reason, "externalId");
  });

  test("2. mesmo telefone perto", () => {
    const a = makeLead({ externalId: "node/1", name: "Clínica A", phone: "551134567890" });
    const b = makeLead({ externalId: "way/2", name: "Clinica A Unidade", phone: "(11) 3456-7890", latitude: -23.5321 });
    assert.equal(findDuplicateLead(a, [b])?.reason, "phone");
  });

  test("telefone de central não junta unidades distantes da mesma rede", () => {
    const a = makeLead({ externalId: "node/1", name: "Drogaria Centro", phone: "551134567890" });
    const b = makeLead({ externalId: "node/2", name: "Drogaria Km 18", phone: "551134567890", latitude: -23.56, longitude: -46.76 });
    assert.equal(findDuplicateLead(a, [b]), null);
  });

  test("3. mesmo domínio perto", () => {
    const a = makeLead({ externalId: "node/1", name: "A", website: "https://www.clinica.com.br" });
    const b = makeLead({ externalId: "node/2", name: "B", website: "http://clinica.com.br/contato" });
    assert.equal(findDuplicateLead(a, [b])?.reason, "domain");
  });

  test("domínio compartilhado (iFood, Google Sites) nunca junta empresas", () => {
    const a = makeLead({ externalId: "node/1", name: "Pizzaria A", website: "https://www.ifood.com.br/delivery/a" });
    const b = makeLead({ externalId: "node/2", name: "Pizzaria B", website: "https://www.ifood.com.br/delivery/b" });
    assert.equal(findDuplicateLead(a, [b]), null);
  });

  test("4. nome + endereço, mesmo sem coordenadas", () => {
    const a = makeLead({ externalId: "node/1", name: "Barbearia João", street: "Rua Antônio Agú", number: "100", latitude: null, longitude: null });
    const b = makeLead({ externalId: "way/2", name: "BARBEARIA JOAO", street: "R. Antonio Agu", number: "100", latitude: null, longitude: null });
    assert.equal(findDuplicateLead(a, [b])?.reason, "nameAddress");
  });

  test("5. nome + coordenadas próximas", () => {
    const a = makeLead({ externalId: "node/1", name: "Padaria Real" });
    const b = makeLead({ externalId: "way/2", name: "Padaria Real", latitude: -23.5323, longitude: -46.7918 });
    assert.equal(findDuplicateLead(a, [b])?.reason, "nameNearby");
  });

  test("mesmo nome longe não é duplicado (unidades diferentes)", () => {
    const a = makeLead({ externalId: "node/1", name: "Padaria Real" });
    const b = makeLead({ externalId: "node/2", name: "Padaria Real", latitude: -23.54, longitude: -46.8 });
    assert.equal(findDuplicateLead(a, [b]), null);
  });

  test("lote: remove repetidos e junta os dados sem inventar", () => {
    const node = makeLead({ externalId: "node/1", name: "Barbearia João", phone: "551134567890", phoneSource: "openstreetmap" });
    const way = makeLead({
      externalId: "way/2",
      name: "Barbearia Joao",
      latitude: -23.5321,
      website: "https://barbeariajoao.com.br",
      websiteStatus: "found",
      websiteSource: "openstreetmap",
      enrichmentStatus: "pending",
    });
    const other = makeLead({ externalId: "node/3", name: "Pet Shop Amigo", latitude: -23.6, longitude: -46.9 });

    const { leads, duplicatesRemoved } = dedupeLeadResults([node, way, other]);
    assert.equal(duplicatesRemoved, 1);
    assert.equal(leads.length, 2);

    const merged = leads.find((lead) => lead.name.startsWith("Barbearia"));
    assert.ok(merged);
    assert.equal(merged.phone, "551134567890");
    assert.equal(merged.website, "https://barbeariajoao.com.br");
    assert.equal(merged.websiteStatus, "found");
    assert.equal(merged.email, null);
    assert.equal(merged.instagram, null);
  });
});
