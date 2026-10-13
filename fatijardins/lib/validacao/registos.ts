import { z } from "zod"

import { numeroOpcional, textoObrigatorio, textoOpcional } from "./comum"

/**
 * Esquemas da ficha do trabalho (registo diário, materiais, fotos e
 * assinatura). Os formulários enviam texto; o servidor volta a validar com
 * estes mesmos esquemas antes de gravar.
 */

export const ESTADOS_TRABALHO = ["agendado", "em_curso", "concluido", "cancelado"] as const
export const esquemaEstado = z.enum(ESTADOS_TRABALHO, "Estado inválido.")

export const MOMENTOS_FOTO = ["antes", "depois", "outra"] as const
export const esquemaMomento = z.enum(MOMENTOS_FOTO, "Momento inválido.")

// ---------------------------------------------------------------------
// Registo do dia
// ---------------------------------------------------------------------

export const esquemaRegisto = z.object({
  tarefas_feitas: textoOpcional(5000),
  notas: textoOpcional(5000),
})
export type CamposRegisto = z.input<typeof esquemaRegisto>
export type DadosRegisto = z.output<typeof esquemaRegisto>

// ---------------------------------------------------------------------
// Materiais gastos
// ---------------------------------------------------------------------

export const UNIDADES_MATERIAL = ["un", "kg", "g", "L", "mL", "m", "m²", "m³", "saco", "caixa", "h"] as const
export type UnidadeMaterial = (typeof UNIDADES_MATERIAL)[number]

/** Quantidade com vírgula ("2,5"), maior do que zero e com até 2 casas decimais (numeric(10,2)). */
const quantidadeObrigatoria = numeroOpcional({ max: 100_000 })
  .transform((valor, ctx) => {
    if (valor === null) {
      ctx.addIssue({ code: "custom", message: "Indique a quantidade." })
      return z.NEVER
    }
    return valor
  })
  .refine((valor) => valor > 0, "A quantidade tem de ser maior do que zero.")
  .refine((valor) => Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6, "Use no máximo 2 casas decimais.")

export const esquemaMaterial = z.object({
  descricao: textoObrigatorio("Indique o material.", 200),
  quantidade: quantidadeObrigatoria,
  unidade: z.enum(UNIDADES_MATERIAL, "Escolha a unidade."),
})
export type CamposMaterial = z.input<typeof esquemaMaterial>
export type DadosMaterial = z.output<typeof esquemaMaterial>

// ---------------------------------------------------------------------
// Fotos e assinatura (ficheiros no Storage: trabalhos/<trabalho_id>/<ficheiro>)
// ---------------------------------------------------------------------

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"

/** A foto tem de estar na pasta do próprio trabalho, com nome <uuid>.jpg. */
export function eCaminhoFoto(trabalhoId: string, caminho: string): boolean {
  return new RegExp(`^trabalhos/${trabalhoId}/${UUID}\\.jpg$`).test(caminho)
}

/** A assinatura tem de estar na pasta do próprio trabalho, com nome assinatura-<uuid>.png. */
export function eCaminhoAssinatura(trabalhoId: string, caminho: string): boolean {
  return new RegExp(`^trabalhos/${trabalhoId}/assinatura-${UUID}\\.png$`).test(caminho)
}

/** Dados da foto já enviada para o Storage, para registar na tabela fotos. */
export const esquemaFoto = z.object({
  caminho: z.string().max(300),
  momento: esquemaMomento,
  largura: z.int().min(1).max(20_000),
  altura: z.int().min(1).max(20_000),
  tamanho: z.int().min(1).max(10 * 1024 * 1024),
})
export type DadosFoto = z.input<typeof esquemaFoto>

export const esquemaAssinatura = z.object({
  nome: textoObrigatorio("Indique o nome de quem assina.", 120),
})
export type CamposAssinatura = z.input<typeof esquemaAssinatura>
export type DadosAssinatura = z.output<typeof esquemaAssinatura>
