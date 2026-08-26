import { isCargo, isFaturamento, normalizeInstagram } from "./profile";

export interface ContactInput {
  name: string;
  whatsapp: string;
  email: string;
  instagram: string;
  cargo: string;
  faturamento: string;
}

export type FieldErrors = Partial<Record<keyof ContactInput, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const INSTAGRAM_RE = /^@[a-z0-9._]{2,30}$/i;

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Formata para (11) 91234-5678 enquanto o usuário digita. */
export function formatWhatsapp(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function validateContact(input: Partial<ContactInput>): FieldErrors {
  const errors: FieldErrors = {};

  const name = (input.name ?? "").trim();
  const letras = name.replace(/[^\p{L}]/gu, "");
  if (name.length < 2 || letras.length < 2)
    errors.name = "Informe seu nome completo.";
  else if (name.length > 120) errors.name = "Nome muito longo.";

  const digits = onlyDigits(input.whatsapp ?? "");
  if (digits.length < 10 || digits.length > 11)
    errors.whatsapp = "Informe um WhatsApp válido com DDD.";
  else if (Number(digits.slice(0, 2)) < 11) errors.whatsapp = "DDD inválido.";

  const email = (input.email ?? "").trim();
  if (!EMAIL_RE.test(email)) errors.email = "Informe um e-mail válido.";

  const instagram = normalizeInstagram(input.instagram ?? "");
  if (!instagram) errors.instagram = "Informe o @ do seu Instagram.";
  else if (!INSTAGRAM_RE.test(instagram))
    errors.instagram = "Use apenas letras, números, ponto e underline.";

  if (!isCargo(input.cargo)) errors.cargo = "Selecione seu cargo.";

  if (!isFaturamento(input.faturamento))
    errors.faturamento = "Selecione o faturamento médio mensal.";

  return errors;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
