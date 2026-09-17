import { Badge, type Tone } from "@/components/ui/badge";
import {
  ENRICHMENT_STATUS_LABELS,
  LEAD_STATUS_LABELS,
  OPPORTUNITY_LABELS,
  SCORE_LEVEL_LABELS,
  ScoreLevel,
  WEBSITE_QUALITY_LABELS,
  WEBSITE_QUALITY_TONE,
  WEBSITE_STATUS_HINTS,
  WEBSITE_STATUS_LABELS,
  WEBSITE_STATUS_TONE,
  WHATSAPP_STATUS_HINTS,
  WHATSAPP_STATUS_LABELS,
  WHATSAPP_STATUS_TONE,
  leadSourceLabel,
  type EnrichmentStatus,
  type LeadStatus,
  type WebsiteQuality,
  type WebsiteStatus,
  type WhatsappStatus,
} from "@/types/lead";

/** Situação do site. O rótulo diz tudo; a cor apenas reforça. */
export function WebsiteBadge({ status }: { status: WebsiteStatus }) {
  return (
    <Badge tone={WEBSITE_STATUS_TONE[status]} title={WEBSITE_STATUS_HINTS[status]}>
      {WEBSITE_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Confirmado, possível (só celular) ou não encontrado. */
export function WhatsappBadge({ status }: { status: WhatsappStatus }) {
  return (
    <Badge tone={WHATSAPP_STATUS_TONE[status]} title={WHATSAPP_STATUS_HINTS[status]}>
      {WHATSAPP_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Fonte que descobriu o lead. */
export function SourceBadge({ provider }: { provider: string }) {
  return <Badge tone="accent">{leadSourceLabel(provider)}</Badge>;
}

const ENRICHMENT_TONE: Record<EnrichmentStatus, Tone> = {
  PENDING: "neutral",
  COMPLETED: "positive",
  PARTIAL: "warning",
  FAILED: "negative",
};

export function EnrichmentBadge({ status }: { status: EnrichmentStatus }) {
  return <Badge tone={ENRICHMENT_TONE[status]}>{ENRICHMENT_STATUS_LABELS[status]}</Badge>;
}

const SCORE_TONE: Record<ScoreLevel, Tone> = {
  HIGH: "positive",
  MEDIUM: "warning",
  LOW: "neutral",
};

export function ScoreBadge({ score, level }: { score: number; level: ScoreLevel }) {
  return (
    <Badge tone={SCORE_TONE[level]}>
      <span className="tabular-nums">{score}</span>
      <span className="text-[0.95em] opacity-80">· {SCORE_LEVEL_LABELS[level]}</span>
    </Badge>
  );
}

/**
 * Score da IA. Usa a mesma escala de cor do lead score, mas o rótulo diz
 * "oportunidade" para não se confundir com a nota de regras fixas.
 */
export function AiScoreBadge({
  score,
  opportunity,
}: {
  score: number;
  opportunity: ScoreLevel;
}) {
  return (
    <Badge tone={SCORE_TONE[opportunity]} title="Nota atribuída pela análise por IA">
      <span className="tabular-nums">{score}</span>
      <span className="text-[0.95em] opacity-80">· {OPPORTUNITY_LABELS[opportunity]}</span>
    </Badge>
  );
}

/** Qualidade aparente do site. "Não verificada" enquanto ninguém baixou a página. */
export function WebsiteQualityBadge({ quality }: { quality: WebsiteQuality }) {
  return (
    <Badge
      tone={WEBSITE_QUALITY_TONE[quality]}
      title={
        quality === "UNKNOWN"
          ? "O site ainda não foi analisado - nenhuma afirmação sobre ele foi feita."
          : "Derivada da análise técnica do site, não da opinião do modelo."
      }
    >
      Site: {WEBSITE_QUALITY_LABELS[quality]}
    </Badge>
  );
}

const STATUS_TONE: Record<LeadStatus, Tone> = {
  NEW: "neutral",
  QUALIFIED: "accent",
  CONTACTED: "accent",
  RESPONDED: "accent",
  INTERESTED: "positive",
  PROPOSAL_SENT: "positive",
  CLIENT: "positive",
  DISCARDED: "neutral",
  INVALID: "negative",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{LEAD_STATUS_LABELS[status]}</Badge>;
}
