import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { listLeads } from "@/lib/db";
import { parseFilters } from "@/lib/filters";
import { formatDateBR, formatTimeBR } from "@/lib/format";
import { QUESTIONS } from "@/lib/questions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Escapa um campo para CSV com separador ";" (padrão Excel pt-BR). */
function cell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const leads = await listLeads(parseFilters(url.searchParams));

  const header = [
    "ID",
    "Nome",
    "WhatsApp",
    "E-mail",
    "Instagram",
    "Cargo",
    "Faturamento mensal",
    "Pontuacao",
    "Resultado",
    "Data",
    "Horario",
    ...QUESTIONS.flatMap((q) => [`P${q.id} - ${q.pillar}`, `P${q.id} - Resposta`]),
    "UTM Source",
    "UTM Medium",
    "UTM Campaign",
    "UTM Term",
    "UTM Content",
    "Referrer",
  ];

  const rows = leads.map((lead) => {
    const byQuestion = new Map(lead.answers?.map((a) => [a.question_id, a]) ?? []);
    return [
      lead.id,
      lead.name,
      lead.whatsapp,
      lead.email,
      lead.instagram,
      lead.cargo,
      lead.faturamento,
      lead.score,
      lead.tier_label,
      formatDateBR(lead.created_at),
      formatTimeBR(lead.created_at),
      ...QUESTIONS.flatMap((q) => {
        const answer = byQuestion.get(q.id);
        return [
          q.title,
          answer ? `${answer.answer_id}) ${answer.answer_label} (${answer.points} pts)` : "",
        ];
      }),
      lead.utm_source,
      lead.utm_medium,
      lead.utm_campaign,
      lead.utm_term,
      lead.utm_content,
      lead.referrer,
    ];
  });

  const csv = [header, ...rows]
    .map((row) => row.map(cell).join(";"))
    .join("\r\n");

  const stamp = new Date().toISOString().slice(0, 10);

  // BOM para o Excel reconhecer os acentos.
  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-diagnostico-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
