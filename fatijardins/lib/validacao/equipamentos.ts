import { z } from "zod"

import { eDataValida } from "@/lib/datas"
import {
  ESTADOS_EQUIPAMENTO,
  FORMATO_MATRICULA,
  normalizarMatricula,
  TIPOS_EQUIPAMENTO,
  TIPOS_MANUTENCAO,
} from "@/lib/recursos"
import { dataObrigatoria, numeroOpcional, textoObrigatorio, textoOpcional, uuidOpcional } from "./comum"

/**
 * Esquemas dos equipamentos e das manutenções. Os nomes dos campos são os
 * das colunas da base de dados, para os erros devolvidos pelo servidor
 * caírem no campo certo do formulário.
 */

/** Data opcional (input type=date): vazio → null; tem de existir e estar entre 2000 e 2100. */
const dataOpcional = z
  .string()
  .refine((valor) => valor === "" || eDataValida(valor), "Data inválida.")
  .transform((valor) => (valor === "" ? null : valor))

/** Tem no máximo estas casas decimais (sem erros de vírgula flutuante). */
function casasDecimais(valor: number, casas: number) {
  const escala = 10 ** casas
  return Math.abs(valor * escala - Math.round(valor * escala)) < 1e-6
}

export const MENSAGEM_MATRICULA = "Matrícula no formato AA-12-BC"
export const MENSAGEM_MATRICULA_REPETIDA = "Já existe um equipamento com esta matrícula."

/**
 * Equipamento (criar e editar). Matrícula e IPO só contam nas viaturas: se
 * o tipo deixar de ser viatura, gravam-se a null.
 */
export const esquemaEquipamento = z
  .object({
    nome: textoObrigatorio("Indique o nome (ex.: Carrinha Ford Transit).", 120),
    tipo: z.enum(TIPOS_EQUIPAMENTO, "Escolha o tipo."),
    marca: textoOpcional(80),
    modelo: textoOpcional(80),
    numero_serie: textoOpcional(80),
    // "aa12bc" ou "AA 12 BC" → "AA-12-BC".
    matricula: z.string().transform((valor) => (valor.trim() === "" ? "" : normalizarMatricula(valor))),
    estado: z.enum(ESTADOS_EQUIPAMENTO, "Escolha o estado."),
    equipa_id: uuidOpcional,
    colaborador_id: uuidOpcional,
    data_aquisicao: dataOpcional,
    proxima_revisao: dataOpcional,
    seguro_ate: dataOpcional,
    ipo_ate: dataOpcional,
    notas: textoOpcional(10_000),
  })
  .superRefine((equipamento, ctx) => {
    if (equipamento.tipo === "viatura" && equipamento.matricula && !FORMATO_MATRICULA.test(equipamento.matricula)) {
      ctx.addIssue({ code: "custom", path: ["matricula"], message: MENSAGEM_MATRICULA })
    }
  })
  .transform((equipamento) => {
    const viatura = equipamento.tipo === "viatura"
    return {
      ...equipamento,
      matricula: viatura && equipamento.matricula ? equipamento.matricula : null,
      ipo_ate: viatura ? equipamento.ipo_ate : null,
    }
  })
export type CamposEquipamento = z.input<typeof esquemaEquipamento>
export type DadosEquipamento = z.output<typeof esquemaEquipamento>

/** Mudar o estado (gerente e chefe), com uma nota opcional (ex.: descrever a avaria). */
export const esquemaMudarEstado = z.object({
  estado: z.enum(ESTADOS_EQUIPAMENTO, "Escolha o estado."),
  nota: textoOpcional(500),
})
export type CamposMudarEstado = z.input<typeof esquemaMudarEstado>
export type DadosMudarEstado = z.output<typeof esquemaMudarEstado>

/** Custo em euros à portuguesa ("285,40", "1 200", "1.200,50"), até ao cêntimo; vazio → null. */
const custoOpcional = z
  .string()
  .transform((valor) => valor.replace(/€/g, ""))
  .pipe(numeroOpcional({ min: 0, max: 99_999_999 }))
  .refine((valor) => valor === null || casasDecimais(valor, 2), "Use no máximo 2 casas decimais (cêntimos).")

/** Quilómetros ou horas ("152 340", "152.340" ou "210,5"), com uma casa decimal. */
const contadorOpcional = numeroOpcional({ min: 0, max: 999_999_999 }).refine(
  (valor) => valor === null || casasDecimais(valor, 1),
  "Use no máximo 1 casa decimal."
)

/** Manutenções que renovam um prazo do equipamento, e a coluna correspondente. */
export const PRAZO_DA_MANUTENCAO = {
  revisao: "proxima_revisao",
  ipo: "ipo_ate",
  seguro: "seguro_ate",
} as const

export type TipoComPrazo = keyof typeof PRAZO_DA_MANUTENCAO

export function eTipoComPrazo(tipo: string): tipo is TipoComPrazo {
  return Object.hasOwn(PRAZO_DA_MANUTENCAO, tipo)
}

/**
 * Manutenção. Numa revisão, IPO ou seguro, nova_data (opcional) é a próxima
 * revisão / IPO válida até / seguro válido até, e atualiza o equipamento.
 */
export const esquemaManutencao = z
  .object({
    data: dataObrigatoria("Indique a data da manutenção."),
    tipo: z.enum(TIPOS_MANUTENCAO, "Escolha o tipo."),
    descricao: textoOpcional(2000),
    custo: custoOpcional,
    contador: contadorOpcional,
    nova_data: dataOpcional,
  })
  .superRefine((manutencao, ctx) => {
    if (manutencao.nova_data && eTipoComPrazo(manutencao.tipo) && manutencao.nova_data <= manutencao.data) {
      ctx.addIssue({ code: "custom", path: ["nova_data"], message: "Tem de ser depois da data da manutenção." })
    }
  })
  .transform((manutencao) => ({
    ...manutencao,
    nova_data: eTipoComPrazo(manutencao.tipo) ? manutencao.nova_data : null,
  }))
export type CamposManutencao = z.input<typeof esquemaManutencao>
export type DadosManutencao = z.output<typeof esquemaManutencao>
