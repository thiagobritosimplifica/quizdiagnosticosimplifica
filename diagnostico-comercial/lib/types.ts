import type { ScoredAnswer, TierId } from "./scoring";

export interface LeadInput {
  name: string;
  whatsapp: string;
  email: string;
  instagram: string;
  cargo: string;
  faturamento: string;
  consent: boolean;
  answers: ScoredAnswer[];
  score: number;
  tier_id: TierId;
  tier_label: string;
  /** Origem de tráfego — preparado para Meta Ads / Google Ads. */
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  /** Identificadores de clique de anúncio (Google Ads e Meta Ads). */
  gclid?: string | null;
  fbclid?: string | null;
  referrer?: string | null;
  user_agent?: string | null;
}

export interface Lead extends LeadInput {
  id: string;
  created_at: string;
}

export interface LeadFilters {
  tier?: string;
  cargo?: string;
  faturamento?: string;
  scoreMin?: number;
  scoreMax?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface DiagnosisResult {
  id: string;
  name: string;
  score: number;
  max_score: number;
  tier: {
    id: TierId;
    emoji: string;
    label: string;
    description: string;
    hex: string;
  };
  answers: ScoredAnswer[];
  bottlenecks: ScoredAnswer[];
  created_at: string;
}
