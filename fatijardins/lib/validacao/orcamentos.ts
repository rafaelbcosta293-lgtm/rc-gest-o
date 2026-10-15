import { z } from "zod"

import { TAXAS_IVA, TIPOS_LINHA } from "@/lib/orcamentos"
import { dataObrigatoria, numeroOpcional, textoObrigatorio, textoOpcional, uuidOpcional } from "./comum"
import { TIPOS_TRABALHO } from "./trabalhos"

/**
 * Os nomes dos campos são os das colunas da base de dados, para os erros
 * devolvidos pelo servidor caírem no campo certo do formulário.
 */

function idEscolhido(mensagem: string) {
  return z.string().refine((valor) => z.uuid().safeParse(valor).success, mensagem)
}

/** Dados do orçamento (criar e editar o rascunho). O cliente vem do local (a BD confirma). */
export const esquemaOrcamento = z
  .object({
    cliente_id: idEscolhido("Escolha o cliente."),
    local_id: idEscolhido("Escolha o local."),
    visita_id: uuidOpcional,
    titulo: textoObrigatorio("Indique o título (ex.: Arranjo do jardim da entrada).", 160),
    descricao: textoOpcional(4000),
    data: dataObrigatoria("Indique a data do orçamento."),
    validade: dataObrigatoria("Indique até quando é válido."),
    condicoes: textoOpcional(4000),
    notas_internas: textoOpcional(4000),
  })
  .superRefine((orcamento, ctx) => {
    if (orcamento.validade < orcamento.data) {
      ctx.addIssue({ code: "custom", path: ["validade"], message: "Tem de ser igual ou posterior à data do orçamento." })
    }
  })
export type CamposOrcamento = z.input<typeof esquemaOrcamento>
export type DadosOrcamento = z.output<typeof esquemaOrcamento>

/** Tem no máximo estas casas decimais (sem erros de vírgula flutuante). */
function casasDecimais(valor: number, casas: number) {
  const escala = 10 ** casas
  return Math.abs(valor * escala - Math.round(valor * escala)) < 1e-6
}

/** Quantidade: "2,5" ou "2.5" (o ponto também é decimal), até 3 casas. */
const quantidade = numeroOpcional({ pontoDecimal: true })
  .refine((valor) => valor !== null, "Indique a quantidade.")
  .transform((valor) => valor as number)
  .refine((valor) => valor > 0, "A quantidade tem de ser maior que zero.")
  .refine((valor) => valor <= 1_000_000, "Quantidade demasiado grande.")
  .refine((valor) => casasDecimais(valor, 3), "Use no máximo 3 casas decimais.")

/** Preço em euros à portuguesa ("12,50", "1 200", "1.200,50"), até ao cêntimo. */
const precoUnitario = z
  .string()
  .transform((valor) => valor.replace(/€/g, ""))
  .pipe(numeroOpcional({ min: 0, max: 10_000_000 }))
  .refine((valor) => valor !== null, "Indique o preço unitário (0 se não se cobra).")
  .transform((valor) => valor as number)
  .refine((valor) => casasDecimais(valor, 2), "Use no máximo 2 casas decimais (cêntimos).")

const taxaIva = z
  .string()
  .refine((valor) => valor !== "" && (TAXAS_IVA as readonly number[]).includes(Number(valor)), "Escolha a taxa de IVA.")
  .transform(Number)

/** Uma linha do orçamento. */
export const esquemaLinha = z.object({
  tipo: z.enum(TIPOS_LINHA, { error: "Escolha o tipo." }),
  descricao: textoObrigatorio("Descreva a linha (ex.: Corte e limpeza da sebe).", 500),
  quantidade,
  unidade: textoObrigatorio("Indique a unidade (ex.: h, un, m²).", 20),
  preco_unitario: precoUnitario,
  taxa_iva: taxaIva,
})
export type CamposLinha = z.input<typeof esquemaLinha>
export type DadosLinha = z.output<typeof esquemaLinha>

const HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

/** Converter um orçamento aceite em trabalho: dia, equipa (opcional), hora (opcional) e tipo. */
export const esquemaConverter = z.object({
  data: dataObrigatoria("Indique o dia do trabalho."),
  equipa_id: uuidOpcional,
  hora_inicio: z
    .string()
    .trim()
    .refine((valor) => valor === "" || HORA.test(valor), "Hora inválida.")
    .transform((valor) => (valor === "" ? null : valor.slice(0, 5))),
  tipo: z.enum(TIPOS_TRABALHO, { error: "Escolha o tipo." }),
})
export type CamposConverter = z.input<typeof esquemaConverter>
export type DadosConverter = z.output<typeof esquemaConverter>
