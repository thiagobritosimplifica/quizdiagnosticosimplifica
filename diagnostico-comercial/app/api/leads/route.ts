import { after, NextResponse } from "next/server";
import { buildLead, persistLead } from "@/lib/db";
import { forwardLead } from "@/lib/integrations";
import { MAX_SCORE } from "@/lib/questions";
import { classify, findBottlenecks, scoreAnswers } from "@/lib/scoring";
import type { DiagnosisResult, LeadInput } from "@/lib/types";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { normalizeInstagram } from "@/lib/profile";
import { formatWhatsapp, hasErrors, onlyDigits, validateContact } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function str(value: unknown, max = 250): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  if (rateLimit(`leads:${ip}`, 8, 60_000)) {
    return NextResponse.json(
      { error: "Muitas tentativas em sequência. Aguarde um minuto." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const contact = {
    name: typeof body.name === "string" ? body.name.trim() : "",
    whatsapp: typeof body.whatsapp === "string" ? body.whatsapp : "",
    email: typeof body.email === "string" ? body.email.trim().toLowerCase() : "",
    instagram: typeof body.instagram === "string" ? body.instagram : "",
    cargo: typeof body.cargo === "string" ? body.cargo.trim() : "",
    faturamento: typeof body.faturamento === "string" ? body.faturamento.trim() : "",
  };

  const fieldErrors = validateContact(contact);
  if (hasErrors(fieldErrors)) {
    return NextResponse.json(
      { error: "Confira os dados informados.", fields: fieldErrors },
      { status: 422 },
    );
  }

  // A pontuação é sempre recalculada no servidor a partir das respostas.
  const scored = scoreAnswers(body.answers);
  if (!scored.ok) {
    return NextResponse.json(
      { error: "Respostas incompletas.", details: scored.errors },
      { status: 422 },
    );
  }

  const tier = classify(scored.score);
  const utm = (body.utm ?? {}) as Record<string, unknown>;

  const input: LeadInput = {
    name: contact.name,
    whatsapp: formatWhatsapp(onlyDigits(contact.whatsapp)),
    email: contact.email,
    instagram: normalizeInstagram(contact.instagram),
    cargo: contact.cargo,
    faturamento: contact.faturamento,
    // O envio do formulário é o próprio aceite — o texto acima do botão explica.
    consent: true,
    answers: scored.answers,
    score: scored.score,
    score_bruto: scored.rawScore,
    tier_id: tier.id,
    tier_label: tier.label,
    utm_source: str(utm.utm_source, 120),
    utm_medium: str(utm.utm_medium, 120),
    utm_campaign: str(utm.utm_campaign, 200),
    utm_term: str(utm.utm_term, 200),
    utm_content: str(utm.utm_content, 200),
    gclid: str(utm.gclid, 300),
    fbclid: str(utm.fbclid, 300),
    referrer: str(utm.referrer, 500),
    user_agent: request.headers.get("user-agent")?.slice(0, 400) ?? null,
  };

  const lead = buildLead(input);

  /*
   * A planilha do Google leva de 2 a 14 segundos para responder — tempo demais
   * para segurar a pessoa numa tela de "gerando seu diagnóstico".
   *
   * Esperamos até 3 segundos: é o bastante para um erro de configuração
   * (segredo errado, Web App fora do ar) aparecer e virar erro na tela. Se
   * passar disso, a gravação segue em segundo plano com after() e a pessoa
   * já vê o resultado, que é calculado aqui e não depende da planilha.
   */
  const gravacao = persistLead(lead).then(
    () => ({ ok: true as const }),
    (err: Error) => ({ ok: false as const, err }),
  );

  const pendente = Symbol("pendente");
  const parcial = await Promise.race([
    gravacao,
    new Promise<typeof pendente>((resolve) =>
      setTimeout(() => resolve(pendente), 3000),
    ),
  ]);

  if (parcial !== pendente && !parcial.ok) {
    console.error("[leads] falha ao gravar na planilha:", parcial.err);
    return NextResponse.json(
      { error: "Não conseguimos salvar seu diagnóstico. Tente novamente." },
      { status: 500 },
    );
  }

  after(async () => {
    const final = await gravacao;
    if (!final.ok) {
      // Último recurso: o lead fica registrado no log para não se perder.
      console.error(
        "[leads] LEAD NAO GRAVADO NA PLANILHA:",
        final.err.message,
        JSON.stringify(lead),
      );
    }
    await forwardLead(lead);
  });

  const result: DiagnosisResult = {
    id: lead.id,
    name: lead.name,
    score: lead.score,
    max_score: MAX_SCORE,
    tier: {
      id: tier.id,
      emoji: tier.emoji,
      label: tier.label,
      description: tier.description,
      hex: tier.hex,
    },
    answers: scored.answers,
    bottlenecks: findBottlenecks(scored.answers),
    created_at: lead.created_at,
  };

  return NextResponse.json(result, { status: 201 });
}
