import { TIERS } from "./scoring";
import type { Lead } from "./types";

export interface TierStat {
  id: string;
  label: string;
  emoji: string;
  hex: string;
  count: number;
  percentage: number;
}

export interface Stats {
  totalDiagnostics: number;
  totalLeads: number;
  averageScore: number;
  tiers: TierStat[];
}

export function buildStats(leads: Lead[]): Stats {
  const totalDiagnostics = leads.length;
  const uniqueEmails = new Set(
    leads.map((l) => (l.email ?? "").trim().toLowerCase()).filter(Boolean),
  );
  const sum = leads.reduce((acc, l) => acc + (l.score ?? 0), 0);

  return {
    totalDiagnostics,
    totalLeads: uniqueEmails.size,
    averageScore: totalDiagnostics ? Number((sum / totalDiagnostics).toFixed(1)) : 0,
    tiers: TIERS.map((tier) => {
      const count = leads.filter((l) => l.tier_id === tier.id).length;
      return {
        id: tier.id,
        label: tier.label,
        emoji: tier.emoji,
        hex: tier.hex,
        count,
        percentage: totalDiagnostics
          ? Number(((count / totalDiagnostics) * 100).toFixed(1))
          : 0,
      };
    }),
  };
}
