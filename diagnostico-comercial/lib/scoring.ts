import { MAX_SCORE, QUESTIONS, type OptionId, type Question } from "./questions";

export type TierId = "vazando" | "reativo" | "estruturado" | "maquina";

export interface Tier {
  id: TierId;
  emoji: string;
  label: string;
  min: number;
  max: number;
  description: string;
  /** Cor de destaque usada no resultado e no painel. */
  hex: string;
}

export const TIERS: Tier[] = [
  {
    id: "vazando",
    emoji: "🚨",
    label: "Atendimento vazando vendas",
    min: 10,
    max: 19,
    description:
      "Seu atendimento provavelmente está perdendo oportunidades que já chegaram até você. O problema pode não estar na geração de leads, mas na forma como eles são conduzidos até a decisão.",
    hex: "#F43F5E",
  },
  {
    id: "reativo",
    emoji: "⚠️",
    label: "Atendimento reativo",
    min: 20,
    max: 29,
    description:
      "Você já possui alguns bons hábitos comerciais, mas ainda existem falhas importantes em abordagem, follow-up e processo. Pequenos ajustes podem gerar um impacto significativo nas vendas.",
    hex: "#F59E0B",
  },
  {
    id: "estruturado",
    emoji: "📈",
    label: "Atendimento comercial estruturado",
    min: 30,
    max: 36,
    description:
      "Seu processo está acima da média. Você já entende a importância de atendimento, acompanhamento e processo comercial. Agora o próximo passo é otimizar conversão e escala.",
    hex: "#5A7CFF",
  },
  {
    id: "maquina",
    emoji: "🔥",
    label: "Máquina comercial",
    min: 37,
    max: 40,
    description:
      "Seu atendimento possui processos bem definidos, acompanhamento e foco em conversão. O próximo nível é transformar seus dados em previsibilidade comercial e aumentar a performance da equipe.",
    hex: "#10B981",
  },
];

export function getTier(id: TierId): Tier {
  return TIERS.find((t) => t.id === id) ?? TIERS[0];
}

export function classify(score: number): Tier {
  const tier = TIERS.find((t) => score >= t.min && score <= t.max);
  if (tier) return tier;
  // Fora das faixas previstas (não deve acontecer): trava nos extremos.
  return score < TIERS[0].min ? TIERS[0] : TIERS[TIERS.length - 1];
}

/** Mapa de respostas no formato { "1": "A", "2": "C", ... }. */
export type AnswerMap = Record<string, OptionId>;

export interface ScoredAnswer {
  question_id: number;
  question: string;
  pillar: string;
  answer_id: OptionId;
  answer_label: string;
  points: number;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  answers: ScoredAnswer[];
  score: number;
}

/**
 * Valida e pontua as respostas. A pontuação é sempre recalculada aqui
 * (servidor) — o valor enviado pelo cliente nunca é considerado.
 */
export function scoreAnswers(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const answers: ScoredAnswer[] = [];
  const map = (raw ?? {}) as Record<string, unknown>;

  for (const question of QUESTIONS) {
    const picked = map[String(question.id)];
    const option = question.options.find((o) => o.id === picked);
    if (!option) {
      errors.push(`Resposta ausente ou inválida na pergunta ${question.id}.`);
      continue;
    }
    answers.push({
      question_id: question.id,
      question: question.title,
      pillar: question.pillar,
      answer_id: option.id,
      answer_label: option.label,
      points: option.points,
    });
  }

  const score = answers.reduce((sum, a) => sum + a.points, 0);
  return { ok: errors.length === 0, errors, answers, score };
}

/** Os pontos mais fracos do atendimento — usados na seção "principais gargalos". */
export function findBottlenecks(answers: ScoredAnswer[], limit = 3): ScoredAnswer[] {
  return [...answers]
    .sort((a, b) => a.points - b.points || a.question_id - b.question_id)
    .filter((a) => a.points <= 3)
    .slice(0, limit);
}

export function scorePercentage(score: number): number {
  return Math.round((score / MAX_SCORE) * 100);
}

export function questionById(id: number): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}
