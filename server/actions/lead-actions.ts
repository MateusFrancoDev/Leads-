"use server";

/** Server Actions do lead: status e favorito. Sempre validadas com Zod. */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toAppError, userMessage } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import {
  toggleLeadFavorite,
  updateLeadNotes,
  updateLeadStatus,
} from "@/server/repositories/lead-repository";
import { analyzeLeadOpportunity } from "@/server/services/lead-ai-service";
import { enrichLead } from "@/server/services/lead-enrichment";
import { analyzeLeadWebsite } from "@/server/services/lead-website-service";
import { LEAD_STATUS_ORDER, LeadStatus } from "@/types/lead";

const logger = createLogger("lead-action");

export interface LeadActionState {
  status: "idle" | "error" | "success";
  message?: string;
}

export const initialLeadActionState: LeadActionState = { status: "idle" };

const statusSchema = z.object({
  leadId: z.string().min(1),
  status: z.enum(LEAD_STATUS_ORDER as unknown as [LeadStatus, ...LeadStatus[]]),
});

export async function updateLeadStatusAction(
  _previous: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  const parsed = statusSchema.safeParse({
    leadId: formData.get("leadId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { status: "error", message: "Status inválido." };

  try {
    await updateLeadStatus(parsed.data.leadId, parsed.data.status);
  } catch (error) {
    logger.error("falha ao atualizar status");
    return { status: "error", message: userMessage(error) };
  }

  revalidatePath(`/leads/${parsed.data.leadId}`);
  revalidatePath("/leads");
  return { status: "success", message: "Status atualizado." };
}

const favoriteSchema = z.object({ leadId: z.string().min(1) });

export async function toggleFavoriteAction(
  _previous: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  const parsed = favoriteSchema.safeParse({ leadId: formData.get("leadId") });
  if (!parsed.success) return { status: "error", message: "Lead inválido." };

  try {
    const isFavorite = await toggleLeadFavorite(parsed.data.leadId);
    revalidatePath(`/leads/${parsed.data.leadId}`);
    revalidatePath("/leads");
    return { status: "success", message: isFavorite ? "Salvo nos favoritos." : "Removido dos favoritos." };
  } catch (error) {
    logger.error("falha ao favoritar");
    return { status: "error", message: userMessage(error) };
  }
}

const leadIdSchema = z.object({ leadId: z.string().min(1) });

/** Enriquecimento sob demanda: só roda quando o usuário clica. */
export async function enrichLeadAction(
  _previous: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  const parsed = leadIdSchema.safeParse({ leadId: formData.get("leadId") });
  if (!parsed.success) return { status: "error", message: "Lead inválido." };

  try {
    const outcome = await enrichLead(parsed.data.leadId);
    revalidatePath(`/leads/${parsed.data.leadId}`);

    if (outcome.status === "enriched") {
      return { status: "success", message: `Encontrado no site oficial: ${outcome.fields.join(", ")}.` };
    }
    const messages: Record<typeof outcome.reason, string> = {
      recent: "O site deste lead foi lido recentemente - nada foi baixado de novo.",
      "nothing-new": "O site oficial não mostra nenhum contato novo.",
      "no-website": "Este lead não tem site informado para ler.",
      unreachable: "O site oficial não respondeu. O lead foi mantido sem alterações.",
    };
    return { status: outcome.reason === "unreachable" ? "error" : "success", message: messages[outcome.reason] };
  } catch (error) {
    logger.error("falha ao enriquecer");
    return { status: "error", message: userMessage(error) };
  }
}

/** Análise do site sob demanda. */
export async function analyzeWebsiteAction(
  _previous: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  const parsed = leadIdSchema.safeParse({ leadId: formData.get("leadId") });
  if (!parsed.success) return { status: "error", message: "Lead inválido." };

  try {
    const outcome = await analyzeLeadWebsite(parsed.data.leadId);
    revalidatePath(`/leads/${parsed.data.leadId}`);

    if (outcome.status === "analyzed") {
      return {
        status: "success",
        message: outcome.reachable
          ? `Site analisado: ${outcome.issues.length} pontos de melhoria.`
          : "O site não respondeu - lead marcado como site fora do ar.",
      };
    }
    return {
      status: "success",
      message:
        outcome.reason === "no-website"
          ? "Este lead não tem site informado para analisar."
          : "O site já foi analisado recentemente - nada foi baixado de novo.",
    };
  } catch (error) {
    logger.error("falha ao analisar site");
    return { status: "error", message: userMessage(error) };
  }
}

const analyzeSchema = z.object({
  leadId: z.string().min(1),
  /** "Reanalisar" envia force=1; a primeira análise não envia nada. */
  force: z.union([z.literal("1"), z.literal("true")]).optional(),
});

/**
 * Análise de oportunidade por IA. Só roda quando o usuário pede - abrir a
 * página do lead nunca dispara uma chamada ao modelo.
 */
export async function analyzeOpportunityAction(
  _previous: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  const parsed = analyzeSchema.safeParse({
    leadId: formData.get("leadId"),
    force: formData.get("force") ?? undefined,
  });
  if (!parsed.success) return { status: "error", message: "Lead inválido." };

  try {
    const outcome = await analyzeLeadOpportunity(parsed.data.leadId, {
      force: Boolean(parsed.data.force),
    });
    revalidatePath(`/leads/${parsed.data.leadId}`);
    revalidatePath("/leads");

    if (outcome.status === "analyzed") {
      return { status: "success", message: `Análise gerada. Score ${outcome.analysis.score}.` };
    }
    if (outcome.reason === "current") {
      return {
        status: "success",
        message: "Os dados não mudaram desde a última análise - nenhum token foi gasto.",
      };
    }
    return { status: "error", message: outcome.message };
  } catch (error) {
    logger.error("falha ao analisar oportunidade", { code: toAppError(error).code });
    return { status: "error", message: userMessage(error) };
  }
}

/**
 * A análise em lote não mora aqui: ela precisa devolver progresso enquanto
 * roda, e uma Server Action só responde no fim. Ela vive em
 * `POST /api/leads/analyze`, que devolve um resultado por linha.
 */

const notesSchema = z.object({
  leadId: z.string().min(1),
  notes: z.string().trim().max(5_000),
});

/** Anotações do lead (CRM). */
export async function saveLeadNotesAction(
  _previous: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  const parsed = notesSchema.safeParse({
    leadId: formData.get("leadId"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { status: "error", message: "Anotação inválida." };

  try {
    await updateLeadNotes(parsed.data.leadId, parsed.data.notes || null);
    revalidatePath(`/leads/${parsed.data.leadId}`);
    return { status: "success", message: "Anotações salvas." };
  } catch (error) {
    logger.error("falha ao salvar anotações");
    return { status: "error", message: userMessage(error) };
  }
}
