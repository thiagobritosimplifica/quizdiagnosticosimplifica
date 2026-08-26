import type { Lead } from "./types";

/**
 * Ponto único de saída dos leads para sistemas externos.
 *
 * Basta apontar LEAD_WEBHOOK_URL (aceita várias URLs separadas por vírgula)
 * para um endpoint de Google Sheets (Apps Script), CRM, n8n/Make, Zapier,
 * API de WhatsApp ou automação de marketing. Falhas aqui nunca derrubam o
 * cadastro do lead — são apenas registradas no log.
 */
export async function forwardLead(lead: Lead): Promise<void> {
  const targets = (process.env.LEAD_WEBHOOK_URL ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  if (targets.length === 0) return;

  const payload = {
    event: "diagnostico.concluido",
    source: "diagnostico-atendimento-comercial",
    sent_at: new Date().toISOString(),
    lead,
  };

  await Promise.allSettled(
    targets.map(async (url) => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.LEAD_WEBHOOK_SECRET
              ? { "X-Webhook-Secret": process.env.LEAD_WEBHOOK_SECRET }
              : {}),
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) {
          console.error(`[webhook] ${url} respondeu ${res.status}`);
        }
      } catch (err) {
        console.error(`[webhook] falha ao enviar para ${url}:`, (err as Error).message);
      }
    }),
  );
}
