import { Badge, type Tone } from "@/components/ui/badge";
import {
  LEAD_STATUS_LABELS,
  SCORE_LEVEL_LABELS,
  ScoreLevel,
  WEBSITE_STATUS_LABELS,
  WEBSITE_STATUS_TONE,
  type LeadStatus,
  type WebsiteStatus,
} from "@/types/lead";

/** Situacao do site. O rotulo diz tudo; a cor apenas reforca. */
export function WebsiteBadge({ status }: { status: WebsiteStatus }) {
  return <Badge tone={WEBSITE_STATUS_TONE[status]}>{WEBSITE_STATUS_LABELS[status]}</Badge>;
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

const STATUS_TONE: Record<LeadStatus, Tone> = {
  NEW: "neutral",
  QUALIFIED: "accent",
  CONTACTED: "accent",
  RESPONDED: "accent",
  INTERESTED: "positive",
  CUSTOMER: "positive",
  NOT_INTERESTED: "neutral",
  INVALID: "negative",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{LEAD_STATUS_LABELS[status]}</Badge>;
}
