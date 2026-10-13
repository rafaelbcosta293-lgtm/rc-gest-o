import { z } from "zod"

import { eDataValida, somarMeses } from "@/lib/datas"
import type { Recorrencia, TipoTrabalho } from "@/lib/trabalhos"
import { textoObrigatorio, textoOpcional } from "./comum"

/** Títulos mais usados (botões de sugestão no formulário). */
export const TITULOS_SUGERIDOS = [
  "Manutenção",
  "Corte de relva",
  "Poda",
  "Tratamento fitossanitário",
  "Revisão da rega",
] as const

/** Durações do seletor: de 30 em 30 minutos até 8 horas. */
export const DURACOES_MIN = Array.from({ length: 16 }, (_, i) => (i + 1) * 30)

export const TIPOS_TRABALHO = ["manutencao", "obra"] as const satisfies readonly TipoTrabalho[]
export const RECORRENCIAS = ["nao", "semanal", "quinzenal", "mensal"] as const satisfies readonly Recorrencia[]

/** Uma série pode ir no máximo até um ano depois da primeira data. */
export const MESES_MAXIMOS_SERIE = 12

const HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

function idEscolhido(mensagem: string) {
  return z.string().refine((valor) => z.uuid().safeParse(valor).success, mensagem)
}

const dataValida = (mensagem: string) => z.string().refine((valor) => eDataValida(valor), mensagem)

/** "08:30" (input type=time) → "08:30"; vazio → null. */
const horaOpcional = z
  .string()
  .trim()
  .refine((valor) => valor === "" || HORA.test(valor), "Hora inválida.")
  .transform((valor) => (valor === "" ? null : valor.slice(0, 5)))

/** Minutos (texto do seletor) → número; vazio → null. */
const duracaoOpcional = z
  .string()
  .refine(
    (valor) => valor === "" || (/^\d{1,4}$/.test(valor) && Number(valor) >= 1 && Number(valor) <= 1440),
    "Duração inválida."
  )
  .transform((valor) => (valor === "" ? null : Number(valor)))

/**
 * Esquema do formulário de trabalho (criar e editar). Os campos chegam em
 * texto; o servidor volta a validar com o mesmo esquema.
 * - equipaObrigatoria: o chefe de equipa não pode deixar trabalhos por atribuir.
 * - repetir/ate só contam ao criar (ao editar o formulário envia "nao").
 */
export function esquemaTrabalho({ equipaObrigatoria }: { equipaObrigatoria: boolean }) {
  return z
    .object({
      cliente_id: idEscolhido("Escolha o cliente."),
      local_id: idEscolhido("Escolha o local."),
      titulo: textoObrigatorio("Indique o título (ex.: Manutenção).", 120),
      tipo: z.enum(TIPOS_TRABALHO, { error: "Escolha o tipo." }),
      data: dataValida("Indique a data."),
      hora_inicio: horaOpcional,
      duracao_prevista_min: duracaoOpcional,
      equipa_id: z
        .string()
        .refine(
          (valor) => (valor === "" ? !equipaObrigatoria : z.uuid().safeParse(valor).success),
          "Escolha a equipa."
        )
        .transform((valor) => (valor === "" ? null : valor)),
      descricao: textoOpcional(4000),
      repetir: z.enum(RECORRENCIAS, { error: "Escolha se o trabalho se repete." }),
      ate: z.string().transform((valor) => (valor === "" ? null : valor)),
    })
    .superRefine((trabalho, ctx) => {
      if (trabalho.repetir === "nao" || !eDataValida(trabalho.data)) return
      const problema = problemaDataFim(trabalho.data, trabalho.ate)
      if (problema) ctx.addIssue({ code: "custom", path: ["ate"], message: problema })
    })
}

/** Valida a data "até" de uma série; devolve a mensagem de erro ou null. */
export function problemaDataFim(primeira: string, ate: string | null): string | null {
  if (!ate) return "Indique até quando se repete."
  if (!eDataValida(ate)) return "Data inválida."
  if (ate < primeira) return "Tem de ser igual ou posterior à data do trabalho."
  if (ate > somarMeses(primeira, MESES_MAXIMOS_SERIE)) return "No máximo um ano depois da data do trabalho."
  return null
}

export type CamposTrabalho = z.input<ReturnType<typeof esquemaTrabalho>>
export type DadosTrabalho = z.output<ReturnType<typeof esquemaTrabalho>>
