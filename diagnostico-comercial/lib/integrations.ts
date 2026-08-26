import type { Lead } from "./types";
import { buildRespondiPayload } from "./webhook-payload";

/**
 * Saída dos leads para sistemas externos. Nada aqui bloqueia a resposta ao
 * usuário nem impede a gravação na planilha — falhas só vão para o log.
 *
 * - N8N_WEBHOOK_URL   recebe o payload no formato do Respondi (n8n, CRM)
 * - LEAD_WEBHOOK_URL  recebe o payload nativo, mais simples
 *
 * As duas aceitam várias URLs separadas por vírgula.
 */

const TIMEOUT_MS = 8000;

function urls(variavel: string | undefined): string[] {
  return (variavel ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
}

async function enviar(url: string, corpo: unknown, rotulo: string): Promise<void> {
  const tentar = () =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(process.env.LEAD_WEBHOOK_SECRET
          ? { "X-Webhook-Secret": process.env.LEAD_WEBHOOK_SECRET }
          : {}),
      },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  try {
    let res = await tentar();

    if (!res.ok) {
      // Uma segunda chance cobre instabilidade momentânea do destino.
      await new Promise((resolve) => setTimeout(resolve, 1200));
      res = await tentar();
    }

    if (!res.ok) {
      const detalhe = await res.text().catch(() => "");
      console.error(`[${rotulo}] ${url} respondeu ${res.status}: ${detalhe.slice(0, 200)}`);
    }
  } catch (err) {
    console.error(`[${rotulo}] falha ao enviar para ${url}:`, (err as Error).message);
  }
}

export async function forwardLead(lead: Lead): Promise<void> {
  const destinos: Promise<void>[] = [];

  // Formato Respondi — é o que o fluxo do n8n já espera.
  const payloadN8n = buildRespondiPayload(lead);
  for (const url of urls(process.env.N8N_WEBHOOK_URL)) {
    destinos.push(enviar(url, payloadN8n, "n8n"));
  }

  // Formato nativo, para integrações novas.
  const payloadNativo = {
    event: "diagnostico.concluido",
    source: "diagnostico-atendimento-comercial",
    sent_at: new Date().toISOString(),
    lead,
  };
  for (const url of urls(process.env.LEAD_WEBHOOK_URL)) {
    destinos.push(enviar(url, payloadNativo, "webhook"));
  }

  if (destinos.length === 0) return;
  await Promise.allSettled(destinos);
}
