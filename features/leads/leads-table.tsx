import Link from "next/link";
import { AtSign, ExternalLink, Globe, MapPin, MessageCircle } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import {
  AiScoreBadge,
  ScoreBadge,
  SourceBadge,
  WebsiteBadge,
  WhatsappBadge,
} from "@/features/leads/lead-badges";
import { LeadStatusCell } from "@/features/leads/lead-status-cell";
import { formatRelativeTime } from "@/lib/format-time";
import { leadWhatsappHref } from "@/lib/leads/contact-links";
import { buildLocationUrl } from "@/lib/leads/location";
import { extractDomain, extractSocialHandle, formatPhone } from "@/lib/normalize";
import type { LeadListItem } from "@/types/lead";

const HEAD_CLASSES = "px-3 py-2 text-left text-xs font-medium text-ink-muted whitespace-nowrap";
const CELL_CLASSES = "px-3 py-2.5 align-middle";
const ICON_LINK = "inline-flex size-6 items-center justify-center rounded text-ink-subtle hover:text-accent";

function Location({ lead }: { lead: LeadListItem }) {
  const place = [lead.city, lead.state].filter(Boolean).join(" / ");
  if (!place && !lead.neighborhood) return <span className="text-ink-subtle">-</span>;
  return (
    <span className="flex flex-col text-ink-muted">
      <span className="whitespace-nowrap">{place || "-"}</span>
      {lead.neighborhood ? <span className="text-xs text-ink-subtle">{lead.neighborhood}</span> : null}
    </span>
  );
}

/**
 * Score da IA e situação da análise. Enquanto ninguém pediu a análise, a
 * célula diz isso claramente: nada é analisado só por abrir a página.
 */
function AiCell({ lead }: { lead: LeadListItem }) {
  const ai = lead.aiAnalysis;
  if (!ai) {
    return <span className="text-xs text-ink-subtle">Não analisado</span>;
  }
  return (
    <span className="flex flex-col gap-1">
      <AiScoreBadge score={ai.score} opportunity={ai.opportunity} />
      <span className="text-xs text-ink-subtle">
        Analisado {formatRelativeTime(ai.createdAt)}
      </span>
    </span>
  );
}

/**
 * Tabela de resultados. Server Component - o JavaScript enviado ao navegador
 * se resume à célula de status e aos botões de copiar.
 *
 * `selectable` liga as checkboxes de exportação; a tabela do dashboard, que
 * não vive dentro de um formulário, e renderizada sem elas.
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
      <table className="w-full min-w-368 border-collapse text-sm">
        <thead className="border-b border-line bg-surface-muted">
          <tr>
            {selectable ? (
              <th scope="col" className={`${HEAD_CLASSES} w-8`}>
                <span className="sr-only">Selecionar</span>
              </th>
            ) : null}
            <th scope="col" className={HEAD_CLASSES}>Empresa</th>
            <th scope="col" className={HEAD_CLASSES}>Segmento</th>
            <th scope="col" className={HEAD_CLASSES}>Localização</th>
            <th scope="col" className={HEAD_CLASSES}>Telefone</th>
            <th scope="col" className={HEAD_CLASSES}>WhatsApp</th>
            <th scope="col" className={HEAD_CLASSES}>Site</th>
            <th scope="col" className={HEAD_CLASSES}>Instagram</th>
            <th scope="col" className={HEAD_CLASSES}>E-mail</th>
            <th scope="col" className={HEAD_CLASSES}>Score</th>
            <th scope="col" className={HEAD_CLASSES}>Score IA</th>
            <th scope="col" className={HEAD_CLASSES}>Fonte</th>
            <th scope="col" className={HEAD_CLASSES}>Status</th>
            <th scope="col" className={`${HEAD_CLASSES} text-right`}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const whatsapp = leadWhatsappHref(lead);
            const location = buildLocationUrl(lead.latitude, lead.longitude);
            const phone = formatPhone(lead.phone);
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
                  <Location lead={lead} />
                </td>
                <td className={`${CELL_CLASSES} whitespace-nowrap tabular-nums text-ink-muted`}>
                  {phone ? (
                    <span className="inline-flex items-center gap-1">
                      {phone}
                      <CopyButton value={phone} label={`Copiar telefone de ${lead.name}`} iconOnly />
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className={CELL_CLASSES}>
                  <WhatsappBadge status={lead.whatsappStatus} />
                </td>
                <td className={CELL_CLASSES}>
                  {lead.website ? (
                    <a
                      href={lead.website}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 text-ink-muted hover:text-accent hover:underline"
                    >
                      {extractDomain(lead.website)}
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  ) : (
                    <WebsiteBadge status={lead.websiteStatus} />
                  )}
                </td>
                <td className={`${CELL_CLASSES} whitespace-nowrap`}>
                  {lead.instagram ? (
                    <a
                      href={lead.instagram}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-ink-muted hover:text-accent hover:underline"
                    >
                      {extractSocialHandle(lead.instagram) ?? "Perfil"}
                    </a>
                  ) : (
                    <span className="text-ink-subtle">-</span>
                  )}
                </td>
                <td className={`${CELL_CLASSES} max-w-56`}>
                  {lead.email ? (
                    <span className="inline-flex max-w-full items-center gap-1 text-ink-muted">
                      <span className="truncate">{lead.email}</span>
                      <CopyButton value={lead.email} label={`Copiar e-mail de ${lead.name}`} iconOnly />
                    </span>
                  ) : (
                    <span className="text-ink-subtle">-</span>
                  )}
                </td>
                <td className={CELL_CLASSES}>
                  <ScoreBadge score={lead.score} level={lead.scoreLevel} />
                </td>
                <td className={CELL_CLASSES}>
                  <AiCell lead={lead} />
                </td>
                <td className={CELL_CLASSES}>
                  <SourceBadge provider={lead.provider} />
                </td>
                <td className={CELL_CLASSES}>
                  <LeadStatusCell leadId={lead.id} status={lead.status} />
                </td>
                <td className={`${CELL_CLASSES} text-right whitespace-nowrap`}>
                  <div className="inline-flex items-center gap-0.5">
                    {whatsapp ? (
                      <a
                        href={whatsapp.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={whatsapp.confirmed ? "Abrir WhatsApp" : "Tentar WhatsApp (não confirmado)"}
                        className={ICON_LINK}
                      >
                        <MessageCircle className="size-4" aria-hidden />
                        <span className="sr-only">Abrir WhatsApp</span>
                      </a>
                    ) : null}
                    {lead.instagram ? (
                      <a href={lead.instagram} target="_blank" rel="noopener noreferrer nofollow" title="Abrir Instagram" className={ICON_LINK}>
                        <AtSign className="size-4" aria-hidden />
                        <span className="sr-only">Abrir Instagram</span>
                      </a>
                    ) : null}
                    {lead.website ? (
                      <a href={lead.website} target="_blank" rel="noopener noreferrer nofollow" title="Abrir site" className={ICON_LINK}>
                        <Globe className="size-4" aria-hidden />
                        <span className="sr-only">Abrir site</span>
                      </a>
                    ) : null}
                    {location ? (
                      <a href={location} target="_blank" rel="noopener noreferrer" title="Abrir localização" className={ICON_LINK}>
                        <MapPin className="size-4" aria-hidden />
                        <span className="sr-only">Abrir localização</span>
                      </a>
                    ) : null}
                    <Link href={`/leads/${lead.id}`} className="ml-1 text-xs text-accent hover:underline">
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
