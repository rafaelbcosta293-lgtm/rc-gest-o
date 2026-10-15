import { z } from "zod"

import { dataObrigatoria, numeroOpcional, textoOpcional } from "./comum"
import { esquemaFoto } from "./registos"

/**
 * Esquema do formulário de visita (criar e editar). Os campos chegam em
 * texto; o servidor volta a validar com o mesmo esquema.
 */

const HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

function idEscolhido(mensagem: string) {
  return z.string().refine((valor) => z.uuid().safeParse(valor).success, mensagem)
}

/** "15:00" (input type=time) → "15:00"; vazio → null. */
const horaOpcional = z
  .string()
  .trim()
  .refine((valor) => valor === "" || HORA.test(valor), "Hora inválida.")
  .transform((valor) => (valor === "" ? null : valor.slice(0, 5)))

/**
 * Área em m² escrita à portuguesa ("212,5" ou "1.200", como na área do
 * local); maior do que zero e com até 2 casas decimais (numeric(10,2)).
 */
const areaOpcional = numeroOpcional({ min: 0, max: 99_999_999 })
  .refine((valor) => valor === null || valor > 0, "A área tem de ser maior do que zero.")
  .refine(
    (valor) => valor === null || Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6,
    "Use no máximo 2 casas decimais."
  )

export const esquemaVisita = z.object({
  cliente_id: idEscolhido("Escolha o cliente."),
  local_id: idEscolhido("Escolha o local."),
  data: dataObrigatoria("Indique a data da visita."),
  hora: horaOpcional,
  responsavel_id: idEscolhido("Escolha o responsável."),
  area_m2: areaOpcional,
  medidas: textoOpcional(4000),
  notas: textoOpcional(4000),
})
export type CamposVisita = z.input<typeof esquemaVisita>
export type DadosVisita = z.output<typeof esquemaVisita>

/** Dados da foto já enviada para o Storage (as fotos das visitas não têm antes/depois). */
export const esquemaFotoVisita = esquemaFoto.omit({ momento: true })
export type DadosFotoVisita = z.input<typeof esquemaFotoVisita>

export const esquemaLegendaFoto = textoOpcional(200)
