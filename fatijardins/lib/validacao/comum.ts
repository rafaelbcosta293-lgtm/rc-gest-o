import { z } from "zod"

import { eDataValida } from "@/lib/datas"

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
  // Aceita "2765001" ou "2765 001" (no iPhone o teclado numérico não tem hífen).
  .transform((valor) => valor.replace(/^(\d{4})\s*-?\s*(\d{3})$/, "$1-$2"))
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

/**
 * Número escrito à portuguesa: "12,50", "1 200", "1.200" ou "1.200,50"
 * (o ponto conta como separador de milhares); vazio → null.
 * Com pontoDecimal (coordenadas GPS), o ponto é a vírgula decimal:
 * "-9.139337" e "-9,139337" são o mesmo número.
 */
export function numeroOpcional({
  min,
  max,
  pontoDecimal = false,
}: { min?: number; max?: number; pontoDecimal?: boolean } = {}) {
  return z
    .string()
    .transform((valor) => {
      const texto = valor.replace(/\s/g, "")
      if (pontoDecimal) return texto.replace(",", ".")
      if (texto.includes(",")) return texto.replace(/\./g, "").replace(",", ".")
      return /^-?[1-9]\d{0,2}(\.\d{3})+$/.test(texto) ? texto.replace(/\./g, "") : texto
    })
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

/** Data real entre 2000 e 2100 (como na agenda): 2026-02-30 ou 9999-12-31 não passam. */
export const dataObrigatoria = (mensagem = "Indique a data.") =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: mensagem, abort: true })
    .refine((valor) => eDataValida(valor), "Data inválida.")

/** Converte valores da base de dados para o texto dos campos do formulário. */
export function paraCampo(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return ""
  return typeof valor === "number" ? String(valor).replace(".", ",") : valor
}
