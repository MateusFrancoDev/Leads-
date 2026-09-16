import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { after, describe, test } from "node:test";
import zlib from "node:zlib";
import { AppError } from "@/lib/errors";
import { scanLines } from "@/lib/cnpj/line-scanner";
import { latestMonth, parsePropfind } from "@/lib/cnpj/receita-files";
import {
  buildLinePrefilter,
  cleanCompanyName,
  formatCnpj,
  parseCompany,
  parseEstablishment,
  parseRfbCsvLine,
  type CnpjEstablishmentRecord,
} from "@/lib/cnpj/records";
import { openZipEntryStream } from "@/lib/cnpj/zip-stream";
import { mapCategory } from "@/lib/leads/category-mapper";
import { CompositeLeadProvider } from "@/lib/leads/providers/composite";
import {
  buildCnpjCityKey,
  cnpjRecordToLead,
  ReceitaFederalProvider,
  type CnpjSearchQuery,
  type CnpjStore,
} from "@/lib/leads/providers/receita-federal";
import { buildSourceRecordUrl } from "@/lib/leads/source-links";
import { buildLeadSearchCacheKey, normalizeExtraCities } from "@/lib/leads/search-pipeline";
import type { LeadProvider } from "@/lib/leads/types";
import { makeLead } from "./helpers";

// Linha real do layout (dados fictícios de exemplo, mesmas posições do arquivo da Receita).
const LINE =
  '"12345678";"0001";"90";"1";"ODONTO SORRISO";"02";"20200101";"00";"";"";"20150310";"8630504";"8630502";' +
  '"RUA";"ANTONIO AGU";"100";"SALA 2";"CENTRO";"06013000";"SP";"6789";"11";"36851234";"11";"987654321";"";"";' +
  '"CONTATO@ODONTOSORRISO.COM.BR";"";""';

const FILTER = { state: "SP", cities: new Map([["6789", "OSASCO"]]), datasetMonth: "2026-09" };

describe("arquivos da Receita Federal", () => {
  test("CSV com aspas e ponto e vírgula", () => {
    assert.deepEqual(parseRfbCsvLine('"a";"b;c";"d ""x""";""'), ["a", "b;c", 'd "x"', ""]);
  });

  test("estabelecimento ativo vira registro com os campos do layout", () => {
    const record = parseEstablishment(parseRfbCsvLine(LINE), FILTER);
    assert.ok(record);
    assert.equal(record.cnpj, "12345678000190");
    assert.equal(record.tradeName, "ODONTO SORRISO");
    assert.equal(record.cnaeMain, "8630504");
    assert.equal(record.street, "ANTONIO AGU");
    assert.equal(record.cityName, "OSASCO");
    assert.equal(record.phone1, "1136851234");
    assert.equal(record.phone2, "11987654321");
    assert.equal(record.email, "contato@odontosorriso.com.br");
    assert.equal(record.startDate, "20150310");
  });

  test("baixada, outra UF ou outra cidade não entram", () => {
    const fields = parseRfbCsvLine(LINE);
    assert.equal(parseEstablishment(fields.map((v, i) => (i === 5 ? "08" : v)), FILTER), null);
    assert.equal(parseEstablishment(fields.map((v, i) => (i === 19 ? "RJ" : v)), FILTER), null);
    assert.equal(parseEstablishment(fields.map((v, i) => (i === 20 ? "7107" : v)), FILTER), null);
  });

  test("pré-filtro textual por UF e município", () => {
    const prefilter = buildLinePrefilter("SP", ["6789"]);
    assert.equal(prefilter(LINE), true);
    assert.equal(prefilter(LINE.replace('"6789"', '"7107"')), false);
  });

  test("razão social de MEI sem o CPF do titular", () => {
    assert.equal(cleanCompanyName("12.345.678 JOAO DA SILVA 12345678900"), "JOAO DA SILVA");
    assert.equal(cleanCompanyName("CLINICA ODONTOLOGICA SORRISO LTDA"), "CLINICA ODONTOLOGICA SORRISO LTDA");
    assert.deepEqual(parseCompany(parseRfbCsvLine('"12345678";"CLINICA X LTDA";"2062";"49";"1000,00";"01";""')), {
      cnpjBase: "12345678",
      companyName: "CLINICA X LTDA",
    });
    assert.equal(formatCnpj("12345678000190"), "12.345.678/0001-90");
  });

  test("lê a entrada do zip em streaming e só entrega as linhas com o trecho", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cnpj-"));
    after(() => rmSync(dir, { recursive: true, force: true }));

    const other = LINE.replace('"6789"', '"7107"');
    const content = Buffer.from(`${other}\n${LINE}\n${other}\n`, "latin1");
    const data = zlib.deflateRawSync(content);
    const name = Buffer.from("K3241.ESTABELE", "latin1");
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(name.length, 26);
    const zipPath = join(dir, "Estabelecimentos0.zip");
    writeFileSync(zipPath, Buffer.concat([header, name, data, Buffer.from("PK diretorio central")]));

    const lines: string[] = [];
    await scanLines(openZipEntryStream(zipPath), { needles: ['"SP";"6789"'], onLine: (line) => lines.push(line) });
    assert.deepEqual(lines, [LINE]);
  });

  test("scanner junta linhas quebradas entre blocos", async () => {
    const lines: string[] = [];
    await scanLines(Readable.from(["abc;1\nde", "f;2\ng", "hi;3"]), { onLine: (line) => lines.push(line) });
    assert.deepEqual(lines, ["abc;1", "def;2", "ghi;3"]);
  });

  test("lista do compartilhamento e mês mais recente", () => {
    const xml = `<d:multistatus><d:response><d:href>/public.php/webdav/</d:href></d:response>
      <d:response><d:href>/public.php/webdav/2026-08/</d:href></d:response>
      <d:response><d:href>/public.php/webdav/2026-09/</d:href></d:response>
      <d:response><d:href>/public.php/webdav/2026-09/Municipios.zip</d:href><d:propstat><d:prop><d:getcontentlength>43443</d:getcontentlength></d:prop></d:propstat></d:response>
      </d:multistatus>`;
    const entries = parsePropfind(xml);
    assert.equal(latestMonth(entries), "2026-09");
    assert.deepEqual(entries.find((entry) => entry.name === "Municipios.zip"), { name: "Municipios.zip", size: 43443 });
  });
});

