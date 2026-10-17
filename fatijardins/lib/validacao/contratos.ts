import { z } from "zod"

import {
  ESTADOS_CONTRATO,
  FREQUENCIAS_CONTRATO,
  TAXAS_IVA_CONTRATO,
  type EstadoContrato,
  type FrequenciaContrato,
} from "@/lib/financas"
import { dataObrigatoria, numeroOpcional, textoObrigatorio, textoOpcional } from "./comum"

/**
 * Esquema do formulário dos contratos de manutenção (criar e editar). Os
 * nomes dos campos são os das colunas, para os erros do servidor caírem no
 * campo certo. Os campos chegam em texto; o servidor volta a validar.
 */

/** Título sugerido para cada frequência (botão de sugestão no formulário). */
export const TITULO_SUGERIDO: Record<FrequenciaContrato, string> = {
  semanal: "Manutenção semanal do jardim",
  quinzenal: "Manutenção quinzenal do jardim",
  mensal: "Manutenção mensal do jardim",
}

/** Dias do mês em que a cobrança pode vencer (a BD aceita 1 a 28). */
export const DIAS_COBRANCA = Array.from({ length: 28 }, (_, i) => i + 1)

/** Avença máxima aceite (a BD guarda numeric(10,2)). */
const VALOR_MAXIMO = 1_000_000

const HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

const FREQUENCIAS = FREQUENCIAS_CONTRATO as [FrequenciaContrato, ...FrequenciaContrato[]]
const ESTADOS = ESTADOS_CONTRATO as [EstadoContrato, ...EstadoContrato[]]
const TAXAS_IVA = TAXAS_IVA_CONTRATO.map(String) as [string, ...string[]]

function idEscolhido(mensagem: string) {
  return z.string().refine((valor) => z.uuid().safeParse(valor).success, mensagem)
}

/** Tem no máximo 2 casas decimais (cêntimos). */
function aoCentimo(valor: number) {
  return Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6
}

export const esquemaContrato = z
  .object({
    cliente_id: idEscolhido("Escolha o cliente."),
    local_id: idEscolhido("Escolha o local."),
    titulo: textoObrigatorio("Indique o título (ex.: Manutenção semanal do jardim).", 160),
    // Um serviço por linha (sem linhas vazias nem espaços a mais).
    servicos: textoOpcional(4000).transform((texto) =>
      texto === null
        ? null
        : texto
            .split("\n")
            .map((linha) => linha.trim())
            .filter(Boolean)
            .join("\n") || null
    ),
    frequencia: z.enum(FREQUENCIAS, { error: "Escolha a frequência das visitas." }),
    data_inicio: dataObrigatoria("Indique a data da primeira visita."),
    data_fim: z
      .string()
      .refine((valor) => valor === "" || dataObrigatoria().safeParse(valor).success, "Data inválida.")
      .transform((valor) => (valor === "" ? null : valor)),
    equipa_id: z
      .string()
      .refine((valor) => valor === "" || z.uuid().safeParse(valor).success, "Escolha a equipa.")
      .transform((valor) => (valor === "" ? null : valor)),
    hora_inicio: z
      .string()
      .trim()
      .refine((valor) => valor === "" || HORA.test(valor), "Hora inválida.")
      .transform((valor) => (valor === "" ? null : valor.slice(0, 5))),
    duracao_prevista_min: z
      .string()
      .refine(
        (valor) => valor === "" || (/^\d{1,4}$/.test(valor) && Number(valor) >= 1 && Number(valor) <= 1440),
        "Duração inválida."
      )
      .transform((valor) => (valor === "" ? null : Number(valor))),
    // Sem IVA, em euros à portuguesa ("120", "120,50", "1.200,50").
    valor_mensal: z
      .string()
      .transform((valor) => valor.replace(/€/g, ""))
      .pipe(numeroOpcional({ max: VALOR_MAXIMO }))
      .refine((valor) => valor !== null, "Indique o valor mensal (sem IVA).")
      .transform((valor) => valor as number)
      .refine((valor) => valor >= 0, "O valor não pode ser negativo.")
      .refine(aoCentimo, "Use no máximo 2 casas decimais (cêntimos)."),
    taxa_iva: z.enum(TAXAS_IVA, { error: "Escolha a taxa de IVA." }).transform(Number),
    dia_cobranca: z
      .string()
      .refine((valor) => /^\d{1,2}$/.test(valor) && Number(valor) >= 1 && Number(valor) <= 28, "Escolha um dia de 1 a 28.")
      .transform(Number),
    estado: z.enum(ESTADOS, { error: "Escolha o estado." }),
    notas: textoOpcional(2000),
  })
  .superRefine((contrato, ctx) => {
    if (contrato.data_fim && contrato.data_fim < contrato.data_inicio) {
      ctx.addIssue({
        code: "custom",
        path: ["data_fim"],
        message: "Tem de ser igual ou posterior à primeira visita.",
      })
    }
  })

export type CamposContrato = z.input<typeof esquemaContrato>
export type DadosContrato = z.output<typeof esquemaContrato>
