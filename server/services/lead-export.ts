/**
 * Exportação de leads em CSV.
 *
 * Gerado na mao: não há motivo para carregar uma biblioteca de planilha para
 * escrever texto separado por ponto e virgula. Usa ";" e BOM UTF-8 porque e
 * assim que o Excel em português abre o arquivo sem quebrar acentos.
 */

import { buildLocationUrl } from "@/lib/leads/location";
import { buildSourceRecordUrl } from "@/lib/leads/source-links";
import { formatPhone } from "@/lib/normalize";
import type { LeadFilters } from "@/lib/validation";
import { serverConfig } from "@/server/config";
import { findLeadsForExport, type LeadExportRow } from "@/server/repositories/lead-repository";
import {
  LEAD_STATUS_LABELS,
  WEBSITE_STATUS_LABELS,
  WHATSAPP_STATUS_LABELS,
  leadSourceLabel,
} from "@/types/lead";

const SEPARATOR = ";";
const BOM = "﻿";

const COLUMNS = [
  "Empresa",
  "Segmento",
  "Telefone",
  "WhatsApp",
  "Situação do WhatsApp",
  "E-mail",
  "Site",
  "Situação do site",
  "Instagram",
  "Endereço",
  "Bairro",
  "Cidade",
  "Estado",
  "Localização",
  "Score",
  "Status",
  "Fonte",
  "Registro na fonte",
] as const;

/** Escapa aspas e quebras de linha; células vazias viram string vazia. */
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

function toRow(lead: LeadExportRow): string {
  return [
    cell(lead.name),
    cell(lead.category),
    cell(formatPhone(lead.phone)),
    cell(formatPhone(lead.whatsapp)),
    cell(WHATSAPP_STATUS_LABELS[lead.whatsappStatus]),
    cell(lead.email),
    cell(lead.website),
    cell(WEBSITE_STATUS_LABELS[lead.websiteStatus]),
    cell(lead.instagram),
    cell(lead.address),
    cell(lead.neighborhood),
    cell(lead.city),
    cell(lead.state),
    cell(buildLocationUrl(lead.latitude, lead.longitude)),
    cell(lead.score),
    cell(LEAD_STATUS_LABELS[lead.status]),
    cell(leadSourceLabel(lead.provider)),
    cell(buildSourceRecordUrl(lead.provider, lead.externalId) ?? lead.externalId),
  ].join(SEPARATOR);
}

export function buildLeadsCsv(leads: readonly LeadExportRow[]): string {
  const header = COLUMNS.map(cell).join(SEPARATOR);
  return BOM + [header, ...leads.map(toRow)].join("\r\n");
}

export interface CsvExport {
  csv: string;
  filename: string;
  rows: number;
}

export async function exportLeads(filters: LeadFilters): Promise<CsvExport> {
  const leads = await findLeadsForExport(filters, serverConfig.maxExportRows);
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    csv: buildLeadsCsv(leads),
    filename: `leads-${stamp}.csv`,
    rows: leads.length,
  };
}
