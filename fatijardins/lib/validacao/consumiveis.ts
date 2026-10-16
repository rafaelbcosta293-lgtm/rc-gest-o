import { z } from "zod"

import { dataObrigatoria, numeroOpcional, textoObrigatorio, textoOpcional, uuidOpcional } from "./comum"
import { UNIDADES_MATERIAL } from "./registos"

/**
 * Esquemas dos consumíveis e dos movimentos de stock. Os nomes dos campos
 * são os das colunas da base de dados, para os erros devolvidos pelo
 * servidor caírem no campo certo do formulário.
 */

/** Maior quantidade aceite (a BD guarda numeric(12,3)). */
const QUANTIDADE_MAXIMA = 1_000_000

/** Tem no máximo estas casas decimais (sem erros de vírgula flutuante). */
function casasDecimais(valor: number, casas: number) {
  const escala = 10 ** casas
  return Math.abs(valor * escala - Math.round(valor * escala)) < 1e-6
}

/** "+3" e "−3" (sinal menos tipográfico) também valem. */
const comSinal = z.string().transform((valor) => valor.trim().replace(/^\+/, "").replace(/^[−–]/, "-"))

/** Quantidade: "2,5" ou "2.5" (o ponto também é decimal), até 3 casas; vazio → null. */
const quantidadeOpcional = comSinal
  .pipe(numeroOpcional({ pontoDecimal: true }))
  .refine((valor) => valor === null || Math.abs(valor) <= QUANTIDADE_MAXIMA, "Quantidade demasiado grande.")
  .refine((valor) => valor === null || casasDecimais(valor, 3), "Use no máximo 3 casas decimais.")

/** Quantidade obrigatória e maior do que zero (entradas e saídas). */
const quantidadePositiva = quantidadeOpcional
  .refine((valor) => valor !== null, "Indique a quantidade.")
  .transform((valor) => valor as number)
  .refine((valor) => valor > 0, "A quantidade tem de ser maior do que zero.")

/** Quantidade igual ou maior do que zero; vazio → null. */
const quantidadeNaoNegativa = quantidadeOpcional.refine(
  (valor) => valor === null || valor >= 0,
  "Não pode ser negativo."
)

/** Preço em euros à portuguesa ("1,85", "1 200", "1.200,50"), até ao cêntimo; vazio → sem preço. */
const precoOpcional = z
  .string()
  .transform((valor) => valor.replace(/€/g, ""))
  .pipe(numeroOpcional({ max: QUANTIDADE_MAXIMA }))
  .refine((valor) => valor === null || valor >= 0, "O preço não pode ser negativo.")
  .refine((valor) => valor === null || casasDecimais(valor, 2), "Use no máximo 2 casas decimais (cêntimos).")

const notasMovimento = textoOpcional(500)

// ---------------------------------------------------------------------
// Consumíveis
// ---------------------------------------------------------------------

/** Nomes amigáveis das unidades (a lista é a dos materiais dos trabalhos). */
export const NOMES_UNIDADE: Record<(typeof UNIDADES_MATERIAL)[number], string> = {
  un: "un — unidades",
  kg: "kg — quilos",
  g: "g — gramas",
  L: "L — litros",
  mL: "mL — mililitros",
  m: "m — metros",
  "m²": "m² — metros quadrados",
  "m³": "m³ — metros cúbicos",
  saco: "saco — sacos",
  caixa: "caixa — caixas",
  h: "h — horas",
}

export const esquemaConsumivel = z.object({
  // Espaços repetidos contam como um (o nome é único, sem contar maiúsculas).
  nome: textoObrigatorio("Indique o nome (ex.: Fio de roçadora 3 mm).", 120).transform((nome) =>
    nome.replace(/\s+/g, " ")
  ),
  categoria: textoOpcional(60),
  unidade: z.enum(UNIDADES_MATERIAL, "Escolha a unidade."),
  stock_minimo: quantidadeNaoNegativa.transform((valor) => valor ?? 0),
  preco_unitario: precoOpcional,
  notas: textoOpcional(2000),
  ativo: z.boolean(),
  /** Só ao criar: quantidade que já existe (fica registada como entrada). */
  stock_inicial: quantidadeNaoNegativa,
})
export type CamposConsumivel = z.input<typeof esquemaConsumivel>
export type DadosConsumivel = z.output<typeof esquemaConsumivel>

// ---------------------------------------------------------------------
// Movimentos de stock (a quantidade é gravada com sinal pelo servidor)
// ---------------------------------------------------------------------

export const esquemaEntrada = z.object({
  quantidade: quantidadePositiva,
  data: dataObrigatoria(),
  preco_unitario: precoOpcional,
  /** Passar o preço desta entrada a ser o preço do consumível. */
  atualizar_preco: z.boolean(),
  notas: notasMovimento,
})
export type CamposEntrada = z.input<typeof esquemaEntrada>
export type DadosEntrada = z.output<typeof esquemaEntrada>

export const esquemaSaida = z.object({
  quantidade: quantidadePositiva,
  data: dataObrigatoria(),
  trabalho_id: uuidOpcional,
  notas: notasMovimento,
})
export type CamposSaida = z.input<typeof esquemaSaida>
export type DadosSaida = z.output<typeof esquemaSaida>

/** Acerto de inventário: o stock contado (o servidor grava a diferença). */
export const esquemaAcerto = z.object({
  stock_contado: quantidadeNaoNegativa
    .refine((valor) => valor !== null, "Indique o stock contado.")
    .transform((valor) => valor as number),
  data: dataObrigatoria(),
  notas: notasMovimento,
})
export type CamposAcerto = z.input<typeof esquemaAcerto>
export type DadosAcerto = z.output<typeof esquemaAcerto>

/** Corrigir um acerto já gravado: a diferença, com sinal (positiva soma, negativa tira). */
export const esquemaEditarAcerto = z.object({
  quantidade: quantidadeOpcional
    .refine((valor) => valor !== null, "Indique a diferença.")
    .transform((valor) => valor as number)
    .refine((valor) => valor !== 0, "A diferença não pode ser zero (apague o acerto)."),
  data: dataObrigatoria(),
  notas: notasMovimento,
})
export type CamposEditarAcerto = z.input<typeof esquemaEditarAcerto>
export type DadosEditarAcerto = z.output<typeof esquemaEditarAcerto>
