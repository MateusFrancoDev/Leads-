import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, MessageCircle } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Panel } from "@/components/ui/feedback";
import { AiAnalysisPanel } from "@/features/leads/ai-analysis-panel";
import { LeadActionsPanel } from "@/features/leads/lead-actions-panel";
import { LeadNotesForm } from "@/features/leads/lead-notes-form";
import { ScoreBadge, StatusBadge, WebsiteBadge } from "@/features/leads/lead-badges";
import { WebsiteAnalysisPanel } from "@/features/leads/website-analysis-panel";
import { LeadListsPanel } from "@/features/lists/lead-lists-panel";
import { formatPhone, whatsappLink } from "@/lib/normalize";
import {
  findLeadById,
  findWebsiteAnalysis,
  listLeadActivities,
} from "@/server/repositories/lead-repository";
import { findListIdsForLead, listProspectingLists } from "@/server/repositories/list-repository";
import { isAiEnabled } from "@/server/ai";
import { getLeadAiAnalysis } from "@/server/services/lead-ai-service";
import type { LeadDetail } from "@/types/lead";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export async function generateMetadata({ params }: PageProps<"/leads/[id]">): Promise<Metadata> {
  const { id } = await params;
  const lead = await findLeadById(id);
  return { title: lead?.name ?? "Lead" };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line px-4 py-2.5 last:border-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-40 shrink-0 text-xs text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-sm text-ink">{children}</dd>
    </div>
  );
}

function ExternalAnchor({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-accent hover:underline"
    >
      {label}
      <ExternalLink className="size-3" aria-hidden />
    </a>
  );
}

function ContactPanel({ lead }: { lead: LeadDetail }) {
  const whatsapp = whatsappLink(lead.whatsapp);
  const address = [lead.address, lead.neighborhood, lead.city, lead.state, lead.postalCode]
    .filter(Boolean)
    .join(", ");

  return (
    <Panel className="overflow-hidden">
      <dl>
        <Row label="Categoria">{lead.category ?? "-"}</Row>
        <Row label="Telefone">{formatPhone(lead.phone) ?? "-"}</Row>
        <Row label="WhatsApp">
          {whatsapp ? <ExternalAnchor href={whatsapp} label={formatPhone(lead.whatsapp) ?? ""} /> : "-"}
        </Row>
        <Row label="E-mail">
          {lead.email ? (
            <a href={`mailto:${lead.email}`} className="text-accent hover:underline">
              {lead.email}
            </a>
          ) : (
            "-"
          )}
        </Row>
        <Row label="Site">
          {lead.website ? (
            <ExternalAnchor href={lead.website} label={lead.website} />
          ) : (
            <WebsiteBadge status={lead.websiteStatus} />
          )}
        </Row>
        <Row label="Instagram">
          {lead.instagram ? <ExternalAnchor href={lead.instagram} label={lead.instagram} /> : "-"}
        </Row>
        <Row label="Facebook">
          {lead.facebook ? <ExternalAnchor href={lead.facebook} label={lead.facebook} /> : "-"}
        </Row>
        <Row label="LinkedIn">
          {lead.linkedin ? <ExternalAnchor href={lead.linkedin} label={lead.linkedin} /> : "-"}
        </Row>
        <Row label="Endereco">{address || "-"}</Row>
        <Row label="Nota no Google">{lead.rating?.toFixed(1) ?? "-"}</Row>
        <Row label="Avaliacoes">{lead.reviewsCount ?? "-"}</Row>
        <Row label="Fonte">
          {lead.provider}
          {lead.externalId ? (
            <span className="ml-1 font-mono text-xs text-ink-subtle">{lead.externalId}</span>
          ) : null}
        </Row>
        <Row label="Descoberto em">{dateFormatter.format(lead.createdAt)}</Row>
        <Row label="Ultima atualizacao">{dateFormatter.format(lead.updatedAt)}</Row>
        <Row label="Enriquecido em">
          {lead.enrichedAt ? dateFormatter.format(lead.enrichedAt) : "Ainda nao enriquecido"}
        </Row>
      </dl>
    </Panel>
  );
}

export default async function LeadDetailPage({ params }: PageProps<"/leads/[id]">) {
  const { id } = await params;
  const lead = await findLeadById(id);
  if (!lead) notFound();

  // Consultas independentes em paralelo: uma ida so ao banco em tempo real.
  const [analysis, aiAnalysis, activities, lists, currentListIds] = await Promise.all([
    findWebsiteAnalysis(id),
    getLeadAiAnalysis(id),
    listLeadActivities(id, 10),
    listProspectingLists(),
    findListIdsForLead(id),
  ]);
  const aiEnabled = isAiEnabled();

  const whatsapp = whatsappLink(lead.whatsapp);

  return (
    <>
      <div>
        <Link
          href="/leads"
          className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Voltar para os leads
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">{lead.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ScoreBadge score={lead.score} level={lead.scoreLevel} />
            <StatusBadge status={lead.status} />
            <WebsiteBadge status={lead.websiteStatus} />
            {lead.city ? (
              <span className="text-xs text-ink-muted">
                {lead.city}
                {lead.state ? `/${lead.state}` : ""}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses("primary", "md")}
            >
              <MessageCircle className="size-4" aria-hidden />
              Chamar no WhatsApp
            </a>
          ) : null}
          {lead.website ? (
            <a
              href={lead.website}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses("secondary", "md")}
            >
              Abrir site
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-6">
          <ContactPanel lead={lead} />

          {aiAnalysis ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-ink">Analise de oportunidade</h2>
              <AiAnalysisPanel analysis={aiAnalysis} />
            </section>
          ) : null}

          {analysis ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-ink">Analise do site</h2>
              <WebsiteAnalysisPanel analysis={analysis} />
            </section>
          ) : null}

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-ink">Anotacoes</h2>
            <Panel className="p-4">
              <LeadNotesForm leadId={lead.id} notes={lead.notes} />
            </Panel>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-ink">Acoes</h2>
            <Panel className="p-4">
              <LeadActionsPanel
                leadId={lead.id}
                phone={lead.phone}
                status={lead.status}
                isFavorite={lead.isFavorite}
                hasWebsite={Boolean(lead.website)}
                aiEnabled={aiEnabled}
              />
            </Panel>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-ink">Listas</h2>
            <Panel className="p-4">
              <LeadListsPanel
                leadId={lead.id}
                lists={lists}
                currentListIds={currentListIds}
              />
            </Panel>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-ink">Por que este lead pontuou {lead.score}</h2>
            <Panel className="p-4">
              {lead.scoreReasons.length > 0 ? (
                <ul className="flex flex-col gap-1.5 text-sm text-ink-muted">
                  {lead.scoreReasons.map((reason) => (
                    <li key={reason} className="flex gap-2">
                      <span aria-hidden className="text-ink-subtle">
                        ·
                      </span>
                      {reason}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-muted">
                  Nenhum sinal de oportunidade identificado para esta empresa.
                </p>
              )}
            </Panel>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-ink">Historico</h2>
            <Panel className="overflow-hidden">
              {activities.length > 0 ? (
                <ul className="divide-y divide-line text-sm">
                  {activities.map((activity) => (
                    <li key={activity.id} className="px-4 py-2.5">
                      <p className="text-ink-muted">{activity.message}</p>
                      <p className="mt-0.5 text-xs text-ink-subtle">
                        {dateFormatter.format(activity.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-3 text-sm text-ink-muted">
                  Nenhuma atividade registrada ainda.
                </p>
              )}
            </Panel>
          </section>
        </div>
      </div>
    </>
  );
}
