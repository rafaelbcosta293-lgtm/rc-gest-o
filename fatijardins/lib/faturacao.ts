/**
 * Faturação: a app NÃO emite faturas (em Portugal têm de sair de software
 * certificado pela AT). O gerente emite a fatura no programa de faturação e
 * escreve na cobrança a referência (ex.: "FT 2026/123") e a data.
 *
 * Preparação para uma integração futura (InvoiceXpress, Moloni, Vendus…):
 * um adaptador que implemente esta interface pode criar a fatura no
 * programa a partir de uma cobrança e devolver a referência a gravar em
 * cobrancas.fatura_referencia / fatura_data. Ainda não há nenhum.
 */
export type DadosFatura = {
  cliente: { nome: string; nif: string | null; morada: string | null; codigoPostal: string | null; localidade: string | null }
  descricao: string
  /** Total com IVA, em euros. */
  valor: number
  dataEmissao: string
  dataVencimento: string
}

export type FaturaEmitida = {
  referencia: string
  data: string
  /** Ligação para o PDF no programa de faturação, se existir. */
  url?: string
}

export interface ProgramaFaturacao {
  nome: string
  emitirFatura(dados: DadosFatura): Promise<FaturaEmitida>
}
