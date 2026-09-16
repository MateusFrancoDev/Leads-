/**
 * Importa empresas ATIVAS de cidades escolhidas a partir dos Dados Abertos do
 * CNPJ da Receita Federal para a tabela CnpjEstablishment.
 *
 *   npm run cnpj:import -- --uf SP --cidades "Osasco, Barueri"
 *
 * Opções:
 *   --uf SP                 UF das cidades (obrigatório)
 *   --cidades "A, B"        cidades a importar (obrigatório)
 *   --mes 2026-09           mês do conjunto de dados (padrão: o mais recente)
 *   --apagar-arquivos       apaga os .zip do mês depois de importar
 *
 * Os arquivos (~7 GB por mês) ficam em CNPJ_DATA_DIR (padrão data/cnpj) e são
 * reaproveitados: importar outra cidade no mesmo mês não baixa nada de novo.
 */

import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import pg from "pg";
import { scanLines } from "@/lib/cnpj/line-scanner";
import {
  buildLinePrefilter,
  parseCompany,
  parseEstablishment,
  parseMunicipality,
  parseRfbCsvLine,
  type CnpjEstablishmentRecord,
} from "@/lib/cnpj/records";
import { downloadRemoteFile, latestMonth, listRemoteFolder, type RemoteFile } from "@/lib/cnpj/receita-files";
import { openZipEntryStream } from "@/lib/cnpj/zip-stream";
import { buildCnpjCityKey } from "@/lib/leads/providers/receita-federal";
import { normalizeForComparison, normalizeState } from "@/lib/normalize";

const USER_AGENT = "Prospecta/1.0 (prospeccao B2B local; leads-app)";
const FILE_COUNT = 10;
const INSERT_BATCH = 500;

