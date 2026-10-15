import { z } from "zod"

import {
  codigoPostalOpcional,
  emailOpcional,
  nifOpcional,
  numeroOpcional,
  telefoneOpcional,
  textoObrigatorio,
  textoOpcional,
} from "./comum"

/**
 * Dados da empresa (a linha única da tabela empresa). Os nomes dos campos
 * são os das colunas, para os erros do servidor caírem no campo certo.
 */

/** IBAN português (PT50 + 21 algarismos) com os algarismos de controlo certos (mod 97). */
export function ibanValido(iban: string): boolean {
  if (!/^PT50\d{21}$/.test(iban)) return false
  // Os 4 primeiros carateres passam para o fim e as letras viram números (P = 25, T = 29).
  const numerico = `${iban.slice(4)}252950`
  let resto = 0
  for (const algarismo of numerico) resto = (resto * 10 + Number(algarismo)) % 97
  return resto === 1
}

/** "PT50000201231234567890154" → "PT50 0002 0123 1234 5678 9015 4" (como se escreve em papel). */
export function formatarIban(iban: string): string {
  return iban.replace(/\s/g, "").replace(/(.{4})(?=.)/g, "$1 ")
}

const ibanOpcional = z
  .string()
  .transform((valor) => valor.replace(/\s/g, "").toUpperCase())
  .refine((valor) => valor === "" || /^PT50\d{21}$/.test(valor), "Use o formato PT50 seguido de 21 algarismos.")
  .refine((valor) => valor === "" || ibanValido(valor), "IBAN inválido: verifique os algarismos.")
  .transform((valor) => (valor === "" ? null : formatarIban(valor)))

/** "www.fatijardins.pt" ou "https://fatijardins.pt/…" (sem espaços, com domínio). */
const websiteOpcional = z
  .string()
  .trim()
  .max(200, "Máximo de 200 caracteres.")
  .refine(
    (valor) => valor === "" || /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:\d+)?([/?#]\S*)?$/i.test(valor),
    "Endereço inválido (ex.: www.fatijardins.pt)."
  )
  .transform((valor) => (valor === "" ? null : valor))

const validadeDias = numeroOpcional({ min: 1, max: 365 })
  .refine((valor) => valor !== null, "Indique a validade em dias.")
  .refine((valor) => valor === null || Number.isInteger(valor), "Indique um número inteiro de dias.")
  .transform((valor) => valor as number)

export const esquemaEmpresa = z.object({
  nome: textoObrigatorio("Indique o nome da empresa.", 120),
  nif: nifOpcional,
  morada: textoOpcional(300),
  codigo_postal: codigoPostalOpcional,
  localidade: textoOpcional(100),
  telefone: telefoneOpcional,
  email: emailOpcional,
  website: websiteOpcional,
  iban: ibanOpcional,
  validade_orcamento_dias: validadeDias,
  condicoes_orcamento: textoOpcional(4000),
})
export type CamposEmpresa = z.input<typeof esquemaEmpresa>
export type DadosEmpresa = z.output<typeof esquemaEmpresa>
