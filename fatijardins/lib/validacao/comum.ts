import { z } from "zod"

// Mensagens de erro do Zod em português por omissão.
z.config(z.locales.pt())

/**
 * Campos de formulário chegam sempre como texto ("" quando vazios).
 * Estes esquemas validam o texto e convertem "" em null para a base de dados.
 */

const vazioParaNull = (valor: string) => (valor === "" ? null : valor)

export function textoObrigatorio(mensagem: string, max = 200) {
  return z.string().trim().min(1, mensagem).max(max, `Máximo de ${max} caracteres.`)
}

export function textoOpcional(max = 2000) {
  return z.string().trim().max(max, `Máximo de ${max} caracteres.`).transform(vazioParaNull)
}

/** Valida o algarismo de controlo de um NIF/NIPC português (9 algarismos). */
export function nifValido(nif: string): boolean {
  if (!/^[1-9]\d{8}$/.test(nif)) return false
  const soma = nif
    .slice(0, 8)
    .split("")
    .reduce((total, algarismo, i) => total + Number(algarismo) * (9 - i), 0)
  const resto = soma % 11
  const controlo = resto < 2 ? 0 : 11 - resto
  return controlo === Number(nif[8])
}

export const nifOpcional = z
  .string()
  .transform((valor) => valor.replace(/\s/g, ""))
  .refine((valor) => valor === "" || /^\d{9}$/.test(valor), "O NIF tem 9 algarismos.")
  .refine((valor) => valor === "" || nifValido(valor), "NIF inválido: verifique os algarismos.")
  .transform(vazioParaNull)

export const codigoPostalOpcional = z
  .string()
  .trim()
  .refine((valor) => valor === "" || /^\d{4}-\d{3}$/.test(valor), "Use o formato 0000-000.")
  .transform(vazioParaNull)

export const telefoneOpcional = z
  .string()
  .trim()
  .max(30, "Número demasiado longo.")
  .refine(
    (valor) => valor === "" || (/^[+\d\s().-]+$/.test(valor) && valor.replace(/\D/g, "").length >= 9),
    "Número de telefone inválido."
  )
  .transform(vazioParaNull)

export const emailOpcional = z
  .string()
  .trim()
  .toLowerCase()
  .refine((valor) => valor === "" || z.email().safeParse(valor).success, "Email inválido.")
  .transform(vazioParaNull)

export const emailObrigatorio = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Indique o email.")
  .pipe(z.email("Email inválido."))

/** Número escrito à portuguesa ("12,50" ou "1 200"); vazio → null. */
export function numeroOpcional({ min, max }: { min?: number; max?: number } = {}) {
  return z
    .string()
    .transform((valor) => valor.replace(/\s/g, "").replace(",", "."))
    .refine((valor) => valor === "" || /^-?\d+(\.\d+)?$/.test(valor), "Indique um número válido.")
    .transform((valor) => (valor === "" ? null : Number(valor)))
    .refine((valor) => valor === null || min === undefined || valor >= min, `O valor mínimo é ${min}.`)
    .refine((valor) => valor === null || max === undefined || valor <= max, `O valor máximo é ${max}.`)
}

export const uuidOpcional = z
  .string()
  .transform(vazioParaNull)
  .refine((valor) => valor === null || z.uuid().safeParse(valor).success, "Opção inválida.")

export const idObrigatorio = z.uuid("Identificador inválido.")

export const dataObrigatoria = (mensagem = "Indique a data.") =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, mensagem)

/** Converte valores da base de dados para o texto dos campos do formulário. */
export function paraCampo(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return ""
  return typeof valor === "number" ? String(valor).replace(".", ",") : valor
}
