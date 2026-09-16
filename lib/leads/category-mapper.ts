/**
 * Converte o segmento digitado em português em filtros de cada fonte:
 * etiquetas do OpenStreetMap e códigos CNAE da Receita Federal.
 *
 * O OSM não tem busca por texto livre: estabelecimentos são descritos por
 * etiquetas (shop=hairdresser, amenity=dentist). Cada nicho lista as
 * combinações que o representam e os sinônimos que o usuário costuma digitar.
 * Para adicionar um nicho basta acrescentar uma entrada em CATEGORY_RULES.
 */

import { normalizeForComparison } from "@/lib/normalize";

export interface OsmTagFilter {
  key: string;
  /** Valor exato da etiqueta. Omitido = qualquer valor. */
  value?: string;
  /** Exige também outra etiqueta (ex.: hairdresser=barber). */
  alsoRequires?: { key: string; value: string };
  /** Expressão regular, sem acento e sem caixa, aplicada ao nome. */
  nameMatches?: string;
}

/** Atividade econômica (CNAE fiscal principal, 7 dígitos) que representa o nicho. */
export interface CnaeFilter {
  code: string;
  /** Quando o CNAE é amplo, exige um destes trechos no nome (sem acento, minúsculas). */
  nameIncludes?: readonly string[];
}

export interface CategoryRule {
  /** Identificador estável: entra na chave de cache da pesquisa. */
  id: string;
  /** Rótulo gravado em Lead.category. */
  label: string;
  /** Como o usuário escreve o nicho (sem acento; plural é tratado). */
  synonyms: readonly string[];
  filters: readonly OsmTagFilter[];
  /** Códigos CNAE equivalentes, para os Dados Abertos do CNPJ. */
  cnaes: readonly CnaeFilter[];
}

