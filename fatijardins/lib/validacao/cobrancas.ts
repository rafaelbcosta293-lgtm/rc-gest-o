import { z } from "zod"

import { METODOS_PAGAMENTO } from "@/lib/financas"
import { dataObrigatoria, numeroOpcional, textoObrigatorio, textoOpcional, uuidOpcional } from "./comum"

/**
 * Os nomes dos campos são os das colunas da base de dados, para os erros
 * devolvidos pelo servidor caírem no campo certo do formulário.
 */

/** Dias até ao vencimento propostos numa cobrança nova. */
export const DIAS_VENCIMENTO = 30

/** Valor em euros à portuguesa ("553,50", "1 200", "1.200,50"), maior que zero e até ao cêntimo. */
export const valorEuros = (mensagem: string) =>
  z
    .string()
    .transform((valor) => valor.replace(/€/g, ""))
    .pipe(numeroOpcional({ max: 10_000_000 }))
    .refine((valor) => valor !== null, mensagem)
    .transform((valor) => valor as number)
    .refine((valor) => valor > 0, "O valor tem de ser maior que zero.")
    .refine((valor) => Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6, "Use no máximo 2 casas decimais (cêntimos).")

/** Data opcional ("" → null). */
const dataOpcional = z.union([z.literal("").transform(() => null), dataObrigatoria()])

/** Campos que se podem alterar depois de criada (os mesmos que a BD deixa alterar). */
const camposEditaveis = {
  descricao: textoObrigatorio("Descreva a cobrança (ex.: Revisão da rega).", 300),
  valor: valorEuros("Indique o valor total (com IVA)."),
  data_emissao: dataObrigatoria("Indique a data de emissão."),
  data_vencimento: dataObrigatoria("Indique a data de vencimento."),
  fatura_referencia: textoOpcional(60),
  fatura_data: dataOpcional,
  notas: textoOpcional(2000),
}

function vencimentoDepoisDaEmissao(
  cobranca: { data_emissao: string; data_vencimento: string },
  ctx: z.RefinementCtx
) {
  if (cobranca.data_vencimento < cobranca.data_emissao) {
    ctx.addIssue({
      code: "custom",
      path: ["data_vencimento"],
      message: "O vencimento não pode ser antes da data de emissão.",
    })
  }
}

/**
 * Cobrança nova. Avulsa: o cliente (e o local, opcional; o local define o
 * cliente). Do orçamento: o cliente e o local vêm do orçamento (a BD confirma).
 */
export const esquemaCobranca = z
  .object({
    cliente_id: z.string().refine((valor) => z.uuid().safeParse(valor).success, "Escolha o cliente."),
    local_id: uuidOpcional,
    orcamento_id: uuidOpcional,
    ...camposEditaveis,
  })
  .superRefine(vencimentoDepoisDaEmissao)
export type CamposCobranca = z.input<typeof esquemaCobranca>
export type DadosCobranca = z.output<typeof esquemaCobranca>

/** Editar: o cliente, o local e a origem já não mudam. */
export const esquemaEditarCobranca = z.object(camposEditaveis).superRefine(vencimentoDepoisDaEmissao)
export type CamposEditarCobranca = z.input<typeof esquemaEditarCobranca>
export type DadosEditarCobranca = z.output<typeof esquemaEditarCobranca>

/** Pagamento recebido de uma cobrança (a BD recusa pagar mais do que está em dívida). */
export const esquemaPagamento = z.object({
  data: dataObrigatoria("Indique a data do pagamento."),
  valor: valorEuros("Indique o valor recebido."),
  metodo: z.enum(METODOS_PAGAMENTO, { error: "Escolha como pagou." }),
  referencia: textoOpcional(120),
  notas: textoOpcional(2000),
})
export type CamposPagamento = z.input<typeof esquemaPagamento>
export type DadosPagamento = z.output<typeof esquemaPagamento>