function record(overrides: Partial<CnpjEstablishmentRecord> = {}): CnpjEstablishmentRecord {
  return { ...parseEstablishment(parseRfbCsvLine(LINE), FILTER)!, companyName: "ODONTO SORRISO LTDA", ...overrides };
}

class MemoryCnpjStore implements CnpjStore {
  queries: CnpjSearchQuery[] = [];
  private readonly imported: string[];
  private readonly records: CnpjEstablishmentRecord[];
  constructor(imported: string[], records: CnpjEstablishmentRecord[]) {
    this.imported = imported;
    this.records = records;
  }
  async findImportedCities(keys: readonly string[]) {
    return keys
      .filter((key) => this.imported.includes(key))
      .map((key) => ({ key, cityName: key.split("|")[1].toUpperCase(), datasetMonth: "2026-09" }));
  }
  async search(query: CnpjSearchQuery) {
    this.queries.push(query);
    return this.records.slice(0, query.limit);
  }
}

describe("fonte Receita Federal", () => {
  test("registro vira lead real: dados ausentes ficam null", () => {
    const lead = cnpjRecordToLead(record({ email: null, phone2: null }), {
      categoryLabel: "Dentista",
      requestedCities: ["Osasco"],
    });
    assert.ok(lead);
    assert.equal(lead.externalId, "cnpj/12345678000190");
    assert.equal(lead.source, "receita_federal");
    assert.equal(lead.name, "Odonto Sorriso");
    assert.equal(lead.address, "Rua Antonio Agu, 100");
    assert.equal(lead.city, "Osasco");
    assert.equal(lead.postalCode, "06013-000");
    assert.equal(lead.phone, "551136851234");
    assert.equal(lead.phoneSource, "receita_federal");
    assert.equal(lead.email, null);
    assert.equal(lead.website, null);
    assert.equal(lead.websiteStatus, "not_checked");
    assert.equal(lead.instagram, null);
    assert.equal(lead.latitude, null);
    assert.equal(lead.whatsappStatus, "unknown");
    assert.equal(lead.rawData.cnpj, "12.345.678/0001-90");
  });

  test("sem nome fantasia usa a razão social; celular é só WhatsApp possível", () => {
    const lead = cnpjRecordToLead(record({ tradeName: null, companyName: "12.345.678 MARIA SOUZA 12345678900", phone1: "11987654321", number: "SN" }), {
      categoryLabel: null,
      requestedCities: ["Osasco"],
    });
    assert.equal(lead?.name, "Maria Souza");
    assert.equal(lead?.whatsappStatus, "possible");
    assert.equal(lead?.whatsapp, null);
    assert.equal(lead?.number, null);
  });

  test("busca por CNAE do nicho nas cidades importadas", async () => {
    const store = new MemoryCnpjStore([buildCnpjCityKey("SP", "Osasco")], [record()]);
    const provider = new ReceitaFederalProvider({ enabled: true, store });
    const response = await provider.search({ query: "dentistas", city: "Osasco", state: "SP", extraCities: [], limit: 20 });
    assert.equal(response.leads.length, 1);
    assert.deepEqual(store.queries[0].cnaes, mapCategory("dentista")?.cnaes);
    assert.deepEqual(response.warnings, []);
    assert.equal(response.requests, 0);
  });

  test("cidade não importada vira aviso com o comando, sem erro e sem dado inventado", async () => {
    const store = new MemoryCnpjStore([buildCnpjCityKey("SP", "Osasco")], [record()]);
    const provider = new ReceitaFederalProvider({ enabled: true, store });

    const partial = await provider.search({ query: "advocacia", city: "Osasco", state: "SP", extraCities: ["Barueri"], limit: 20 });
    assert.equal(partial.warnings.length, 1);
    assert.match(partial.warnings[0], /Barueri\/SP ainda não foi importada/);
    assert.match(partial.warnings[0], /npm run cnpj:import -- --uf SP --cidades "Barueri"/);
    assert.deepEqual(store.queries[0].cityNames, ["OSASCO"]);

    const none = await new ReceitaFederalProvider({ enabled: true, store: new MemoryCnpjStore([], [record()]) }).search({
      query: "advocacia",
      city: "Carapicuíba",
      state: "SP",
      extraCities: [],
      limit: 20,
    });
    assert.deepEqual(none.leads, []);
    assert.equal(none.warnings.length, 1);
  });

  test("link de conferência do registro na fonte", () => {
    assert.equal(
      buildSourceRecordUrl("receita_federal", "cnpj/12345678000190"),
      "https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp?cnpj=12345678000190",
    );
    assert.equal(buildSourceRecordUrl("openstreetmap", "node/1"), "https://www.openstreetmap.org/node/1");
  });
});