export const CATEGORY_RULES: readonly CategoryRule[] = [
  {
    id: "barbearia",
    label: "Barbearia",
    synonyms: ["barbearia", "barbeiro", "barber", "barber shop", "barbershop"],
    filters: [
      { key: "shop", value: "hairdresser", alsoRequires: { key: "hairdresser", value: "barber" } },
      { key: "shop", value: "hairdresser", nameMatches: "barb" },
      { key: "shop", value: "barber" },
    ],
    cnaes: [{ code: "9602501", nameIncludes: ["barb"] }],
  },
  {
    id: "salao-de-beleza",
    label: "Salão de beleza",
    synonyms: ["salao de beleza", "salao", "cabeleireiro", "cabeleireira", "cabelereiro", "hair salon", "beauty salon"],
    filters: [
      { key: "shop", value: "hairdresser" },
      { key: "shop", value: "beauty" },
    ],
    cnaes: [{ code: "9602501" }, { code: "9602502" }],
  },
  {
    id: "manicure",
    label: "Manicure e esmalteria",
    synonyms: ["manicure", "esmalteria", "unhas", "nail", "nail designer"],
    filters: [
      { key: "shop", value: "beauty", alsoRequires: { key: "beauty", value: "nails" } },
      { key: "shop", value: "beauty", nameMatches: "unha|esmalt|nail|manicure" },
    ],
    cnaes: [{ code: "9602501", nameIncludes: ["unha", "esmalt", "nail", "manicure"] }],
  },
  {
    id: "clinica-de-estetica",
    label: "Clínica de estética",
    synonyms: ["clinica de estetica", "estetica", "esteticista", "clinica estetica", "harmonizacao facial", "depilacao"],
    filters: [
      { key: "shop", value: "beauty" },
      { key: "amenity", value: "clinic", nameMatches: "estetic|harmoniza|depila" },
      { key: "healthcare", value: "clinic", nameMatches: "estetic|harmoniza|depila" },
    ],
    cnaes: [{ code: "9602502" }],
  },
  {
    id: "dentista",
    label: "Dentista",
    synonyms: ["dentista", "odontologia", "odonto", "clinica odontologica", "consultorio odontologico", "ortodontia", "dentist"],
    filters: [
      { key: "amenity", value: "dentist" },
      { key: "healthcare", value: "dentist" },
    ],
    cnaes: [{ code: "8630504" }],
  },
  {
    id: "clinica",
    label: "Clínica médica",
    synonyms: ["clinica", "clinica medica", "consultorio", "consultorio medico", "medico", "medica", "policlinica"],
    filters: [
      { key: "amenity", value: "clinic" },
      { key: "amenity", value: "doctors" },
      { key: "healthcare", value: "clinic" },
      { key: "healthcare", value: "doctor" },
    ],
    cnaes: [{ code: "8630501" }, { code: "8630502" }, { code: "8630503" }],
  },
  {
    id: "fisioterapia",
    label: "Fisioterapia",
    synonyms: ["fisioterapia", "fisioterapeuta", "physiotherapist"],
    filters: [{ key: "healthcare", value: "physiotherapist" }],
    cnaes: [{ code: "8650004" }],
  },
  {
    id: "psicologia",
    label: "Psicologia",
    synonyms: ["psicologo", "psicologa", "psicologia", "terapeuta", "psicoterapia"],
    filters: [
      { key: "healthcare", value: "psychotherapist" },
      { key: "healthcare:speciality", value: "psychiatry" },
    ],
    cnaes: [{ code: "8650003" }],
  },
  {
    id: "laboratorio",
    label: "Laboratório",
    synonyms: ["laboratorio", "laboratorio de analises", "exames"],
    filters: [{ key: "healthcare", value: "laboratory" }],
    cnaes: [{ code: "8640202" }],
  },
  {
    id: "academia",
    label: "Academia",
    synonyms: ["academia", "gym", "musculacao", "crossfit", "fitness"],
    filters: [
      { key: "leisure", value: "fitness_centre" },
      { key: "leisure", value: "sports_centre", alsoRequires: { key: "sport", value: "fitness" } },
    ],
    cnaes: [{ code: "9313100" }],
  },
  {
    id: "pilates",
    label: "Pilates",
    synonyms: ["pilates", "studio de pilates"],
    filters: [
      { key: "leisure", value: "fitness_centre", alsoRequires: { key: "sport", value: "pilates" } },
      { key: "leisure", value: "fitness_centre", nameMatches: "pilates" },
    ],
    cnaes: [{ code: "9313100", nameIncludes: ["pilates"] }],
  },
  {
    id: "restaurante",
    label: "Restaurante",
    synonyms: ["restaurante", "restaurant", "comida", "self service"],
    filters: [{ key: "amenity", value: "restaurant" }],
    cnaes: [{ code: "5611201" }],
  },
  {
    id: "pizzaria",
    label: "Pizzaria",
    synonyms: ["pizzaria", "pizza"],
    filters: [
      { key: "amenity", value: "restaurant", alsoRequires: { key: "cuisine", value: "pizza" } },
      { key: "amenity", value: "fast_food", alsoRequires: { key: "cuisine", value: "pizza" } },
      { key: "amenity", value: "restaurant", nameMatches: "pizz" },
      { key: "amenity", value: "fast_food", nameMatches: "pizz" },
    ],
    cnaes: [{ code: "5611201", nameIncludes: ["pizz"] }, { code: "5620104", nameIncludes: ["pizz"] }, { code: "5611203", nameIncludes: ["pizz"] }],
  },
  {
    id: "lanchonete",
    label: "Lanchonete",
    synonyms: ["lanchonete", "hamburgueria", "hamburguer", "lanches", "fast food"],
    filters: [{ key: "amenity", value: "fast_food" }],
    cnaes: [{ code: "5611203" }],
  },
  {
    id: "padaria",
    label: "Padaria",
    synonyms: ["padaria", "panificadora", "bakery", "confeitaria"],
    filters: [
      { key: "shop", value: "bakery" },
      { key: "shop", value: "pastry" },
    ],
    cnaes: [{ code: "4721101" }, { code: "4721102" }, { code: "1091102" }],
  },
  {
    id: "cafeteria",
    label: "Cafeteria",
    synonyms: ["cafeteria", "cafe", "coffee shop"],
    filters: [{ key: "amenity", value: "cafe" }],
    cnaes: [{ code: "5611203", nameIncludes: ["cafe", "coffee"] }],
  },
  {
    id: "bar",
    label: "Bar",
    synonyms: ["bar", "bares", "boteco", "pub", "choperia"],
    filters: [
      { key: "amenity", value: "bar" },
      { key: "amenity", value: "pub" },
    ],
    cnaes: [{ code: "5611204" }, { code: "5611205" }],
  },
  {
    id: "pet-shop",
    label: "Pet shop",
    synonyms: ["pet shop", "petshop", "pet", "banho e tosa"],
    filters: [{ key: "shop", value: "pet" }, { key: "shop", value: "pet_grooming" }],
    cnaes: [{ code: "4789004" }, { code: "9609208" }],
  },
  {
    id: "veterinario",
    label: "Veterinário",
    synonyms: ["veterinario", "veterinaria", "clinica veterinaria", "vet"],
    filters: [{ key: "amenity", value: "veterinary" }],
    cnaes: [{ code: "7500100" }],
  },
  {
    id: "oficina",
    label: "Oficina mecânica",
    synonyms: ["oficina", "oficina mecanica", "mecanica", "mecanico", "funilaria", "car repair"],
    filters: [{ key: "shop", value: "car_repair" }],
    cnaes: [{ code: "4520001" }],
  },
  {
    id: "auto-eletrica",
    label: "Auto elétrica",
    synonyms: ["auto eletrica", "autoeletrica", "eletrica automotiva"],
    filters: [
      { key: "shop", value: "car_repair", alsoRequires: { key: "service:vehicle:electrical", value: "yes" } },
      { key: "shop", value: "car_repair", nameMatches: "eletric" },
    ],
    cnaes: [{ code: "4520003" }],
  },
  {
    id: "autopecas",
    label: "Autopeças",
    synonyms: ["autopecas", "auto pecas", "pecas automotivas"],
    filters: [{ key: "shop", value: "car_parts" }],
    cnaes: [{ code: "4530703" }],
  },
  {
    id: "lava-rapido",
    label: "Lava rápido",
    synonyms: ["lava rapido", "lava jato", "lavagem de carros", "estetica automotiva", "car wash"],
    filters: [{ key: "amenity", value: "car_wash" }, { key: "shop", value: "car_wash" }],
    cnaes: [{ code: "4520005" }],
  },
  {
    id: "imobiliaria",
    label: "Imobiliária",
    synonyms: ["imobiliaria", "corretor de imoveis", "corretora de imoveis", "imoveis"],
    filters: [
      { key: "office", value: "estate_agent" },
      { key: "shop", value: "estate_agent" },
    ],
    cnaes: [{ code: "6821801" }, { code: "6821802" }, { code: "6822600" }],
  },
  {
    id: "contabilidade",
    label: "Contabilidade",
    synonyms: ["contabilidade", "contador", "contadora", "escritorio de contabilidade", "contabil"],
    filters: [
      { key: "office", value: "accountant" },
      { key: "office", value: "tax_advisor" },
    ],
    cnaes: [{ code: "6920601" }],
  },
  {
    id: "advogado",
    label: "Advocacia",
    synonyms: ["advogado", "advogada", "advocacia", "escritorio de advocacia", "juridico", "lawyer"],
    filters: [{ key: "office", value: "lawyer" }],
    cnaes: [{ code: "6911701" }],
  },
  {
    id: "seguros",
    label: "Corretora de seguros",
    synonyms: ["seguros", "seguradora", "corretora de seguros"],
    filters: [{ key: "office", value: "insurance" }],
    cnaes: [{ code: "6622300" }],
  },
  {
    id: "farmacia",
    label: "Farmácia",
    synonyms: ["farmacia", "drogaria", "pharmacy"],
    filters: [
      { key: "amenity", value: "pharmacy" },
      { key: "healthcare", value: "pharmacy" },
    ],
    cnaes: [{ code: "4771701" }, { code: "4771702" }],
  },
  {
    id: "otica",
    label: "Ótica",
    synonyms: ["otica", "oculos", "optica", "optician"],
    filters: [{ key: "shop", value: "optician" }],
    cnaes: [{ code: "4774100" }],
  },
  {
    id: "mercado",
    label: "Mercado",
    synonyms: ["mercado", "supermercado", "mercearia", "minimercado", "hortifruti"],
    filters: [
      { key: "shop", value: "supermarket" },
      { key: "shop", value: "convenience" },
      { key: "shop", value: "greengrocer" },
    ],
    cnaes: [{ code: "4711301" }, { code: "4711302" }, { code: "4712100" }, { code: "4724500" }],
  },
  {
    id: "joalheria",
    label: "Joalheria",
    synonyms: ["joalheria", "joias", "relojoaria"],
    filters: [{ key: "shop", value: "jewelry" }, { key: "shop", value: "watches" }],
    cnaes: [{ code: "4783101" }, { code: "4783102" }],
  },
  {
    id: "floricultura",
    label: "Floricultura",
    synonyms: ["floricultura", "flores"],
    filters: [{ key: "shop", value: "florist" }],
    cnaes: [{ code: "4789002" }],
  },
  {
    id: "material-de-construcao",
    label: "Material de construção",
    synonyms: ["material de construcao", "materiais de construcao", "ferragens", "ferragem", "home center"],
    filters: [
      { key: "shop", value: "doityourself" },
      { key: "shop", value: "hardware" },
    ],
    cnaes: [{ code: "4744099" }, { code: "4744001" }, { code: "4744005" }],
  },
  {
    id: "moveis",
    label: "Móveis",
    synonyms: ["moveis", "loja de moveis", "movelaria", "marcenaria"],
    filters: [{ key: "shop", value: "furniture" }, { key: "craft", value: "carpenter" }],
    cnaes: [{ code: "4754701" }, { code: "3101200" }],
  },
  {
    id: "vestuario",
    label: "Vestuário",
    synonyms: ["roupas", "loja de roupas", "moda", "boutique", "vestuario"],
    filters: [{ key: "shop", value: "clothes" }],
    cnaes: [{ code: "4781400" }],
  },
  {
    id: "calcados",
    label: "Calçados",
    synonyms: ["calcados", "sapataria", "sapatos", "loja de calcados"],
    filters: [{ key: "shop", value: "shoes" }],
    cnaes: [{ code: "4782201" }],
  },
  {
    id: "escola-de-idiomas",
    label: "Escola de idiomas",
    synonyms: ["escola de idiomas", "curso de ingles", "idiomas", "escola de ingles"],
    filters: [{ key: "amenity", value: "language_school" }],
    cnaes: [{ code: "8593700" }],
  },
  {
    id: "escola",
    label: "Escola",
    synonyms: ["escola", "colegio", "escola particular"],
    filters: [{ key: "amenity", value: "school" }],
    cnaes: [{ code: "8512100" }, { code: "8513900" }, { code: "8520100" }],
  },
  {
    id: "hospedagem",
    label: "Hospedagem",
    synonyms: ["hotel", "pousada", "hospedagem", "hostel"],
    filters: [
      { key: "tourism", value: "hotel" },
      { key: "tourism", value: "guest_house" },
      { key: "tourism", value: "hostel" },
    ],
    cnaes: [{ code: "5510801" }, { code: "5590601" }, { code: "5590603" }, { code: "5590699" }],
  },
];

