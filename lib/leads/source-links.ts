/** Link para conferir o registro original do lead na própria fonte. */

import { buildOsmElementUrl } from "@/lib/leads/location";

/** Consulta pública de CNPJ da Receita Federal (o CNPJ já vai preenchido). */
export function buildCnpjConsultUrl(cnpj: string): string | null {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return null;
  return `https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp?cnpj=${digits}`;
}

export function buildSourceRecordUrl(provider: string, externalId: string | null | undefined): string | null {
  if (!externalId) return null;
  if (provider === "openstreetmap") return buildOsmElementUrl(externalId);
  if (provider === "receita_federal" && externalId.startsWith("cnpj/")) {
    return buildCnpjConsultUrl(externalId.slice(5));
  }
  return null;
}