function fake(name: string, behaviour: () => Promise<Awaited<ReturnType<LeadProvider["search"]>>>, enabled = true): LeadProvider {
  return { name, isEnabled: () => enabled, search: behaviour };
}

describe("várias fontes e região", () => {
  test("junta fontes; uma fora do ar vira aviso", async () => {
    const composite = new CompositeLeadProvider([
      fake("openstreetmap", async () => {
        throw new AppError("PROVIDER_UNAVAILABLE", "Overpass fora do ar");
      }),
      fake("receita_federal", async () => ({
        leads: [makeLead({ externalId: "cnpj/1", source: "receita_federal" })],
        rawCount: 1,
        requests: 0,
        sourceCounts: { receita_federal: 1 },
        warnings: [],
      })),
    ]);
    const response = await composite.search({ query: "x", city: "Osasco", state: "SP", extraCities: [], limit: 10 });
    assert.equal(response.leads.length, 1);
    assert.deepEqual(response.sourceCounts, { receita_federal: 1 });
    assert.deepEqual(response.warnings, ["OpenStreetMap: Overpass fora do ar"]);
  });

  test("todas as fontes falhando: erro chega ao usuário", async () => {
    const composite = new CompositeLeadProvider([
      fake("openstreetmap", async () => {
        throw new AppError("PROVIDER_UNAVAILABLE");
      }),
    ]);
    await assert.rejects(composite.search({ query: "x", city: "Osasco", state: "SP", extraCities: [], limit: 1 }), AppError);
  });

  test("nome do conjunto muda com as fontes habilitadas (cache separado)", () => {
    const empty = async () => ({ leads: [], rawCount: 0, requests: 0, sourceCounts: {}, warnings: [] });
    assert.equal(new CompositeLeadProvider([fake("receita_federal", empty), fake("openstreetmap", empty)]).name, "openstreetmap+receita_federal");
    assert.equal(new CompositeLeadProvider([fake("receita_federal", empty, false), fake("openstreetmap", empty)]).name, "openstreetmap");
  });

  test("cidades vizinhas: sem repetição, sem a principal, e entram na chave de cache", () => {
    assert.deepEqual(normalizeExtraCities("Osasco", ["Barueri", " barueri ", "OSASCO", "Carapicuíba"]), ["Barueri", "Carapicuíba"]);
    const base = { query: "dentista", city: "Osasco", state: "SP" };
    assert.notEqual(
      buildLeadSearchCacheKey("x", { ...base, extraCities: [] }),
      buildLeadSearchCacheKey("x", { ...base, extraCities: ["Barueri"] }),
    );
    assert.equal(
      buildLeadSearchCacheKey("x", { ...base, extraCities: ["Carapicuíba", "Barueri"] }),
      buildLeadSearchCacheKey("x", { ...base, extraCities: ["barueri", "carapicuiba"] }),
    );
  });

  test("lead do OSM e da Receita no mesmo endereço é o mesmo estabelecimento", async () => {
    const { dedupeLeadResults } = await import("@/lib/leads/deduplication");
    const osm = makeLead({ externalId: "node/9", name: "Odonto Sorriso", street: "Rua Antônio Agú", number: "100" });
    const cnpj = cnpjRecordToLead(record(), { categoryLabel: "Dentista", requestedCities: ["Osasco"] })!;
    const { leads, duplicatesRemoved } = dedupeLeadResults([osm, cnpj]);
    assert.equal(duplicatesRemoved, 1);
    assert.equal(leads[0].phone, "551136851234");
    assert.equal(leads[0].latitude, osm.latitude);
  });
});