function log(message: string): void {
  console.log(`[cnpj] ${message}`);
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

function fail(message: string): never {
  console.error(`[cnpj] ${message}`);
  process.exit(1);
}

async function download(month: string, files: RemoteFile[], dataDir: string, name: string): Promise<string> {
  const remote = files.find((file) => file.name === name);
  if (!remote) fail(`Arquivo ${name} não existe em ${month}.`);
  const target = join(dataDir, month, name);
  let lastLogged = 0;
  await downloadRemoteFile(`${month}/${name}`, remote.size, target, {
    userAgent: USER_AGENT,
    onProgress: (downloaded, total) => {
      if (downloaded - lastLogged < 50 * 1024 * 1024 && downloaded !== total) return;
      lastLogged = downloaded;
      log(`baixando ${name}: ${formatBytes(downloaded)} de ${formatBytes(total)}`);
    },
  });
  return target;
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Sem .env: variáveis já vêm do ambiente.
  }

  const { values } = parseArgs({
    options: {
      uf: { type: "string" },
      cidades: { type: "string" },
      mes: { type: "string" },
      "apagar-arquivos": { type: "boolean", default: false },
    },
  });

  const state = normalizeState(values.uf);
  if (!state) fail('Informe a UF: --uf SP');
  const requested = (values.cidades ?? "")
    .split(/[,;]/)
    .map((city) => city.trim())
    .filter(Boolean);
  if (requested.length === 0) fail('Informe as cidades: --cidades "Osasco, Barueri"');

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) fail("DATABASE_URL não configurada no .env.");
  const dataDir = resolve(process.env.CNPJ_DATA_DIR || "data/cnpj");

  // 1. Mês e lista de arquivos
  const month = values.mes ?? latestMonth(await listRemoteFolder("", USER_AGENT));
  if (!month || !/^\d{4}-\d{2}$/.test(month)) fail("Não foi possível descobrir o mês mais recente dos dados.");
  const files = await listRemoteFolder(`${month}/`, USER_AGENT);
  const total = files
    .filter((file) => /^(Estabelecimentos|Empresas)\d\.zip$|^Municipios\.zip$/.test(file.name))
    .reduce((sum, file) => sum + file.size, 0);
  log(`base ${month} - arquivos necessários somam ${formatBytes(total)} (pasta ${join(dataDir, month)})`);

  // 2. Códigos dos municípios
  const municipiosZip = await download(month, files, dataDir, "Municipios.zip");
  const municipalities = new Map<string, Array<{ code: string; name: string }>>();
  await scanLines(openZipEntryStream(municipiosZip), {
    onLine: (line) => {
      const item = parseMunicipality(parseRfbCsvLine(line));
      if (!item) return;
      const key = normalizeForComparison(item.name);
      municipalities.set(key, [...(municipalities.get(key) ?? []), item]);
    },
  });

  const cities = new Map<string, string>();
  for (const city of requested) {
    const matches = municipalities.get(normalizeForComparison(city));
    if (!matches) {
      const prefix = normalizeForComparison(city).slice(0, 4);
      const suggestions = [...municipalities.values()]
        .flat()
        .filter((item) => normalizeForComparison(item.name).startsWith(prefix))
        .slice(0, 8)
        .map((item) => item.name);
      fail(`Cidade "${city}" não encontrada na tabela da Receita.${suggestions.length ? ` Parecidas: ${suggestions.join(", ")}` : ""}`);
    }
    // Nomes repetidos em outras UFs: o filtro por UF descarta os de fora.
    for (const item of matches) cities.set(item.code, item.name);
  }
  const cityNames = [...new Set(cities.values())];
  log(`cidades: ${cityNames.join(", ")}/${state}`);

  // 3. Estabelecimentos ativos das cidades
  const establishments = new Map<string, CnpjEstablishmentRecord>();
  const prefilter = buildLinePrefilter(state, [...cities.keys()]);
  const needles = [...cities.keys()].map((code) => `"${state}";"${code}"`);
  for (let index = 0; index < FILE_COUNT; index += 1) {
    const zip = await download(month, files, dataDir, `Estabelecimentos${index}.zip`);
    const before = establishments.size;
    await scanLines(openZipEntryStream(zip), {
      needles,
      onLine: (line) => {
        if (!prefilter(line)) return;
        const record = parseEstablishment(parseRfbCsvLine(line), { state, cities, datasetMonth: month });
        if (record) establishments.set(record.cnpj, record);
      },
    });
    log(`Estabelecimentos${index}: +${establishments.size - before} ativas (total ${establishments.size})`);
  }
  if (establishments.size === 0) fail("Nenhuma empresa ativa encontrada para essas cidades.");

  // 4. Razão social (arquivo Empresas)
  const byBase = new Map<string, CnpjEstablishmentRecord[]>();
  for (const record of establishments.values()) {
    byBase.set(record.cnpjBase, [...(byBase.get(record.cnpjBase) ?? []), record]);
  }
  for (let index = 0; index < FILE_COUNT; index += 1) {
    const zip = await download(month, files, dataDir, `Empresas${index}.zip`);
    let matched = 0;
    await scanLines(openZipEntryStream(zip), {
      onLine: (line) => {
        const records = byBase.get(line.slice(1, 9));
        if (!records) return;
        const company = parseCompany(parseRfbCsvLine(line));
        if (!company) return;
        for (const record of records) record.companyName = company.companyName;
        matched += 1;
      },
    });
    log(`Empresas${index}: ${matched} razões sociais`);
  }

  // 5. Gravação
  const client = new pg.Client({ connectionString });
  await client.connect();
  const rows = [...establishments.values()];
  const columns = [
    "cnpj", "cnpjBase", "tradeName", "companyName", "cnaeMain", "isHeadquarters", "streetType", "street",
    "number", "complement", "neighborhood", "postalCode", "state", "cityCode", "cityName", "phone1", "phone2",
    "email", "startDate", "datasetMonth",
  ] as const;
  const quoted = columns.map((column) => `"${column}"`).join(", ");
  const updates = columns.filter((column) => column !== "cnpj").map((column) => `"${column}" = EXCLUDED."${column}"`).join(", ");

  try {
    await client.query("BEGIN");
    // Empresa que fechou desde a última importação sai da base.
    await client.query(`DELETE FROM "CnpjEstablishment" WHERE "state" = $1 AND "cityName" = ANY($2)`, [state, cityNames]);

    for (let start = 0; start < rows.length; start += INSERT_BATCH) {
      const batch = rows.slice(start, start + INSERT_BATCH);
      const params: unknown[] = [];
      const placeholders = batch.map((row) => {
        const values = columns.map((column) => {
          params.push(row[column]);
          return `$${params.length}`;
        });
        return `(${values.join(", ")})`;
      });
      await client.query(
        `INSERT INTO "CnpjEstablishment" (${quoted}) VALUES ${placeholders.join(", ")} ON CONFLICT ("cnpj") DO UPDATE SET ${updates}`,
        params,
      );
      if ((start / INSERT_BATCH) % 20 === 0) log(`gravando: ${Math.min(start + INSERT_BATCH, rows.length)} de ${rows.length}`);
    }

    for (const cityName of cityNames) {
      const count = rows.filter((row) => row.cityName === cityName).length;
      const code = [...cities].find(([, name]) => name === cityName)?.[0] ?? "";
      await client.query(
        `INSERT INTO "CnpjImportedCity" ("key", "state", "cityName", "cityCode", "datasetMonth", "rows", "importedAt")
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         ON CONFLICT ("key") DO UPDATE SET "cityName" = EXCLUDED."cityName", "cityCode" = EXCLUDED."cityCode",
           "datasetMonth" = EXCLUDED."datasetMonth", "rows" = EXCLUDED."rows", "importedAt" = CURRENT_TIMESTAMP`,
        [buildCnpjCityKey(state, cityName), state, cityName, code, month, count],
      );
      log(`${cityName}/${state}: ${count} empresas ativas`);
    }

    // Buscas em cache dessa UF passam a incluir as empresas importadas.
    await client.query(`UPDATE "Search" SET "expiresAt" = CURRENT_TIMESTAMP WHERE "state" = $1`, [state]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }

  if (values["apagar-arquivos"]) {
    await rm(join(dataDir, month), { recursive: true, force: true });
    log("arquivos baixados apagados");
  }
  log(`concluído: ${rows.length} empresas ativas importadas`);
}

main().catch((error: unknown) => {
  console.error("[cnpj] falha na importação:", error instanceof Error ? error.message : error);
  process.exit(1);
});
