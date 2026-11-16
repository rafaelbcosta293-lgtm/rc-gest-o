import { describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { montarPagamentosCaixa, type DadosPagamentosCaixa } from './pagamentosCaixaMes'
import { gerarPdfPagamentosCaixa } from '@/lib/pdf/pagamentosCaixaPdf'

const pag = (extra: Partial<DadosPagamentosCaixa['pagamentos'][number]>): DadosPagamentosCaixa['pagamentos'][number] => ({
  valor: 60,
  desconto: 0,
  metodo: 'Numerário',
  data_pagamento: '2026-10-05',
  mensalidade: true,
  inclui_inscricao: false,
  inclui_seguro: false,
  inclui_reativacao: false,
  anulado_em: null,
  motivo_anulacao: null,
  quem_fez: null,
  registado_por: 'conta-fatima',
  cliente: { nome: 'Maria Exemplo', estudio_id: 1 },
  plano: { nome: '2x semana' },
  ...extra,
})

const base: DadosPagamentosCaixa = {
  ano: 2026,
  mes: 10,
  estudios: [
    { id: 1, nome: 'Fátima' },
    { id: 2, nome: 'Leiria' },
  ],
  nomes: new Map([
    ['carolina', 'Carolina Ribeiro'],
    ['conta-fatima', 'RC Fátima'],
  ]),
  pagamentos: [
    pag({ data_pagamento: '2026-10-12', valor: '75.00', desconto: '5.00', metodo: 'MB Way', quem_fez: 'carolina', inclui_seguro: true }),
    pag({}),
    pag({ valor: 30, metodo: 'Multibanco', mensalidade: false, plano: null }),
    pag({ valor: 60, anulado_em: '2026-10-06T10:00:00Z', motivo_anulacao: 'Lançado em duplicado' }),
    pag({ valor: 80, cliente: { nome: 'João de Leiria', estudio_id: 2 } }),
  ],
  vendas: [{ estudio_id: 1, data: '2026-10-07', categoria: 'Bar', descricao: 'Água 0,5 L', valor: '1.50', metodo: 'Numerário', cliente: null }],
  fechos: [
    { estudio_id: 1, data: '2026-10-05', valor_numerario_dia: 60, saldo_anterior: 100, valor_contado: 155, saidas_caixa_dia: 0, outros_entrada_dia: 0, outros_saida_dia: 0, nota: 'faltam 5 €', quem_fez: 'carolina', registado_por: 'conta-fatima' },
    { estudio_id: 1, data: '2026-10-07', valor_numerario_dia: 1.5, saldo_anterior: 155, valor_contado: 146.5, saidas_caixa_dia: 10, outros_entrada_dia: 0, outros_saida_dia: 0, nota: null, quem_fez: null, registado_por: 'conta-fatima' },
  ],
}

describe('montarPagamentosCaixa', () => {
  const mes = montarPagamentosCaixa(base)
  const fatima = mes.estudios[0]

  it('separa por estúdio, por ordem de data, e deixa os anulados de fora dos totais', () => {
    expect(fatima.pagamentos.map((p) => p.data)).toEqual(['2026-10-05', '2026-10-05', '2026-10-12'])
    expect(fatima.anulados).toHaveLength(1)
    expect(fatima.totalPagamentos).toBe(165)
    expect(fatima.descontos).toBe(5)
    expect(fatima.mensalidades).toBe(2)
    expect(mes.estudios[1].totalPagamentos).toBe(80)
  })

  it('soma por método, com as vendas incluídas', () => {
    expect(fatima.totalVendas).toBe(1.5)
    expect(fatima.porMetodo).toEqual({ Numerário: 61.5, 'MB Way': 75, 'TPA / Transferências': 30 })
  })

  it('diz quem recebeu: a pessoa escolhida ou, se não houver, a conta', () => {
    expect(fatima.pagamentos[2].quem).toBe('Carolina Ribeiro')
    expect(fatima.pagamentos[0].quem).toBe('RC Fátima')
    expect(fatima.pagamentos[2].descricao).toBe('2x semana + seguro')
  })

  it('calcula o esperado e a diferença de cada fecho de caixa', () => {
    expect(fatima.fechos[0]).toMatchObject({ esperado: 160, contado: 155, diferenca: -5, quem: 'Carolina Ribeiro' })
    expect(fatima.fechos[1]).toMatchObject({ esperado: 146.5, diferenca: 0 })
    expect(fatima.somaDiferencas).toBe(-5)
  })
})

describe('gerarPdfPagamentosCaixa', () => {
  it('faz um PDF com o resumo e as páginas de cada estúdio', async () => {
    const bytes = await gerarPdfPagamentosCaixa(montarPagamentosCaixa(base), new Date('2026-11-01T06:20:00Z'))
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(3)
    expect(doc.getTitle()).toBe('Pagamentos e caixa — outubro de 2026')
    if (process.env.PDF_DE_EXEMPLO) writeFileSync(process.env.PDF_DE_EXEMPLO, bytes)
  })
})
