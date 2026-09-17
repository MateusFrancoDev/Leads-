"use client";

/**
 * Ações do lead que dependem do navegador: copiar contatos, abrir canais,
 * favoritar, ler o site e alterar status. As mutações vão para Server Actions -
 * nenhuma regra de negócio mora aqui.
 */

import { useActionState, type ReactNode } from "react";
import { AtSign, Brain, CheckCheck, Globe, MapPin, MessageCircle, Sparkles, Star } from "lucide-react";
import { Button, buttonClasses, type ButtonVariant } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Select } from "@/components/ui/form";
import { formatPhone } from "@/lib/normalize";
import {
  analyzeOpportunityAction,
  analyzeWebsiteAction,
  enrichLeadAction,
  initialLeadActionState,
  toggleFavoriteAction,
  updateLeadStatusAction,
  type LeadActionState,
} from "@/server/actions/lead-actions";
import { LEAD_STATUS_LABELS, LEAD_STATUS_ORDER, LeadStatus } from "@/types/lead";

type LeadAction = (state: LeadActionState, formData: FormData) => Promise<LeadActionState>;

function Feedback({ state }: { state: LeadActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={state.status === "error" ? "text-xs text-negative" : "text-xs text-positive"}
    >
      {state.message}
    </p>
  );
}