/** Chaves que caracterizam um estabelecimento. Usadas na busca por nome. */
export const BUSINESS_TAG_KEYS = ["shop", "amenity", "office", "craft", "healthcare", "leisure", "tourism"] as const;

/** Plural simples do português: "barbearias" -> "barbearia", "salões" -> "salao". */
function singularize(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("oes") || word.endsWith("aes")) return `${word.slice(0, -3)}ao`;
  if (word.endsWith("is") && word.length > 4) return `${word.slice(0, -2)}l`;
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** Forma usada para comparar termos: sem acento, sem pontuação e no singular. */
export function normalizeCategoryTerm(value: string): string {
  return normalizeForComparison(value)
    .split(" ")
    .filter(Boolean)
    .map(singularize)
    .join(" ");
}

interface IndexedSynonym {
  normalized: string;
  rule: CategoryRule;
}

const SYNONYM_INDEX: readonly IndexedSynonym[] = CATEGORY_RULES.flatMap((rule) =>
  [rule.label, rule.id.replace(/-/g, " "), ...rule.synonyms].map((synonym) => ({
    normalized: normalizeCategoryTerm(synonym),
    rule,
  })),
)
  // Sinônimo mais longo primeiro: "clinica de estetica" vence "clinica".
  .sort((a, b) => b.normalized.length - a.normalized.length);

