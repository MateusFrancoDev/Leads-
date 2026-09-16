"use client";

/**
 * Acoes do lead que dependem do navegador: copiar telefone, favoritar,
 * enriquecer, analisar o site e alterar status. As mutacoes vao para Server
 * Actions - nenhuma regra de negocio mora aqui.
 */

import { useActionState, type ReactNode } from "react";
import { Brain, Globe, Sparkles, Star } from "lucide-react";
import { Button, type ButtonVariant } from "@/components/ui/button";
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
import { LEAD_STATUS_LABELS, LEAD_STATUS_ORDER, type LeadStatus } from "@/types/lead";

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

/** Um formulario por acao: cada botao tem seu proprio pending e sua mensagem. */
function ActionForm({
  action,
  leadId,
  label,
  pendingLabel,
  icon,
  variant = "secondary",
  disabled,
  hint,
}: {
  action: LeadAction;
  leadId: string;
  label: string;
  pendingLabel: string;
  icon: ReactNode;
  variant?: ButtonVariant;
  disabled?: boolean;
  hint?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialLeadActionState);

  return (
    <div className="flex flex-col gap-1">
      <form action={formAction}>
        <input type="hidden" name="leadId" value={leadId} />
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

export function LeadActionsPanel({
  leadId,
  phone,
  status,
  isFavorite,
  hasWebsite,
  aiEnabled,
}: {
  leadId: string;
  phone: string | null;
  status: LeadStatus;
  isFavorite: boolean;
  hasWebsite: boolean;
  aiEnabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-2">
        {phone ? (
          <CopyButton value={formatPhone(phone) ?? phone} label="Copiar telefone" />
        ) : null}

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
          label="Enriquecer dados"
          pendingLabel="Procurando..."
          icon={<Sparkles className="size-3.5" aria-hidden />}
          hint="Busca e-mail e redes sociais. Consulta paga so se necessario."
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
              : "Este lead nao tem site proprio para analisar."
          }
        />

        {aiEnabled ? (
          <ActionForm
            action={analyzeOpportunityAction}
            leadId={leadId}
            label="Analisar oportunidade"
            pendingLabel="Analisando..."
            icon={<Brain className="size-3.5" aria-hidden />}
            hint="Usa IA. Se nada mudou desde a ultima analise, nao gasta token."
          />
        ) : null}
      </div>

      <div className="border-t border-line pt-3">
        <StatusForm leadId={leadId} status={status} />
      </div>
    </div>
  );
}
