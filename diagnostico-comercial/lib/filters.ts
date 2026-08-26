import type { LeadFilters } from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseFilters(params: URLSearchParams): LeadFilters {
  const filters: LeadFilters = {};

  const tier = params.get("tier");
  if (tier && tier !== "todos") filters.tier = tier;

  const cargo = params.get("cargo");
  if (cargo && cargo !== "todos") filters.cargo = cargo;

  const faturamento = params.get("faturamento");
  if (faturamento && faturamento !== "todos") filters.faturamento = faturamento;

  const scoreMin = Number(params.get("scoreMin"));
  if (Number.isFinite(scoreMin) && params.get("scoreMin")) filters.scoreMin = scoreMin;

  const scoreMax = Number(params.get("scoreMax"));
  if (Number.isFinite(scoreMax) && params.get("scoreMax")) filters.scoreMax = scoreMax;

  const dateFrom = params.get("dateFrom");
  if (dateFrom && DATE_RE.test(dateFrom)) filters.dateFrom = dateFrom;

  const dateTo = params.get("dateTo");
  if (dateTo && DATE_RE.test(dateTo)) filters.dateTo = dateTo;

  const search = params.get("search")?.trim();
  if (search) filters.search = search.slice(0, 120);

  return filters;
}