/**
 * Encontra o nicho do termo digitado. Primeiro por igualdade; depois pelo
 * sinônimo mais longo contido no termo como palavras inteiras.
 * null = termo desconhecido (a busca cai no nome do estabelecimento).
 */
export function mapCategory(term: string): CategoryRule | null {
  const normalized = normalizeCategoryTerm(term);
  if (!normalized) return null;

  const exact = SYNONYM_INDEX.find((entry) => entry.normalized === normalized);
  if (exact) return exact.rule;

  const padded = ` ${normalized} `;
  const contained = SYNONYM_INDEX.find((entry) => padded.includes(` ${entry.normalized} `));
  return contained?.rule ?? null;
}

/** Rótulo em português para um estabelecimento a partir das suas etiquetas. */
export function labelFromTags(tags: Readonly<Record<string, string>>): string | null {
  for (const rule of CATEGORY_RULES) {
    const matches = rule.filters.some(
      (filter) =>
        !filter.nameMatches &&
        !filter.alsoRequires &&
        filter.value !== undefined &&
        tags[filter.key] === filter.value,
    );
    if (matches) return rule.label;
  }
  return null;
}

/** Nichos conhecidos, para sugestões no formulário. */
export function listCategoryLabels(): string[] {
  return CATEGORY_RULES.map((rule) => rule.label);
}
