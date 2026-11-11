import { describe, it, expect } from 'vitest'
import {
  montarRascunho,
  nifValido,
  precoSemIva,
  totalRascunho,
  problemasParaEmitir,
  chaveMetodo,
} from './faturas'

const config = {
  taxa_inscricao: '45,00',
  seguro_anual: '18,50',
  taxa_reativacao: '20,00',
  zsgo_produto_mensalidade: 'MENS',
  zsgo_metodo_mb_way: '7',
}
const cliente = { nome: 'Ana', nif: '123 456 789', morada: null, codigo_postal: null, cidade: null, email: null }
const pagamento = {
  valor: 113.5,
  metodo: 'MB Way',
  data_pagamento: '2026-11-11',
  valido_ate: '2026-11-30',
  inclui_inscricao: true,
  inclui_seguro: true,
  inclui_reativacao: false,
  nota: null,
}

describe('montarRascunho', () => {
  it('cria uma linha por opção escolhida, com o preço de tabela de cada uma', () => {
    const r = montarRascunho({ pagamento, plano: { nome: 'TA 2x', valor: 69 }, cliente, config })
    expect(r.linhas.map((l) => [l.tipo, l.preco_com_iva])).toEqual([
      ['mensalidade', 69],
      ['inscricao', 45],
      ['seguro', 18.5],
    ])
    expect(r.linhas[0].produto_referencia).toBe('MENS')
    expect(r.linhas[0].descricao).toBe('Mensalidade TA 2x — novembro 2026')
    expect(totalRascunho(r)).toBe(132.5)
    expect(r.documento).toMatchObject({ tipo: 'FR', zsgo_metodo_id: '7' })
    expect(r.cliente.nif).toBe('123456789')
  })

  it('sem nenhuma opção escolhida usa o valor pago numa única linha', () => {
    const r = montarRascunho({
      pagamento: { ...pagamento, valor: 30, inclui_inscricao: false, inclui_seguro: false },
      plano: null,
      cliente,
      config,
    })
    expect(r.linhas).toHaveLength(1)
    expect(r.linhas[0]).toMatchObject({ tipo: 'mensalidade', preco_com_iva: 30 })
  })
})

describe('validações', () => {
  it('valida NIF português', () => {
    expect(nifValido('123456789')).toBe(true)
    expect(nifValido('123456780')).toBe(false)
  })

  it('converte preço com IVA para sem IVA com 4 casas', () => {
    expect(precoSemIva(69, 23)).toBe(56.0976)
  })

  it('obriga a escolher o artigo do ZS Go em cada linha', () => {
    const r = montarRascunho({ pagamento, plano: { nome: 'X', valor: 60 }, cliente, config })
    expect(problemasParaEmitir(r).some((p) => p.startsWith('Linha 2'))).toBe(true)
  })

  it('gera chaves de método sem acentos', () => {
    expect(chaveMetodo('Numerário')).toBe('zsgo_metodo_numerario')
  })
})
