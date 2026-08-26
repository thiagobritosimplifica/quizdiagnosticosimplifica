"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_SCORE, QUESTIONS, TOTAL_QUESTIONS, type OptionId } from "@/lib/questions";
import { CARGOS, FATURAMENTOS } from "@/lib/profile";
import type { DiagnosisResult } from "@/lib/types";
import {
  formatWhatsapp,
  hasErrors,
  validateContact,
  type FieldErrors,
} from "@/lib/validation";
import BrandMark from "./BrandMark";
import ScoreGauge from "./ScoreGauge";

type Step = "hero" | "quiz" | "lead" | "result";
type Answers = Record<string, OptionId>;

const STORAGE_KEY = "simplifica:diagnostico:v1";
const UTM_KEY = "simplifica:utm:v1";
/** Atribuição guardada por 30 dias, para sobreviver a recarregamentos. */
const UTM_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Respostas guardadas no navegador valem por 24h — depois disso o quiz recomeça. */
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000;
const CTA_URL = process.env.NEXT_PUBLIC_CTA_URL || "https://wa.me/5511999999999";
const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME || "Simplifica";

interface UtmData {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  referrer?: string | null;
}

/**
 * Lê a origem do tráfego da URL e guarda no navegador.
 *
 * Sem isso, a atribuição se perde se a pessoa recarregar a página, voltar
 * pelo histórico ou abrir o link de novo sem os parâmetros — situações
 * comuns em campanha e que apagariam a origem de um lead já pago.
 */
function readUtm(): UtmData {
  if (typeof window === "undefined") return {};

  const p = new URLSearchParams(window.location.search);
  const referrer = document.referrer || null;
  const daUrl: UtmData = {
    utm_source: p.get("utm_source"),
    utm_medium: p.get("utm_medium"),
    utm_campaign: p.get("utm_campaign"),
    utm_term: p.get("utm_term"),
    utm_content: p.get("utm_content"),
    gclid: p.get("gclid"),
    fbclid: p.get("fbclid"),
    referrer,
  };

  const temOrigemNaUrl = Object.entries(daUrl).some(
    ([chave, valor]) => chave !== "referrer" && Boolean(valor),
  );

  // Chegou com origem: essa é a atribuição válida e passa a valer daqui pra frente.
  if (temOrigemNaUrl) {
    try {
      window.localStorage.setItem(
        UTM_KEY,
        JSON.stringify({ dados: daUrl, savedAt: Date.now() }),
      );
    } catch {
      /* localStorage indisponível — segue sem guardar */
    }
    return daUrl;
  }

  // Sem origem na URL: recupera a última conhecida, se ainda estiver válida.
  try {
    const raw = window.localStorage.getItem(UTM_KEY);
    if (raw) {
      const salvo = JSON.parse(raw) as { dados?: UtmData; savedAt?: number };
      if (salvo.savedAt && Date.now() - salvo.savedAt < UTM_TTL_MS && salvo.dados) {
        // O referrer é sempre o desta visita, não o guardado.
        return { ...salvo.dados, referrer };
      }
      window.localStorage.removeItem(UTM_KEY);
    }
  } catch {
    /* ignora */
  }

  return daUrl;
}

