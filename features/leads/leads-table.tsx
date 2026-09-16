import Link from "next/link";
import { ExternalLink, MessageCircle } from "lucide-react";
import { ScoreBadge, WebsiteBadge } from "@/features/leads/lead-badges";
import { LeadStatusCell } from "@/features/leads/lead-status-cell";
import { extractDomain, formatPhone, whatsappLink } from "@/lib/normalize";
import type { LeadListItem } from "@/types/lead";

const HEAD_CLASSES = "px-3 py-2 text-left text-xs font-medium text-ink-muted whitespace-nowrap";
const CELL_CLASSES = "px-3 py-2.5 align-middle";

function Location({ city, state }: { city: string | null; state: string | null }) {
  const label = [city, state].filter(Boolean).join(" / ");
  return <span className="text-ink-muted">{label || "-"}</span>;
}

/**
 * Tabela de resultados. Server Component - o unico JavaScript que vai ao
 * navegador e a celula de status, que muda o lead sem sair da pagina.
 *
 * `selectable` liga as checkboxes de exportacao; a tabela do dashboard, que
 * nao vive dentro de um formulario, e renderizada sem elas.
 */
export function LeadsTable({
  leads,
  selectable = false,
}: {
  leads: readonly LeadListItem[];
  selectable?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] border-collapse text-sm">
        <thead className="border-b border-line bg-surface-muted">
          <tr>
            {selectable ? (
              <th scope="col" className={`${HEAD_CLASSES} w-8`}>
                <span className="sr-only">Selecionar</span>
              </th>
            ) : null}
            <th scope="col" className={HEAD_CLASSES}>
              Empresa
            </th>
            <th scope="col" className={HEAD_CLASSES}>
              Ramo
            </th>
            <th scope="col" className={HEAD_CLASSES}>
              Localizacao
            </th>
            <th scope="col" className={HEAD_CLASSES}>
              Telefone
            </th>
            <th scope="col" className={HEAD_CLASSES}>
              Website
            </th>
            <th scope="col" className={`${HEAD_CLASSES} text-right`}>
              Nota
            </th>
            <th scope="col" className={`${HEAD_CLASSES} text-right`}>
              Avaliacoes
            </th>
            <th scope="col" className={HEAD_CLASSES}>
              Score
            </th>
            <th scope="col" className={HEAD_CLASSES}>
              Status
            </th>
            <th scope="col" className={`${HEAD_CLASSES} text-right`}>
              Acoes
            </th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const whatsapp = whatsappLink(lead.whatsapp);
            return (
              <tr key={lead.id} className="border-b border-line last:border-0 hover:bg-surface-muted">
                {selectable ? (
                  <td className={CELL_CLASSES}>
                    <input
                      type="checkbox"
                      name="ids"
                      value={lead.id}
                      aria-label={`Selecionar ${lead.name}`}
                      className="size-3.5 accent-accent"
                    />
                  </td>
                ) : null}
                <td className={CELL_CLASSES}>
                  <Link
                    href={`/leads/${lead.id}`}
                    className="font-medium text-ink hover:text-accent hover:underline"
                  >
                    {lead.name}
                  </Link>
                </td>
                <td className={`${CELL_CLASSES} text-ink-muted`}>{lead.category ?? "-"}</td>
                <td className={CELL_CLASSES}>
                  <Location city={lead.city} state={lead.state} />
                </td>
                <td className={`${CELL_CLASSES} whitespace-nowrap tabular-nums text-ink-muted`}>
                  {formatPhone(lead.phone) ?? "-"}
                </td>
                <td className={CELL_CLASSES}>
                  {lead.website ? (
                    <a
                      href={lead.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-ink-muted hover:text-accent hover:underline"
                    >
                      {extractDomain(lead.website)}
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  ) : (
                    <WebsiteBadge status={lead.websiteStatus} />
                  )}
                </td>
                <td className={`${CELL_CLASSES} text-right tabular-nums text-ink-muted`}>
                  {lead.rating?.toFixed(1) ?? "-"}
                </td>
                <td className={`${CELL_CLASSES} text-right tabular-nums text-ink-muted`}>
                  {lead.reviewsCount ?? "-"}
                </td>
                <td className={CELL_CLASSES}>
                  <ScoreBadge score={lead.score} level={lead.scoreLevel} />
                </td>
                <td className={CELL_CLASSES}>
                  <LeadStatusCell leadId={lead.id} status={lead.status} />
                </td>
                <td className={`${CELL_CLASSES} text-right whitespace-nowrap`}>
                  <div className="inline-flex items-center gap-2">
                    {whatsapp ? (
                      <a
                        href={whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Chamar ${lead.name} no WhatsApp`}
                        className="text-ink-subtle hover:text-positive"
                      >
                        <MessageCircle className="size-4" aria-hidden />
                        <span className="sr-only">Chamar no WhatsApp</span>
                      </a>
                    ) : null}
                    <Link href={`/leads/${lead.id}`} className="text-xs text-accent hover:underline">
                      Detalhes
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
