"use server";

/** Server Actions do lead: status e favorito. Sempre validadas com Zod. */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { userMessage } from "@/lib/errors";
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
  if (!parsed.success) return { status: "error", message: "Status invalido." };

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
  if (!parsed.success) return { status: "error", message: "Lead invalido." };

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

/** Enriquecimento sob demanda: so roda quando o usuario clica. */
export async function enrichLeadAction(
  _previous: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  const parsed = leadIdSchema.safeParse({ leadId: formData.get("leadId") });
  if (!parsed.success) return { status: "error", message: "Lead invalido." };

  try {
    const outcome = await enrichLead(parsed.data.leadId);
    revalidatePath(`/leads/${parsed.data.leadId}`);

    if (outcome.status === "enriched") {
      return { status: "success", message: `Dados encontrados: ${outcome.fields.join(", ")}.` };
    }
    return {
      status: "success",
      message:
        outcome.reason === "recent"
          ? "Este lead ja foi enriquecido recentemente - nada foi consultado."
          : "Nenhum dado novo foi encontrado para este lead.",
    };
  } catch (error) {
    logger.error("falha ao enriquecer");
    return { status: "error", message: userMessage(error) };
  }
}

/** Analise do site sob demanda. */
export async function analyzeWebsiteAction(
  _previous: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  const parsed = leadIdSchema.safeParse({ leadId: formData.get("leadId") });
  if (!parsed.success) return { status: "error", message: "Lead invalido." };

  try {
    const outcome = await analyzeLeadWebsite(parsed.data.leadId);
    revalidatePath(`/leads/${parsed.data.leadId}`);

    if (outcome.status === "analyzed") {
      return {
        status: "success",
        message: outcome.reachable
          ? `Site analisado: ${outcome.issues.length} pontos de melhoria.`
          : "O site nao respondeu - lead marcado como site fora do ar.",
      };
    }
    return {
      status: "success",
      message:
        outcome.reason === "no-website"
          ? "Este lead nao possui site proprio para analisar."
          : "O site ja foi analisado recentemente - nada foi baixado de novo.",
    };
  } catch (error) {
    logger.error("falha ao analisar site");
    return { status: "error", message: userMessage(error) };
  }
}

/** Analise de oportunidade por IA. So roda quando o usuario pede. */
export async function analyzeOpportunityAction(
  _previous: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  const parsed = leadIdSchema.safeParse({ leadId: formData.get("leadId") });
  if (!parsed.success) return { status: "error", message: "Lead invalido." };

  try {
    const outcome = await analyzeLeadOpportunity(parsed.data.leadId);
    revalidatePath(`/leads/${parsed.data.leadId}`);

    return {
      status: "success",
      message:
        outcome.status === "analyzed"
          ? "Analise gerada."
          : "Os dados nao mudaram desde a ultima analise - nenhum token foi gasto.",
    };
  } catch (error) {
    logger.error("falha ao analisar oportunidade");
    return { status: "error", message: userMessage(error) };
  }
}

const notesSchema = z.object({
  leadId: z.string().min(1),
  notes: z.string().trim().max(5_000),
});

/** Anotacoes do lead (CRM). */
export async function saveLeadNotesAction(
  _previous: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  const parsed = notesSchema.safeParse({
    leadId: formData.get("leadId"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { status: "error", message: "Anotacao invalida." };

  try {
    await updateLeadNotes(parsed.data.leadId, parsed.data.notes || null);
    revalidatePath(`/leads/${parsed.data.leadId}`);
    return { status: "success", message: "Anotacoes salvas." };
  } catch (error) {
    logger.error("falha ao salvar anotacoes");
    return { status: "error", message: userMessage(error) };
  }
}
