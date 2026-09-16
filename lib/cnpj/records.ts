/**
 * Layout dos arquivos dos Dados Abertos do CNPJ e conversão para registros.
 * Referência: https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf
 *
 * Os campos são copiados como vieram. Só há limpeza de formato (espaços,
 * zeros de preenchimento, CPF embutido no nome de MEI) - nada é completado.
 */

/** Linha "a";"b";"c" do CSV da Receita (Latin-1, separador ";", aspas duplas). */
export function parseRfbCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ";") {
      fields.push(current);
      current = "";
    } else if (char !== "\r") {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/** Situação cadastral "02" = ativa. As demais (baixada, inapta, suspensa) não viram lead. */
export const ACTIVE_STATUS = "02";

const ESTABLISHMENT = {
  cnpjBase: 0,
  cnpjOrder: 1,
  cnpjDigits: 2,
  headquarters: 3,
  tradeName: 4,
  status: 5,
  startDate: 10,
  cnaeMain: 11,
  streetType: 13,
  street: 14,
  number: 15,
  complement: 16,
  neighborhood: 17,
  postalCode: 18,
  state: 19,
  cityCode: 20,
  ddd1: 21,
  phone1: 22,
  ddd2: 23,
  phone2: 24,
  email: 27,
} as const;

export interface CnpjEstablishmentRecord {
  cnpj: string;
  cnpjBase: string;
  tradeName: string | null;
  companyName: string | null;
  cnaeMain: string;
  isHeadquarters: boolean;
  streetType: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  postalCode: string | null;
  state: string;
  cityCode: string;
  cityName: string;
  phone1: string | null;
  phone2: string | null;
  email: string | null;
  startDate: string | null;
  datasetMonth: string;
}

function clean(value: string | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim();
  return text ? text : null;
}

/** DDD + número como a Receita guardou (só dígitos). A validação fica no normalizador de telefone. */
function joinPhone(ddd: string | undefined, phone: string | undefined): string | null {
  const digits = `${ddd ?? ""}${phone ?? ""}`.replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}

/**
 * Filtro rápido antes do parse completo: a linha precisa conter UF e código
 * do município vizinhos, como aparecem no arquivo (…;"SP";"6789";…).
 */
export function buildLinePrefilter(state: string, cityCodes: readonly string[]): (line: string) => boolean {
  const needles = cityCodes.map((code) => `"${state}";"${code}"`);
  return (line) => needles.some((needle) => line.includes(needle));
}

export interface EstablishmentFilter {
  state: string;
  /** Código do município na Receita -> nome. */
  cities: ReadonlyMap<string, string>;
  datasetMonth: string;
}

/** Converte uma linha do arquivo Estabelecimentos. null quando não é ativa ou está fora do filtro. */
export function parseEstablishment(fields: readonly string[], filter: EstablishmentFilter): CnpjEstablishmentRecord | null {
  if (fields.length < 28) return null;
  if (fields[ESTABLISHMENT.status] !== ACTIVE_STATUS) return null;
  if (fields[ESTABLISHMENT.state] !== filter.state) return null;
  const cityName = filter.cities.get(fields[ESTABLISHMENT.cityCode]);
  if (!cityName) return null;

  const cnpj = `${fields[ESTABLISHMENT.cnpjBase]}${fields[ESTABLISHMENT.cnpjOrder]}${fields[ESTABLISHMENT.cnpjDigits]}`;
  if (!/^\d{14}$/.test(cnpj)) return null;
  const cnaeMain = fields[ESTABLISHMENT.cnaeMain];
  if (!/^\d{7}$/.test(cnaeMain)) return null;

  const startDate = clean(fields[ESTABLISHMENT.startDate]);
  const postalCode = fields[ESTABLISHMENT.postalCode]?.replace(/\D/g, "");

  return {
    cnpj,
    cnpjBase: fields[ESTABLISHMENT.cnpjBase],
    tradeName: clean(fields[ESTABLISHMENT.tradeName]),
    companyName: null,
    cnaeMain,
    isHeadquarters: fields[ESTABLISHMENT.headquarters] === "1",
    streetType: clean(fields[ESTABLISHMENT.streetType]),
    street: clean(fields[ESTABLISHMENT.street]),
    number: clean(fields[ESTABLISHMENT.number]),
    complement: clean(fields[ESTABLISHMENT.complement]),
    neighborhood: clean(fields[ESTABLISHMENT.neighborhood]),
    postalCode: postalCode && postalCode.length === 8 ? postalCode : null,
    state: filter.state,
    cityCode: fields[ESTABLISHMENT.cityCode],
    cityName,
    phone1: joinPhone(fields[ESTABLISHMENT.ddd1], fields[ESTABLISHMENT.phone1]),
    phone2: joinPhone(fields[ESTABLISHMENT.ddd2], fields[ESTABLISHMENT.phone2]),
    email: clean(fields[ESTABLISHMENT.email])?.toLowerCase() ?? null,
    startDate: startDate && /^\d{8}$/.test(startDate) && startDate !== "00000000" ? startDate : null,
    datasetMonth: filter.datasetMonth,
  };
}

/** Linha do arquivo Empresas: CNPJ básico e razão social. */
export function parseCompany(fields: readonly string[]): { cnpjBase: string; companyName: string | null } | null {
  if (fields.length < 2 || !/^\d{8}$/.test(fields[0])) return null;
  return { cnpjBase: fields[0], companyName: clean(fields[1]) };
}

/** Linha do arquivo Municípios: código da Receita e nome. */
export function parseMunicipality(fields: readonly string[]): { code: string; name: string } | null {
  if (fields.length < 2 || !fields[0] || !fields[1]) return null;
  return { code: fields[0].trim(), name: fields[1].trim() };
}

/**
 * Razão social de MEI traz o CNPJ básico no início e o CPF do titular no fim
 * ("12.345.678 JOAO DA SILVA 12345678900"). Tirar esses números é só formato:
 * o nome continua o mesmo e o CPF de uma pessoa não vai para a tela.
 */
export function cleanCompanyName(name: string | null | undefined): string | null {
  if (!name) return null;
  const cleaned = name
    .replace(/^\d{2}\.\d{3}\.\d{3}\s+/, "")
    .replace(/\s+\d{11}$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

export function formatCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return cnpj;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}
