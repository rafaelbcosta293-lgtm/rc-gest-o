import { describe, expect, it } from 'vitest'
import { agruparPorServico, servicoDoFormulario } from './servicos'

const servicos = [
  { id: 1, nome: 'Treino Personalizado' },
  { id: 2, nome: 'Treino Acompanhado' },
  { id: 3, nome: 'Pilates' },
]

describe('agruparPorServico', () => {
  it('agrupa pela ordem dos serviços e deixa de fora os vazios', () => {
    const g = agruparPorServico(
      [
        { id: 'a', servico_id: 3 },
        { id: 'b', servico_id: 1 },
        { id: 'c', servico_id: 3 },
      ],
      servicos
    )
    expect(g.map((x) => [x.servico.nome, x.itens.map((i) => i.id)])).toEqual([
      ['Treino Personalizado', ['b']],
      ['Pilates', ['a', 'c']],
    ])
  })
})

describe('servicoDoFormulario', () => {
  it('vazio = do estúdio (null); número válido = serviço', () => {
    const f = new FormData()
    f.set('servico_id', '')
    expect(servicoDoFormulario(f)).toBeNull()
    f.set('servico_id', '3')
    expect(servicoDoFormulario(f)).toBe(3)
    f.set('servico_id', 'x')
    expect(servicoDoFormulario(f)).toBeNull()
  })
})
