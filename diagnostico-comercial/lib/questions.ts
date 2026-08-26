export type OptionId = "A" | "B" | "C" | "D";

export interface QuizOption {
  id: OptionId;
  label: string;
  points: number;
}

export interface Question {
  id: number;
  /** Pilar comercial avaliado — usado para apontar os gargalos no diagnóstico. */
  pillar: string;
  title: string;
  options: QuizOption[];
}

export const QUESTIONS: Question[] = [
  {
    id: 1,
    pillar: "Velocidade de resposta",
    title:
      "Quando um novo cliente chama no WhatsApp, quanto tempo você costuma levar para responder?",
    options: [
      { id: "A", label: "Até 5 minutos", points: 4 },
      { id: "B", label: "Até 30 minutos", points: 3 },
      { id: "C", label: "Algumas horas", points: 2 },
      { id: "D", label: "Só respondo quando tenho tempo", points: 1 },
    ],
  },
  {
    id: 2,
    pillar: "Abordagem inicial",
    title: 'Quando o cliente pergunta apenas "Quanto custa?", você:',
    options: [
      { id: "A", label: "Já manda o preço", points: 1 },
      { id: "B", label: "Pergunta o que ele procura antes", points: 4 },
      { id: "C", label: "Manda preço + algumas informações", points: 2 },
      { id: "D", label: "Pergunta só o nome", points: 3 },
    ],
  },
  {
    id: 3,
    pillar: "Diagnóstico da necessidade",
    title: "Você faz perguntas para entender a necessidade do cliente?",
    options: [
      { id: "A", label: "Sempre", points: 4 },
      { id: "B", label: "Na maioria das vezes", points: 3 },
      { id: "C", label: "Às vezes", points: 2 },
      { id: "D", label: "Quase nunca", points: 1 },
    ],
  },
  {
    id: 4,
    pillar: "Follow-up",
    title: "Depois de enviar uma proposta/orçamento, você faz follow-up?",
    options: [
      { id: "A", label: "Tenho uma sequência definida", points: 4 },
      { id: "B", label: "Faço quando lembro", points: 2 },
      { id: "C", label: "Espero o cliente responder", points: 1 },
      { id: "D", label: "Só entro em contato se ele demonstrar interesse", points: 1 },
    ],
  },
  {
    id: 5,
    pillar: "Condução da decisão",
    title: 'Quando o cliente diz "vou pensar", você:',
    options: [
      { id: "A", label: "Pergunta o que ele precisa avaliar", points: 4 },
      { id: "B", label: 'Diz "beleza, qualquer coisa estou à disposição"', points: 1 },
      { id: "C", label: "Oferece mandar mais informações", points: 2 },
      { id: "D", label: "Pergunta quando pode retornar", points: 3 },
    ],
  },
  {
    id: 6,
    pillar: "Gestão do funil",
    title: "Você sabe exatamente em qual etapa cada lead está?",
    options: [
      { id: "A", label: "Sim, uso CRM ou algum controle", points: 4 },
      { id: "B", label: "Tenho uma planilha/anotações", points: 3 },
      { id: "C", label: "Fica praticamente tudo no WhatsApp", points: 2 },
      { id: "D", label: "Vou lembrando de cabeça", points: 1 },
    ],
  },
  {
    id: 7,
    pillar: "Cobertura de oportunidades",
    title:
      "Quantos contatos interessados costumam ficar sem resposta ou sem acompanhamento?",
    options: [
      { id: "A", label: "Praticamente nenhum", points: 4 },
      { id: "B", label: "Poucos", points: 3 },
      { id: "C", label: "Vários", points: 2 },
      { id: "D", label: "Não faço ideia", points: 1 },
    ],
  },
  {
    id: 8,
    pillar: "Processo de atendimento",
    title: "Sua equipe possui um roteiro/processo de atendimento?",
    options: [
      { id: "A", label: "Sim, mas permite personalização", points: 4 },
      { id: "B", label: "Temos algumas orientações", points: 3 },
      { id: "C", label: "Cada vendedor atende de um jeito", points: 2 },
      { id: "D", label: "Não temos processo", points: 1 },
    ],
  },
  {
    id: 9,
    pillar: "Negociação e objeções",
    title: "Quando o cliente apresenta uma objeção sobre preço, você:",
    options: [
      { id: "A", label: "Investiga o motivo da objeção e trabalha o valor", points: 4 },
      { id: "B", label: "Oferece desconto", points: 2 },
      { id: "C", label: "Tenta explicar novamente o produto", points: 3 },
      { id: "D", label: "Aceita e encerra a conversa", points: 1 },
    ],
  },
  {
    id: 10,
    pillar: "Métricas e previsibilidade",
    title:
      "Hoje, você sabe quantos leads entram e quantos realmente viram vendas?",
    options: [
      { id: "A", label: "Sim, acompanho esses números", points: 4 },
      { id: "B", label: "Tenho uma estimativa", points: 3 },
      { id: "C", label: "Sei mais ou menos", points: 2 },
      { id: "D", label: "Não acompanho", points: 1 },
    ],
  },
];

export const TOTAL_QUESTIONS = QUESTIONS.length;
export const MAX_SCORE = QUESTIONS.reduce(
  (sum, q) => sum + Math.max(...q.options.map((o) => o.points)),
  0,
);
export const MIN_SCORE = QUESTIONS.reduce(
  (sum, q) => sum + Math.min(...q.options.map((o) => o.points)),
  0,
);

export function getQuestion(id: number): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}
