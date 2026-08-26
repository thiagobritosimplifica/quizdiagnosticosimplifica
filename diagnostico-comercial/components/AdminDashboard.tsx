"use client";

import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { formatDateBR, formatTimeBR } from "@/lib/format";
import { MAX_SCORE } from "@/lib/questions";
import { CARGOS, FATURAMENTOS } from "@/lib/profile";
import { TIERS } from "@/lib/scoring";
import type { Stats } from "@/lib/stats";
import type { Lead } from "@/lib/types";
import BrandMark from "./BrandMark";

interface Payload {
  storage: "sheets" | "local";
  leads: Lead[];
  stats: Stats;
  totalGeral: number;
}

interface FiltersState {
  search: string;
  tier: string;
  cargo: string;
  faturamento: string;
  scoreMin: string;
  scoreMax: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: FiltersState = {
  search: "",
  tier: "todos",
  cargo: "todos",
  faturamento: "todos",
  scoreMin: "",
  scoreMax: "",
  dateFrom: "",
  dateTo: "",
};

function buildQuery(filters: FiltersState): string {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.tier && filters.tier !== "todos") params.set("tier", filters.tier);
  if (filters.cargo && filters.cargo !== "todos") params.set("cargo", filters.cargo);
  if (filters.faturamento && filters.faturamento !== "todos")
    params.set("faturamento", filters.faturamento);
  if (filters.scoreMin) params.set("scoreMin", filters.scoreMin);
  if (filters.scoreMax) params.set("scoreMax", filters.scoreMax);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  return params.toString();
}

function tierColor(tierId: string): string {
  return TIERS.find((t) => t.id === tierId)?.hex ?? "#6B7690";
}

