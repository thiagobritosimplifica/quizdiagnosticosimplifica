import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getStorageMode, listLeads } from "@/lib/db";
import { parseFilters } from "@/lib/filters";
import { buildStats } from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const filters = parseFilters(url.searchParams);

  const temFiltro = Object.keys(filters).length > 0;

  try {
    // Sem filtro ativo, a consulta geral seria idêntica — evita ir ao banco duas vezes.
    const filtered = await listLeads(filters);
    const totalGeral = temFiltro ? (await listLeads({})).length : filtered.length;

    return NextResponse.json({
      storage: getStorageMode(),
      filters,
      leads: filtered,
      stats: buildStats(filtered),
      totalGeral,
    });
  } catch (err) {
    console.error("[admin/leads] erro ao consultar:", err);
    return NextResponse.json(
      { error: "Falha ao consultar o banco de dados.", details: (err as Error).message },
      { status: 500 },
    );
  }
}