export default function Diagnostico() {
  const [step, setStep] = useState<Step>("hero");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [locked, setLocked] = useState(false);
  const [restored, setRestored] = useState(false);

  const [contact, setContact] = useState({
    name: "",
    whatsapp: "",
    email: "",
    instagram: "",
    cargo: "",
    faturamento: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);

  const utmRef = useRef<UtmData>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const question = QUESTIONS[index];
  const answeredCount = Object.keys(answers).length;
  const progress = Math.round(((index + 1) / TOTAL_QUESTIONS) * 100);

  /* ---------- Persistência do progresso ---------- */

  useEffect(() => {
    utmRef.current = readUtm();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          answers?: Answers;
          index?: number;
          savedAt?: number;
        };
        const expirado =
          !saved.savedAt || Date.now() - saved.savedAt > STORAGE_TTL_MS;

        if (expirado) {
          window.localStorage.removeItem(STORAGE_KEY);
        } else if (saved.answers && Object.keys(saved.answers).length > 0) {
          setAnswers(saved.answers);
          setIndex(Math.min(saved.index ?? 0, TOTAL_QUESTIONS - 1));
          setRestored(true);
        }
      }
    } catch {
      /* localStorage indisponível — segue sem restaurar */
    }
  }, []);

  useEffect(() => {
    if (step === "result") return;
    try {
      if (Object.keys(answers).length === 0) return;
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ answers, index, savedAt: Date.now() }),
      );
    } catch {
      /* ignora */
    }
  }, [answers, index, step]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const goTo = useCallback((next: Step) => {
    setStep(next);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  /* ---------- Navegação do quiz ---------- */

  const select = useCallback(
    (optionId: OptionId) => {
      if (locked) return;
      setLocked(true);
      setAnswers((prev) => ({ ...prev, [String(question.id)]: optionId }));

      timerRef.current = setTimeout(() => {
        setLocked(false);
        if (index + 1 >= TOTAL_QUESTIONS) {
          setStep("lead");
          window.scrollTo({ top: 0, behavior: "auto" });
        } else {
          setIndex((i) => i + 1);
        }
      }, 150);
    },
    [index, locked, question],
  );

  const back = useCallback(() => {
    if (index === 0) {
      goTo("hero");
      return;
    }
    setIndex((i) => Math.max(0, i - 1));
  }, [index, goTo]);

  // Atalhos de teclado: 1-4 ou A-D.
  useEffect(() => {
    if (step !== "quiz") return;
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toUpperCase();
      const byNumber = ["1", "2", "3", "4"].indexOf(event.key);
      const byLetter = ["A", "B", "C", "D"].indexOf(key);
      const position = byNumber >= 0 ? byNumber : byLetter;
      if (position >= 0 && question.options[position]) {
        event.preventDefault();
        select(question.options[position].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, question, select]);

  const startQuiz = useCallback(() => goTo("quiz"), [goTo]);

  const restart = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignora */
    }
    setAnswers({});
    setIndex(0);
    setResult(null);
    setContact({
      name: "",
      whatsapp: "",
      email: "",
      instagram: "",
      cargo: "",
      faturamento: "",
    });
    setErrors({});
    setServerError(null);
    setRestored(false);
    goTo("hero");
  }, [goTo]);

  /* ---------- Envio ---------- */

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setServerError(null);

      const validation = validateContact(contact);
      setErrors(validation);
      if (hasErrors(validation)) return;

      if (Object.keys(answers).length < TOTAL_QUESTIONS) {
        setServerError("Faltam respostas. Volte e complete o quiz.");
        return;
      }

      setSubmitting(true);
      try {
        const response = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...contact, answers, utm: utmRef.current }),
        });
        const data = await response.json();

        if (!response.ok) {
          if (data.fields) setErrors(data.fields as FieldErrors);
          setServerError(data.error ?? "Não foi possível gerar seu diagnóstico.");
          return;
        }

        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignora */
        }
        setResult(data as DiagnosisResult);
        goTo("result");
      } catch {
        setServerError("Falha de conexão. Verifique sua internet e tente novamente.");
      } finally {
        setSubmitting(false);
      }
    },
    [answers, contact, goTo],
  );

  /* ================================================================== */
  /* HERO                                                                */
  /* ================================================================== */

  if (step === "hero") {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-7 sm:px-8 sm:pt-10">
        <header className="flex items-center justify-between">
          <BrandMark label={BRAND} height={40} priority />
          <span className="chip hidden px-3.5 py-1.5 text-xs text-mist-400 sm:inline-flex">
            Diagnóstico comercial
          </span>
        </header>

        <div className="mt-14 grid gap-16 lg:mt-20 lg:grid-cols-[1.06fr_0.94fr] lg:items-center lg:gap-10">
          <div>
            <span className="chip animate-fade-up inline-flex items-center gap-2 px-3.5 py-1.5 text-[13px] text-brand-300">
              <span className="animate-pulse-soft h-1.5 w-1.5 rounded-full bg-brand-400" />
              Gratuito · 10 perguntas
            </span>

            <h1 className="animate-fade-up delay-1 mt-6 text-[2.15rem] font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Seu atendimento comercial está fazendo você{" "}
              <span className="gradient-text">perder vendas?</span>
            </h1>

            <p className="animate-fade-up delay-2 mt-6 max-w-xl text-[1.05rem] leading-relaxed text-mist-300 sm:text-lg">
              Responda 10 perguntas rápidas e descubra se o seu atendimento está
              convertendo oportunidades em clientes ou deixando dinheiro na mesa.
            </p>

            <div className="animate-fade-up delay-3 mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={startQuiz}
                className="btn-primary w-full text-[15px] uppercase sm:w-auto"
              >
                {restored ? "Continuar meu diagnóstico" : "Fazer meu diagnóstico gratuito"}
                <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M4 10h11m0 0-4.2-4.2M15 10l-4.2 4.2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <p className="flex items-center gap-2 text-sm text-mist-400">
                <svg viewBox="0 0 20 20" className="h-4 w-4 text-brand-400" aria-hidden="true">
                  <path
                    d="m4.5 10.5 3.6 3.5L15.5 6.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Leva menos de 3 minutos
              </p>
            </div>

            {restored && (
              <p className="animate-fade-in mt-4 text-sm text-mist-500">
                Encontramos {answeredCount} resposta(s) salva(s) neste navegador.{" "}
                <button
                  type="button"
                  onClick={restart}
                  className="text-brand-300 underline underline-offset-4 hover:text-brand-200"
                >
                  Começar do zero
                </button>
              </p>
            )}

            <dl className="animate-fade-up delay-4 mt-12 grid max-w-lg grid-cols-3 gap-4 border-t border-white/10 pt-7">
              {[
                { value: "10", label: "perguntas objetivas" },
                { value: "40", label: "pontos de avaliação" },
                { value: "4", label: "níveis de diagnóstico" },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-2xl font-semibold text-mist-100">{item.value}</dt>
                  <dd className="mt-1 text-[13px] leading-snug text-mist-500">
                    {item.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <HeroPreview />
        </div>

        <section className="mt-24 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "Velocidade e abordagem",
              text: "Quanto tempo você leva para responder e como conduz o primeiro contato.",
            },
            {
              title: "Follow-up e objeções",
              text: "O que acontece depois da proposta e como você trata o vou pensar.",
            },
            {
              title: "Processo e previsibilidade",
              text: "Se você controla o funil e sabe quantos leads viram venda.",
            },
          ].map((item, i) => (
            <article key={item.title} className="card animate-fade-up p-6">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-brand-300">
                {i + 1}
              </span>
              <h3 className="mt-4 text-[15px] font-semibold text-mist-100">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-mist-400">{item.text}</p>
            </article>
          ))}
        </section>

        <div className="mt-16 flex justify-center">
          <button
            type="button"
            onClick={startQuiz}
            className="btn-primary text-[15px] uppercase"
          >
            Fazer meu diagnóstico gratuito
          </button>
        </div>

        <SiteFooter />
      </main>
    );
  }

  /* ================================================================== */
  /* QUIZ                                                                */
  /* ================================================================== */

  if (step === "quiz") {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 pb-20 sm:px-8">
        <div className="sticky top-0 z-20 -mx-5 rounded-b-3xl border-x border-b border-[rgba(157,178,255,0.12)] bg-ink-900/92 px-5 pb-5 pt-5 shadow-[0_18px_40px_-28px_rgba(3,6,18,0.95)] backdrop-blur-md sm:-mx-8 sm:px-8">
          <div className="flex items-center justify-between">
            <BrandMark label={BRAND} />
            <span className="text-[13px] font-medium tabular-nums text-mist-400">
              Pergunta {index + 1} de {TOTAL_QUESTIONS}
            </span>
          </div>
          <div
            className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso do diagnóstico"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-300 to-iris-500 transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <section key={question.id} className="card animate-slide-in mt-8 p-6 sm:p-9">
          <span className="chip inline-flex px-3 py-1 text-[11px] uppercase tracking-wider text-brand-300">
            {question.pillar}
          </span>
          <h2 className="mt-5 text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
            {question.title}
          </h2>

          <div className="mt-7 grid gap-3">
            {question.options.map((option) => {
              const selected = answers[String(question.id)] === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className="option"
                  data-selected={selected}
                  aria-pressed={selected}
                  onClick={() => select(option.id)}
                >
                  <span className="option-key">{option.id}</span>
                  <span className="text-[15px] leading-snug text-mist-100">
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="mt-6 flex items-center justify-between">
          <button type="button" onClick={back} className="btn-ghost text-sm">
            <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
              <path
                d="M16 10H5m0 0 4.2-4.2M5 10l4.2 4.2"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Voltar
          </button>
          <span className="hidden text-xs text-mist-500 sm:block">
            Dica: use as teclas 1 a 4 para responder
          </span>
        </div>
      </main>
    );
  }

  /* ================================================================== */
  /* CAPTURA DE LEAD                                                     */
  /* ================================================================== */

  if (step === "lead") {
    return (
      <main className="mx-auto w-full max-w-xl px-5 pb-20 pt-6 sm:px-8 sm:pt-10">
        <BrandMark label={BRAND} />

        <section className="card animate-fade-up mt-8 p-6 sm:p-9">
          <span className="chip inline-flex items-center gap-2 px-3 py-1 text-[11px] uppercase tracking-wider text-brand-300">
            <span className="animate-pulse-soft h-1.5 w-1.5 rounded-full bg-brand-400" />
            10 de 10 respondidas
          </span>

          <h2 className="mt-5 text-2xl font-bold tracking-tight sm:text-[1.75rem]">
            Seu diagnóstico está pronto.
          </h2>
          <p className="mt-2.5 text-[15px] leading-relaxed text-mist-400">
            Preencha seus dados abaixo para liberar seu resultado:
          </p>

          <form onSubmit={submit} className="mt-7 grid gap-4" noValidate>
            <Field
              id="name"
              label="Nome"
              placeholder="Como podemos te chamar?"
              value={contact.name}
              error={errors.name}
              autoComplete="name"
              onChange={(value) => setContact((c) => ({ ...c, name: value }))}
            />
            <Field
              id="whatsapp"
              label="WhatsApp"
              placeholder="(11) 99999-9999"
              value={contact.whatsapp}
              error={errors.whatsapp}
              inputMode="tel"
              autoComplete="tel"
              onChange={(value) =>
                setContact((c) => ({ ...c, whatsapp: formatWhatsapp(value) }))
              }
            />
            <Field
              id="email"
              label="E-mail"
              placeholder="voce@empresa.com.br"
              value={contact.email}
              error={errors.email}
              type="email"
              inputMode="email"
              autoComplete="email"
              onChange={(value) => setContact((c) => ({ ...c, email: value }))}
            />

            <Field
              id="instagram"
              label="Qual @ do seu Instagram?"
              placeholder="@suaempresa"
              value={contact.instagram}
              error={errors.instagram}
              autoComplete="off"
              onChange={(value) => setContact((c) => ({ ...c, instagram: value }))}
            />

            <SelectField
              id="cargo"
              label="Qual seu cargo dentro da empresa?"
              placeholder="Selecione seu cargo"
              value={contact.cargo}
              error={errors.cargo}
              options={CARGOS}
              onChange={(value) => setContact((c) => ({ ...c, cargo: value }))}
            />

            <SelectField
              id="faturamento"
              label="Qual o faturamento médio mensal da sua empresa?"
              placeholder="Selecione uma faixa"
              value={contact.faturamento}
              error={errors.faturamento}
              options={FATURAMENTOS}
              onChange={(value) => setContact((c) => ({ ...c, faturamento: value }))}
            />

            {serverError && (
              <p className="animate-fade-in rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {serverError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary mt-2 w-full text-[15px] uppercase"
            >
              {submitting ? "Gerando seu diagnóstico..." : "Ver meu resultado"}
            </button>

            <p className="text-center text-xs leading-relaxed text-mist-500">
              Ao ver seu resultado, você concorda em receber o diagnóstico e conteúdos
              sobre vendas e atendimento comercial da {BRAND}. Nada de spam.
            </p>
          </form>
        </section>

        <button
          type="button"
          onClick={() => {
            setIndex(TOTAL_QUESTIONS - 1);
            goTo("quiz");
          }}
          className="btn-ghost mt-6 text-sm"
        >
          Revisar respostas
        </button>
      </main>
    );
  }

  /* ================================================================== */
  /* RESULTADO                                                           */
  /* ================================================================== */

  if (step === "result" && result) {
    const percentage = Math.round((result.score / result.max_score) * 100);

    return (
      <main className="mx-auto w-full max-w-3xl px-5 pb-20 pt-6 sm:px-8 sm:pt-10">
        <BrandMark label={BRAND} />

        <section className="card animate-fade-up mt-8 overflow-hidden p-6 sm:p-9">
          <p className="text-[11px] uppercase tracking-[0.18em] text-mist-500">
            Seu resultado
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {result.name}
          </h1>

          <div className="mt-8 flex flex-col items-center gap-8 sm:flex-row sm:gap-10">
            <ScoreGauge
              score={result.score}
              max={result.max_score}
              color={result.tier.hex}
            />

            <div className="flex-1 text-center sm:text-left">
              <span
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                style={{
                  background: `${result.tier.hex}1f`,
                  color: result.tier.hex,
                  border: `1px solid ${result.tier.hex}44`,
                }}
              >
                <span aria-hidden="true">{result.tier.emoji}</span>
                {result.tier.label.toUpperCase()}
              </span>

              <div className="mt-6">
                <div className="flex items-center justify-between text-xs text-mist-500">
                  <span>10</span>
                  <span className="tabular-nums">{percentage}% do máximo</span>
                  <span>40</span>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full transition-[width] duration-1000 ease-out"
                    style={{
                      width: `${percentage}%`,
                      background: `linear-gradient(90deg, ${result.tier.hex}99, ${result.tier.hex})`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-9 border-t border-white/10 pt-7">
            <h2 className="text-lg font-semibold tracking-tight">
              O que isso significa?
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-mist-300">
              {result.tier.description}
            </p>
          </div>
        </section>

        {result.bottlenecks.length > 0 && (
          <section className="card animate-fade-up delay-1 mt-5 p-6 sm:p-9">
            <h2 className="text-lg font-semibold tracking-tight">
              Seus principais gargalos
            </h2>
            <p className="mt-2 text-sm text-mist-500">
              Os pontos que mais estão custando conversão hoje.
            </p>
            <ul className="mt-6 grid gap-3">
              {result.bottlenecks.map((item) => (
                <li
                  key={item.question_id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-mist-100">
                      {item.pillar}
                    </span>
                    <span className="chip px-2.5 py-1 text-[11px] tabular-nums text-mist-400">
                      {item.points}/4
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-mist-400">
                    Sua resposta: {item.answer_label}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card animate-fade-up delay-2 mt-5 p-6 sm:p-9">
          <h2 className="text-lg font-semibold tracking-tight">Radiografia por pilar</h2>
          <ul className="mt-6 grid gap-3.5">
            {result.answers.map((answer) => (
              <li key={answer.question_id} className="flex items-center gap-4">
                <span className="w-[8.5rem] flex-shrink-0 text-[13px] leading-tight text-mist-400 sm:w-52">
                  {answer.pillar}
                </span>
                <span className="flex flex-1 gap-1.5">
                  {[1, 2, 3, 4].map((level) => (
                    <span
                      key={level}
                      className="h-2 flex-1 rounded-full"
                      style={{ background: barColor(level, answer.points) }}
                    />
                  ))}
                </span>
                <span className="w-6 flex-shrink-0 text-right text-[13px] tabular-nums text-mist-500">
                  {answer.points}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card animate-fade-up delay-3 mt-5 border-brand-400/25 bg-gradient-to-br from-brand-500/15 to-iris-500/15 p-7 text-center sm:p-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-brand-300">
            Seu próximo passo
          </p>
          <h2 className="mx-auto mt-4 max-w-xl text-xl font-bold leading-snug tracking-tight sm:text-2xl">
            Quer descobrir exatamente onde seu atendimento está perdendo vendas e como
            aumentar a conversão dos seus leads?
          </h2>
          <a
            href={CTA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-8 w-full text-[15px] uppercase sm:w-auto"
          >
            Quero melhorar meu atendimento
          </a>
          <p className="mt-5 text-xs text-mist-500">
            Nossa equipe entra em contato pelo WhatsApp informado.
          </p>
        </section>

        <div className="mt-8 flex justify-center">
          <button type="button" onClick={restart} className="btn-ghost text-sm">
            Refazer diagnóstico
          </button>
        </div>

        <SiteFooter />
      </main>
    );
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Subcomponentes                                                      */
/* ------------------------------------------------------------------ */

function barColor(level: number, points: number): string {
  if (level > points) return "rgba(255,255,255,0.08)";
  if (points >= 4) return "#10B981";
  if (points === 3) return "#5A7CFF";
  if (points === 2) return "#F59E0B";
  return "#F43F5E";
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  error?: string;
  type?: string;
  inputMode?: "text" | "tel" | "email";
  autoComplete?: string;
  onChange: (value: string) => void;
}

function Field({
  id,
  label,
  value,
  placeholder,
  error,
  type = "text",
  inputMode,
  autoComplete,
  onChange,
}: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[13px] font-medium text-mist-300">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        className="field"
        placeholder={placeholder}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <FieldError id={`${id}-error`} message={error} />}
    </div>
  );
}

function FieldError({ id, message }: { id?: string; message: string }) {
  return (
    <p id={id} className="mt-1.5 text-[13px] text-rose-300">
      {message}
    </p>
  );
}

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  error?: string;
  options: readonly string[];
  onChange: (value: string) => void;
}

function SelectField({
  id,
  label,
  value,
  placeholder,
  error,
  options,
  onChange,
}: SelectFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[13px] font-medium text-mist-300">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          name={id}
          className="field field-select"
          value={value}
          data-placeholder={value === "" ? "true" : "false"}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 20 20"
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500"
          aria-hidden="true"
        >
          <path
            d="m6 8 4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {error && <FieldError id={`${id}-error`} message={error} />}
    </div>
  );
}

function HeroPreview() {
  const pillars = [
    { label: "Velocidade de resposta", points: 3 },
    { label: "Follow-up", points: 2 },
    { label: "Gestão do funil", points: 1 },
    { label: "Métricas", points: 2 },
  ];

  return (
    <div className="animate-fade-up delay-3 relative" aria-hidden="true">
      <div className="card p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-[0.18em] text-mist-500">
            Exemplo de resultado
          </span>
          <span className="chip px-2.5 py-1 text-[11px] text-mist-400">40 pts</span>
        </div>

        <div className="mt-6 flex items-center gap-5">
          <ScoreGauge score={24} max={MAX_SCORE} color="#F59E0B" size={132} />
          <div>
            <span
              className="inline-flex rounded-full px-3 py-1.5 text-[12px] font-semibold"
              style={{
                background: "#F59E0B1f",
                color: "#F59E0B",
                border: "1px solid #F59E0B44",
              }}
            >
              Atendimento reativo
            </span>
            <p className="mt-3 text-[13px] leading-relaxed text-mist-400">
              Bons hábitos, mas ainda com falhas em follow-up e processo.
            </p>
          </div>
        </div>

        <ul className="mt-7 grid gap-3 border-t border-white/10 pt-6">
          {pillars.map((item) => (
            <li key={item.label} className="flex items-center gap-3">
              <span className="w-32 text-[12px] text-mist-500">{item.label}</span>
              <span className="flex flex-1 gap-1">
                {[1, 2, 3, 4].map((level) => (
                  <span
                    key={level}
                    className="h-1.5 flex-1 rounded-full"
                    style={{ background: barColor(level, item.points) }}
                  />
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-20 flex flex-col items-center gap-3 border-t border-white/10 pt-8 text-center text-xs text-mist-500 sm:flex-row sm:justify-between sm:text-left">
      <span>
        {new Date().getFullYear()} {BRAND} — Diagnóstico do Atendimento Comercial.
      </span>
      <a href="/admin" className="transition-colors hover:text-mist-300">
        Área da equipe
      </a>
    </footer>
  );
}
