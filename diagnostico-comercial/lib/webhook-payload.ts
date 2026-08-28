import { QUESTIONS } from "./questions";
import type { Lead } from "./types";

/**
 * Monta o payload no mesmo formato que o Respondi envia, para reaproveitar
 * o fluxo já configurado no n8n sem precisar remontar o mapeamento.
 *
 * Estrutura: { form, respondent: { answers, raw_answers, respondent_utms } }
 */

type TipoPergunta = "text" | "phone" | "email" | "radio";

interface PerguntaBruta {
  question: {
    question_title: string;
    question_id: string;
    question_type: TipoPergunta;
  };
  answer: string | string[] | { country: string; phone: string };
}

const TITULOS = {
  nome: "Qual o seu nome e sobrenome?",
  telefone: "Qual o seu telefone para contato? (DDD) + Whatsapp",
  email: "Qual o seu melhor e-mail?",
  instagram: "Qual o @ do Instagram da sua empresa?",
  cargo: "Qual seu cargo dentro da empresa?",
  faturamento: "Qual o faturamento médio mensal da sua empresa?",
} as const;

/** "2026-07-09 19:21:12" no horário de Brasília, como o Respondi envia. */
function dataBrasilia(iso: string): string {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date(iso))
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});

  return `${partes.year}-${partes.month}-${partes.day} ${partes.hour}:${partes.minute}:${partes.second}`;
}

/** "(31) 98518-1164" -> { country: "55", phone: "31985181164" } */
function telefone(whatsapp: string): { country: string; phone: string } {
  return { country: "55", phone: whatsapp.replace(/\D/g, "") };
}

export function buildRespondiPayload(lead: Lead) {
  const answers: Record<string, string> = {
    [TITULOS.nome]: lead.name,
    [TITULOS.telefone]: `55 ${lead.whatsapp.replace(/\D/g, "")}`,
    [TITULOS.email]: lead.email,
    [TITULOS.instagram]: lead.instagram,
    [TITULOS.cargo]: lead.cargo,
    [TITULOS.faturamento]: lead.faturamento,
  };

  const raw_answers: PerguntaBruta[] = [
    {
      question: { question_title: TITULOS.nome, question_id: "nome", question_type: "text" },
      answer: lead.name,
    },
    {
      question: {
        question_title: TITULOS.telefone,
        question_id: "telefone",
        question_type: "phone",
      },
      answer: telefone(lead.whatsapp),
    },
    {
      question: { question_title: TITULOS.email, question_id: "email", question_type: "email" },
      answer: lead.email,
    },
    {
      question: {
        question_title: TITULOS.instagram,
        question_id: "instagram",
        question_type: "text",
      },
      answer: lead.instagram,
    },
    {
      question: { question_title: TITULOS.cargo, question_id: "cargo", question_type: "radio" },
      answer: [lead.cargo],
    },
    {
      question: {
        question_title: TITULOS.faturamento,
        question_id: "faturamento",
        question_type: "radio",
      },
      answer: [lead.faturamento],
    },
  ];

  // As 10 perguntas do diagnóstico entram na sequência.
  for (const pergunta of QUESTIONS) {
    const resposta = lead.answers.find((a) => a.question_id === pergunta.id);
    if (!resposta) continue;

    answers[pergunta.title] = resposta.answer_label;
    raw_answers.push({
      question: {
        question_title: pergunta.title,
        question_id: `p${pergunta.id}`,
        question_type: "radio",
      },
      answer: [resposta.answer_label],
    });
  }

  return {
    form: {
      form_name: process.env.WEBHOOK_FORM_NAME || "DIAGNÓSTICO DO ATENDIMENTO COMERCIAL",
      form_id: process.env.WEBHOOK_FORM_ID || "diagnostico-comercial",
    },
    respondent: {
      status: "completed",
      date: dataBrasilia(lead.created_at),
      score: lead.score,
      respondent_id: lead.id,
      answers,
      raw_answers,
      respondent_utms: {
        utm_source: lead.utm_source ?? null,
        utm_medium: lead.utm_medium ?? null,
        utm_campaign: lead.utm_campaign ?? null,
        utm_term: lead.utm_term ?? null,
        utm_content: lead.utm_content ?? null,
        gclid: lead.gclid ?? null,
        fbclid: lead.fbclid ?? null,
      },
    },
    // Campos extras do diagnóstico, fora do formato do Respondi.
    diagnostico: {
      score: lead.score,
      // Soma real das respostas, sem o teto aplicado no diagnóstico.
      score_bruto: lead.score_bruto ?? lead.score,
      max_score: 40,
      tier_id: lead.tier_id,
      tier_label: lead.tier_label,
      respostas: lead.answers,
      referrer: lead.referrer ?? null,
    },
  };
}
