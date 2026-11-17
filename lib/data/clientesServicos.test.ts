import { describe, expect, it } from 'vitest'
import { planoDeInscricoes, servicosDoFormulario, servicosLigados } from './clientesServicos'

const hoje = '2026-11-17'

describe('planoDeInscricoes', () => {
  it('serviço novo entra Pendente com início hoje; PT não entra aqui', () => {
    expect(planoDeInscricoes([1, 3], [], hoje)).toEqual([{ servicoId: 3, estado: 'Pendente', saiu_em: null, inicio: hoje }])
  })
  it('tirar um serviço deixa-o Inativo com a data de saída', () => {
    expect(planoDeInscricoes([1], [{ servicoId: 2, estado: 'Ativo', inicio: '2026-10-01', saiuEm: null }], hoje)).toEqual([
      { servicoId: 2, estado: 'Inativo', saiu_em: hoje },
    ])
  })
  it('voltar a escolher um Inativo passa a Pendente; ativo que continua não muda', () => {
    expect(
      planoDeInscricoes(
        [2, 3],
        [
          { servicoId: 2, estado: 'Inativo', inicio: '2026-01-01', saiuEm: '2026-05-01' },
          { servicoId: 3, estado: 'Ativo', inicio: '2026-10-01', saiuEm: null },
        ],
        hoje
      )
    ).toEqual([{ servicoId: 2, estado: 'Pendente', saiu_em: null }])
  })
})

describe('servicosLigados', () => {
  it('PT pela ficha; outros enquanto não estiverem Inativos', () => {
    expect(
      servicosLigados(true, [
        { servicoId: 2, estado: 'Pendente', inicio: null, saiuEm: null },
        { servicoId: 3, estado: 'Inativo', inicio: null, saiuEm: null },
      ])
    ).toEqual([1, 2])
  })
})

describe('servicosDoFormulario', () => {
  it('sem o marcador não mexe; com ele lê as caixas', () => {
    const f = new FormData()
    f.append('servicos', '2')
    expect(servicosDoFormulario(f)).toBeNull()
    f.set('servicos_enviados', '1')
    f.append('servicos', '3')
    expect(servicosDoFormulario(f)).toEqual([2, 3])
  })
})
