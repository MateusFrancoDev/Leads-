/**
 * Exportacao de leads em CSV.
 *
 * Gerado na mao: nao ha motivo para carregar uma biblioteca de planilha para
 * escrever texto separado por ponto e virgula. Usa ";" e BOM UTF-8 porque e
 * assim que o Excel em portugues abre o arquivo sem quebrar acentos.
 */

import { formatPhone } from "@/lib/normalize";
import type { LeadFilters } from "@/lib/validation";
import { serverConfig } from "@/server/config";
import { findLeadsForExport, type LeadExportRow } from "@/server/repositories/lead-repository";
import { LEAD_STATUS_LABELS } from "@/types/lead";

const SEPARATOR = ";";
const BOM = "﻿";

const COLUMNS = [
  "Empresa",
  "Ramo",
  "Telefone",
  "WhatsApp",
  "E-mail",
  "Website",
  "Instagram",
  "Cidade",
  "Estado",
  "Nota",
  "Avaliacoes",
  "Score",
  "Status",
] as const;

/** Escapa aspas e quebras de linha; celulas vazias viram string vazia. */
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
    cell(lead.email),
    cell(lead.website),
    cell(lead.instagram),
    cell(lead.city),
    cell(lead.state),
    cell(lead.rating?.toFixed(1)),
    cell(lead.reviewsCount),
    cell(lead.score),
    cell(LEAD_STATUS_LABELS[lead.status]),
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