/** Um formulário por ação: cada botão tem seu próprio pending e sua mensagem. */
function ActionForm({
  action,
  leadId,
  label,
  pendingLabel,
  icon,
  variant = "secondary",
  disabled,
  hint,
  extraFields,
}: {
  action: LeadAction;
  leadId: string;
  label: string;
  pendingLabel: string;
  icon: ReactNode;
  variant?: ButtonVariant;
  disabled?: boolean;
  hint?: string;
  extraFields?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, initialLeadActionState);

  return (
    <div className="flex flex-col gap-1">
      <form action={formAction}>
        <input type="hidden" name="leadId" value={leadId} />
        {Object.entries(extraFields ?? {}).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <Button type="submit" size="sm" variant={variant} disabled={pending || disabled}>
          {icon}
          {pending ? pendingLabel : label}
        </Button>
      </form>
      {hint && !state.message ? <p className="text-xs text-ink-subtle">{hint}</p> : null}
      <Feedback state={state} />
    </div>
  );
}

function StatusForm({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const [state, formAction, pending] = useActionState(
    updateLeadStatusAction,
    initialLeadActionState,
  );

  return (
    <div className="flex flex-col gap-1">
      <form action={formAction} className="flex items-end gap-2">
        <input type="hidden" name="leadId" value={leadId} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor="lead-status" className="text-xs font-medium text-ink-muted">
            Status
          </label>
          <Select id="lead-status" name="status" defaultValue={status}>
            {LEAD_STATUS_ORDER.map((option) => (
              <option key={option} value={option}>
                {LEAD_STATUS_LABELS[option]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Salvando..." : "Atualizar"}
        </Button>
      </form>
      <Feedback state={state} />
    </div>
  );
}

function ExternalButton({ href, label, icon, title }: { href: string; label: string; icon: ReactNode; title?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      title={title}
      className={buttonClasses("secondary", "sm")}
    >
      {icon}
      {label}
    </a>
  );
}

export interface LeadActionsPanelProps {
  leadId: string;
  phone: string | null;
  email: string | null;
  whatsapp: { href: string; confirmed: boolean } | null;
  instagram: string | null;
  website: string | null;
  locationUrl: string | null;
  status: LeadStatus;
  isFavorite: boolean;
  aiEnabled: boolean;
  /** Já existe análise gravada? Define "Analisar" x "Reanalisar". */
  hasAiAnalysis: boolean;
  /** "há 3 dias", já formatado no servidor. */
  analyzedAgo?: string;
}

export function LeadActionsPanel({
  leadId,
  phone,
  email,
  whatsapp,
  instagram,
  website,
  locationUrl,
  status,
  isFavorite,
  aiEnabled,
  hasAiAnalysis,
  analyzedAgo,
}: LeadActionsPanelProps) {
  const hasWebsite = Boolean(website);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-2">
        {phone ? <CopyButton value={formatPhone(phone) ?? phone} label="Copiar telefone" /> : null}
        {email ? <CopyButton value={email} label="Copiar e-mail" /> : null}
        {whatsapp ? (
          <ExternalButton
            href={whatsapp.href}
            label={whatsapp.confirmed ? "Abrir WhatsApp" : "Tentar WhatsApp"}
            title={whatsapp.confirmed ? undefined : "Celular sem WhatsApp confirmado"}
            icon={<MessageCircle className="size-3.5" aria-hidden />}
          />
        ) : null}
        {instagram ? (
          <ExternalButton href={instagram} label="Abrir Instagram" icon={<AtSign className="size-3.5" aria-hidden />} />
        ) : null}
        {website ? (
          <ExternalButton href={website} label="Abrir site" icon={<Globe className="size-3.5" aria-hidden />} />
        ) : null}
        {locationUrl ? (
          <ExternalButton href={locationUrl} label="Abrir localização" icon={<MapPin className="size-3.5" aria-hidden />} />
        ) : null}
      </div>

      <div className="flex flex-wrap items-start gap-2 border-t border-line pt-3">
        <ActionForm
          action={updateLeadStatusAction}
          leadId={leadId}
          label={status === LeadStatus.CONTACTED ? "Já contatado" : "Marcar como contatado"}
          pendingLabel="Salvando..."
          variant="primary"
          disabled={status === LeadStatus.CONTACTED}
          extraFields={{ status: LeadStatus.CONTACTED }}
          icon={<CheckCheck className="size-3.5" aria-hidden />}
        />
        <ActionForm
          action={toggleFavoriteAction}
          leadId={leadId}
          label={isFavorite ? "Remover dos favoritos" : "Favoritar"}
          pendingLabel="Salvando..."
          icon={
            <Star
              className={isFavorite ? "size-3.5 fill-warning text-warning" : "size-3.5"}
              aria-hidden
            />
          }
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-3">
        <ActionForm
          action={enrichLeadAction}
          leadId={leadId}
          label="Ler site oficial"
          pendingLabel="Lendo o site..."
          icon={<Sparkles className="size-3.5" aria-hidden />}
          disabled={!hasWebsite}
          hint={
            hasWebsite
              ? "Procura e-mail, telefone, WhatsApp e redes no próprio site. Sem API paga."
              : "Sem site informado: não há o que ler."
          }
        />

        <ActionForm
          action={analyzeWebsiteAction}
          leadId={leadId}
          label="Analisar site"
          pendingLabel="Analisando..."
          icon={<Globe className="size-3.5" aria-hidden />}
          disabled={!hasWebsite}
          hint={
            hasWebsite
              ? "Verifica HTTPS, mobile, SEO e rastreamento."
              : "Sem site informado para analisar."
          }
        />

        {aiEnabled ? (
          <ActionForm
            action={analyzeOpportunityAction}
            leadId={leadId}
            label={hasAiAnalysis ? "Reanalisar com IA" : "Analisar com IA"}
            pendingLabel="Analisando..."
            icon={<Brain className="size-3.5" aria-hidden />}
            // Reanalisar é pedido explícito de gastar: só aí ignoramos o cache.
            extraFields={hasAiAnalysis ? { force: "1" } : undefined}
            hint={
              hasAiAnalysis
                ? analyzedAgo
                  ? `Analisado ${analyzedAgo}. Reanalisar gera uma análise nova e gasta tokens.`
                  : "Reanalisar gera uma análise nova e gasta tokens."
                : "Classifica a oportunidade a partir dos dados já coletados. Não inventa dados."
            }
          />
        ) : null}
      </div>

      <div className="border-t border-line pt-3">
        <StatusForm leadId={leadId} status={status} />
      </div>
    </div>
  );
}
