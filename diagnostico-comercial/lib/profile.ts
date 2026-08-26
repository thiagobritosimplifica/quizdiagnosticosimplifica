/**
 * Perguntas de qualificação feitas na tela de captura, junto com os dados
 * de contato. Não entram na pontuação do diagnóstico — servem para a
 * Simplifica priorizar o atendimento comercial.
 */

export const CARGOS = [
  "Sócio/Dono/Fundador",
  "Gerente/Coordenador de Marketing",
  "Gerente/Coordenador de Vendas",
  "Vendedor/Closer",
  "Pré-vendedor/SDR/BDR",
] as const;

export const FATURAMENTOS = [
  "Ainda não estou faturando",
  "Menos de R$5.000 por mês",
  "De R$5.000 a R$19.000 por mês",
  "De R$20.000 a R$39.000 por mês",
  "De R$40.000 a R$99.000 por mês",
  "De R$100.000 a R$299.000 por mês",
  "Acima de R$300.000 por mês",
] as const;

export type Cargo = (typeof CARGOS)[number];
export type Faturamento = (typeof FATURAMENTOS)[number];

export function isCargo(value: unknown): value is Cargo {
  return typeof value === "string" && (CARGOS as readonly string[]).includes(value);
}

export function isFaturamento(value: unknown): value is Faturamento {
  return (
    typeof value === "string" && (FATURAMENTOS as readonly string[]).includes(value)
  );
}

/**
 * Aceita "@loja", "loja", "instagram.com/loja" ou a URL completa
 * e devolve sempre no formato "@loja".
 */
export function normalizeInstagram(value: string): string {
  const handle = value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/^instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@+/, "")
    .trim();
  return handle ? `@${handle}` : "";
}