export default function AdminDashboard() {
  const router = useRouter();
  const [filters, setFilters] = useState<FiltersState>(EMPTY_FILTERS);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = useMemo(() => buildQuery(filters), [filters]);

  const load = useCallback(
    async (qs: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/leads?${qs}`, { cache: "no-store" });
        if (response.status === 401) {
          router.replace("/admin/login");
          return;
        }
        const payload = await response.json();
        if (!response.ok) {
          setError(payload.error ?? "Falha ao carregar os dados.");
          return;
        }
        setData(payload as Payload);
      } catch {
        setError("Falha de conexão com o servidor.");
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    const timer = setTimeout(() => load(query), 250);
    return () => clearTimeout(timer);
  }, [query, load]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  function update(patch: Partial<FiltersState>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  const leads = data?.leads ?? [];
  const stats = data?.stats;
  const storageOk = data?.storage === "sheets";
  const hasFilters = query.length > 0;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BrandMark />
          <span className="hidden h-6 w-px bg-white/10 sm:block" />
          <div className="hidden sm:block">
            <h1 className="text-[15px] font-semibold tracking-tight">
              Painel de diagnósticos
            </h1>
            <p className="text-xs text-mist-500">Atendimento comercial</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="chip px-3 py-1.5 text-[11px] text-mist-400"
            title={
              storageOk
                ? "Gravando na planilha do Google Sheets"
                : "SHEETS_WEBAPP_URL não configurada — gravando no arquivo local .data/leads.json"
            }
          >
            <span
              className="mr-2 inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: storageOk ? "#10B981" : "#F59E0B",
              }}
            />
            {storageOk ? "Google Sheets" : "Armazenamento local"}
          </span>
          <button type="button" onClick={logout} className="btn-ghost text-sm">
            Sair
          </button>
        </div>
      </header>

      {/* ---------- Indicadores ---------- */}

      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Total de diagnósticos"
          value={stats ? String(stats.totalDiagnostics) : "—"}
          hint={
            data && hasFilters ? `${data.totalGeral} no total sem filtros` : undefined
          }
        />
        <StatCard
          label="Total de leads"
          value={stats ? String(stats.totalLeads) : "—"}
          hint="e-mails únicos"
        />
        <StatCard
          label="Média de pontuação"
          value={stats ? stats.averageScore.toFixed(1).replace(".", ",") : "—"}
          hint={`de ${MAX_SCORE} pontos`}
        />
      </section>

      <section className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(stats?.tiers ?? TIERS.map((t) => ({ ...t, count: 0, percentage: 0 }))).map(
          (tier) => (
            <article key={tier.id} className="card p-5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[13px] leading-snug text-mist-400">
                  {tier.emoji} {tier.label}
                </span>
              </div>
              <p
                className="mt-3 text-2xl font-semibold tabular-nums"
                style={{ color: tier.hex }}
              >
                {stats ? `${tier.percentage.toFixed(1).replace(".", ",")}%` : "—"}
              </p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${stats ? tier.percentage : 0}%`,
                    background: tier.hex,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-mist-500">
                {stats ? `${tier.count} diagnóstico(s)` : ""}
              </p>
            </article>
          ),
        )}
      </section>

      {/* ---------- Filtros ---------- */}

      <section className="card mt-6 p-5">
        <div className="grid gap-3 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-mist-500">
              Buscar
            </label>
            <input
              className="field"
              placeholder="Nome, e-mail ou WhatsApp"
              value={filters.search}
              onChange={(e) => update({ search: e.target.value })}
            />
          </div>

          <div className="lg:col-span-3">
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-mist-500">
              Resultado
            </label>
            <select
              className="field"
              value={filters.tier}
              onChange={(e) => update({ tier: e.target.value })}
            >
              <option value="todos">Todos os resultados</option>
              {TIERS.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.label}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-mist-500">
              Pontuação
            </label>
            <div className="flex items-center gap-2">
              <input
                className="field"
                type="number"
                min={0}
                max={MAX_SCORE}
                placeholder="mín"
                value={filters.scoreMin}
                onChange={(e) => update({ scoreMin: e.target.value })}
              />
              <input
                className="field"
                type="number"
                min={0}
                max={MAX_SCORE}
                placeholder="máx"
                value={filters.scoreMax}
                onChange={(e) => update({ scoreMax: e.target.value })}
              />
            </div>
          </div>

          <div className="lg:col-span-3">
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-mist-500">
              Período
            </label>
            <div className="flex items-center gap-2">
              <input
                className="field"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => update({ dateFrom: e.target.value })}
              />
              <input
                className="field"
                type="date"
                value={filters.dateTo}
                onChange={(e) => update({ dateTo: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-mist-500">
              Cargo
            </label>
            <select
              className="field field-select"
              value={filters.cargo}
              onChange={(e) => update({ cargo: e.target.value })}
            >
              <option value="todos">Todos os cargos</option>
              {CARGOS.map((cargo) => (
                <option key={cargo} value={cargo}>
                  {cargo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-mist-500">
              Faturamento mensal
            </label>
            <select
              className="field field-select"
              value={filters.faturamento}
              onChange={(e) => update({ faturamento: e.target.value })}
            >
              <option value="todos">Todas as faixas</option>
              {FATURAMENTOS.map((faixa) => (
                <option key={faixa} value={faixa}>
                  {faixa}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="btn-ghost text-sm"
            disabled={!hasFilters}
          >
            Limpar filtros
          </button>

          <a
            href={`/api/admin/export?${query}`}
            className="btn-primary px-5 py-2.5 text-[13px] uppercase"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
              <path
                d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M4 15.5h12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Exportar leads
          </a>
        </div>
      </section>

      {/* ---------- Tabela ---------- */}

      <section className="card mt-6 overflow-hidden">
        {error && (
          <p className="border-b border-rose-500/20 bg-rose-500/10 px-5 py-3 text-sm text-rose-200">
            {error}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="admin-table w-full min-w-[1140px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-5 py-3.5">Nome</th>
                <th className="px-5 py-3.5">WhatsApp</th>
                <th className="px-5 py-3.5">E-mail</th>
                <th className="px-5 py-3.5">Cargo</th>
                <th className="px-5 py-3.5">Faturamento</th>
                <th className="px-5 py-3.5">Pontuação</th>
                <th className="px-5 py-3.5">Resultado</th>
                <th className="px-5 py-3.5">Data</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && leads.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-mist-500">
                    Carregando diagnósticos...
                  </td>
                </tr>
              )}

              {!loading && leads.length === 0 && !error && (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-mist-500">
                    {hasFilters
                      ? "Nenhum diagnóstico encontrado com esses filtros."
                      : "Ainda não há diagnósticos respondidos."}
                  </td>
                </tr>
              )}

              {leads.map((lead) => {
                const open = expanded === lead.id;
                return (
                  <Fragment key={lead.id}>
                    <tr className="transition-colors">
                      <td className="px-5 py-3.5 font-medium text-mist-100">
                        {lead.name}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-mist-300">
                        <a
                          href={`https://wa.me/55${lead.whatsapp.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-brand-300"
                        >
                          {lead.whatsapp}
                        </a>
                      </td>
                      <td className="px-5 py-3.5 text-mist-300">
                        <a
                          href={`mailto:${lead.email}`}
                          className="hover:text-brand-300"
                        >
                          {lead.email}
                        </a>
                      </td>
                      <td className="px-5 py-3.5 text-[13px] text-mist-400">
                        {lead.cargo || "—"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-[13px] text-mist-400">
                        {lead.faturamento || "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="tabular-nums font-semibold text-mist-100">
                          {lead.score}
                        </span>
                        <span className="text-mist-500">/{MAX_SCORE}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className="inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium"
                          style={{
                            background: `${tierColor(lead.tier_id)}1f`,
                            color: tierColor(lead.tier_id),
                            border: `1px solid ${tierColor(lead.tier_id)}33`,
                          }}
                        >
                          {lead.tier_label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-mist-400">
                        {formatDateBR(lead.created_at)}
                        <span className="ml-1.5 text-xs text-mist-500">
                          {formatTimeBR(lead.created_at)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : lead.id)}
                          className="text-xs text-brand-300 hover:text-brand-200"
                        >
                          {open ? "Ocultar" : "Respostas"}
                        </button>
                      </td>
                    </tr>

                    {open && (
                      <tr>
                        <td colSpan={9} className="bg-white/[0.03] px-5 py-5">
                          <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
                            <span className="text-mist-500">
                              Instagram:{" "}
                              {lead.instagram ? (
                                <a
                                  href={`https://instagram.com/${lead.instagram.replace(/^@/, "")}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-brand-300 hover:text-brand-200"
                                >
                                  {lead.instagram}
                                </a>
                              ) : (
                                "—"
                              )}
                            </span>
                            <span className="text-mist-500">
                              Cargo:{" "}
                              <span className="text-mist-300">{lead.cargo || "—"}</span>
                            </span>
                            <span className="text-mist-500">
                              Faturamento:{" "}
                              <span className="text-mist-300">
                                {lead.faturamento || "—"}
                              </span>
                            </span>
                          </div>
                          <ul className="grid gap-2.5 md:grid-cols-2">
                            {lead.answers?.map((answer) => (
                              <li
                                key={answer.question_id}
                                className="rounded-xl border border-white/10 bg-ink-900/60 p-3.5"
                              >
                                <p className="text-[11px] uppercase tracking-wider text-mist-500">
                                  {answer.question_id}. {answer.pillar}
                                </p>
                                <p className="mt-1.5 text-[13px] leading-snug text-mist-300">
                                  {answer.question}
                                </p>
                                <p className="mt-2 text-[13px] font-medium text-mist-100">
                                  {answer.answer_id}) {answer.answer_label}
                                  <span className="ml-2 text-xs font-normal text-mist-500">
                                    {answer.points} ponto(s)
                                  </span>
                                </p>
                              </li>
                            ))}
                          </ul>
                          {(lead.utm_source || lead.referrer) && (
                            <p className="mt-4 text-xs text-mist-500">
                              Origem: {lead.utm_source ?? "direto"}
                              {lead.utm_campaign ? ` · ${lead.utm_campaign}` : ""}
                              {lead.referrer ? ` · ${lead.referrer}` : ""}
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-5 py-3 text-xs text-mist-500">
          <span>
            {leads.length} registro(s) {hasFilters ? "com os filtros aplicados" : ""}
          </span>
          {loading && <span className="animate-pulse-soft">atualizando...</span>}
        </div>
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <article className="card p-5">
      <p className="text-[11px] uppercase tracking-wider text-mist-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-mist-100">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-mist-500">{hint}</p>}
    </article>
  );
}
