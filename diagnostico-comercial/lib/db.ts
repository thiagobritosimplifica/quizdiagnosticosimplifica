import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Lead, LeadFilters, LeadInput } from "./types";

/**
 * Camada de armazenamento — Google Sheets.
 *
 * A planilha é o banco de dados oficial. A aplicação conversa com ela através
 * de um Web App do Google Apps Script (código em google-sheets/Codigo.gs),
 * então não é preciso conta de serviço nem credencial do Google Cloud.
 *
 * Sem SHEETS_WEBAPP_URL configurada, tudo cai num arquivo JSON local
 * (.data/leads.json) para permitir rodar e testar sem nenhuma configuração.
 */
export type StorageMode = "sheets" | "local";

const LOCAL_FILE = path.join(process.cwd(), ".data", "leads.json");
/** Fuso fixo do Brasil (sem horário de verão) para os filtros por data. */
const BR_OFFSET = "-03:00";
/** Leitura da planilha é lenta (~1-2s); guarda o resultado por alguns segundos. */
const CACHE_TTL_MS = 15_000;

function sheetsConfig() {
  const url = process.env.SHEETS_WEBAPP_URL?.trim();
  const secret = process.env.SHEETS_SECRET?.trim() ?? "";
  if (!url) return null;
  return { url, secret };
}

export function getStorageMode(): StorageMode {
  return sheetsConfig() ? "sheets" : "local";
}

/* ------------------------------------------------------------------ */
/* Google Sheets (via Apps Script Web App)                             */
/* ------------------------------------------------------------------ */

let cache: { at: number; leads: Lead[] } | null = null;

async function callSheets<T>(action: "insert" | "list", payload: object): Promise<T> {
  const cfg = sheetsConfig();
  if (!cfg) throw new Error("Planilha não configurada (SHEETS_WEBAPP_URL).");

  const response = await fetch(cfg.url, {
    method: "POST",
    // O Apps Script responde a POST simples; text/plain evita o preflight.
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, secret: cfg.secret, ...payload }),
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  const texto = await response.text();
  if (!response.ok) {
    throw new Error(`Planilha respondeu ${response.status}: ${texto.slice(0, 300)}`);
  }

  let dados: { ok?: boolean; error?: string; data?: T };
  try {
    dados = JSON.parse(texto);
  } catch {
    // Erro do Apps Script costuma voltar como página HTML.
    throw new Error(
      "Resposta inesperada da planilha. Confira se o Web App está publicado para \"Qualquer pessoa\".",
    );
  }

  if (!dados.ok) throw new Error(dados.error ?? "Falha na planilha.");
  return dados.data as T;
}

/* ------------------------------------------------------------------ */
/* Armazenamento local (fallback de desenvolvimento)                   */
/* ------------------------------------------------------------------ */

let writeQueue: Promise<unknown> = Promise.resolve();

async function readLocal(): Promise<Lead[]> {
  try {
    const raw = await fs.readFile(LOCAL_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Lead[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeLocal(lead: Lead): Promise<Lead> {
  // Serializa as escritas para não corromper o arquivo em requisições paralelas.
  const task = writeQueue.then(async () => {
    const all = await readLocal();
    all.push(lead);
    await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
    await fs.writeFile(LOCAL_FILE, JSON.stringify(all, null, 2), "utf8");
    return lead;
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

/* ------------------------------------------------------------------ */
/* Filtros                                                             */
/* ------------------------------------------------------------------ */

function matchesFilters(lead: Lead, f: LeadFilters): boolean {
  if (f.tier && lead.tier_id !== f.tier) return false;
  if (f.cargo && lead.cargo !== f.cargo) return false;
  if (f.faturamento && lead.faturamento !== f.faturamento) return false;
  if (
    f.dateFrom &&
    lead.created_at < new Date(`${f.dateFrom}T00:00:00${BR_OFFSET}`).toISOString()
  )
    return false;
  if (
    f.dateTo &&
    lead.created_at > new Date(`${f.dateTo}T23:59:59.999${BR_OFFSET}`).toISOString()
  )
    return false;
  if (typeof f.scoreMin === "number" && lead.score < f.scoreMin) return false;
  if (typeof f.scoreMax === "number" && lead.score > f.scoreMax) return false;
  if (f.search) {
    const q = f.search.toLowerCase();
    const alvo =
      `${lead.name} ${lead.email} ${lead.whatsapp} ${lead.instagram ?? ""}`.toLowerCase();
    if (!alvo.includes(q)) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* API pública                                                         */
/* ------------------------------------------------------------------ */

/** Monta o registro final (id + data). Não grava nada. */
export function buildLead(input: LeadInput): Lead {
  return {
    ...input,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
}

/**
 * Grava o lead. O Web App do Apps Script costuma levar de 2 a 14 segundos,
 * então uma segunda tentativa cobre falhas pontuais de rede.
 */
export async function persistLead(lead: Lead): Promise<void> {
  if (getStorageMode() !== "sheets") {
    await writeLocal(lead);
    return;
  }

  try {
    await callSheets<unknown>("insert", { lead });
  } catch (err) {
    console.warn("[planilha] 1a tentativa falhou, repetindo:", (err as Error).message);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await callSheets<unknown>("insert", { lead });
  }

  cache = null; // a próxima leitura precisa enxergar a linha nova
}

export async function insertLead(input: LeadInput): Promise<Lead> {
  const lead = buildLead(input);
  await persistLead(lead);
  return lead;
}

export async function listLeads(filters: LeadFilters = {}): Promise<Lead[]> {
  let todos: Lead[];

  if (getStorageMode() === "sheets") {
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
      todos = cache.leads;
    } else {
      todos = (await callSheets<Lead[]>("list", {})) ?? [];
      cache = { at: Date.now(), leads: todos };
    }
  } else {
    todos = await readLocal();
  }

  return todos
    .filter((lead) => matchesFilters(lead, filters))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

/** Força a próxima leitura a buscar direto na planilha. */
export function invalidateCache(): void {
  cache = null;
}

/** Verificação usada pelo painel para avisar se a planilha está acessível. */
export async function checkStorage(): Promise<{
  mode: StorageMode;
  ok: boolean;
  message?: string;
}> {
  const mode = getStorageMode();
  try {
    await listLeads({});
    return { mode, ok: true };
  } catch (err) {
    return { mode, ok: false, message: (err as Error).message };
  }
}
