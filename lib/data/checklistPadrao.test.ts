import { describe, expect, it } from 'vitest'
import { CHECKLIST_PADRAO, chaveItem, itensEmFalta } from './checklistPadrao'

describe('checklist padrão', () => {
  it('tem todos os itens do formulário', () => {
    const conta = (tipo: 'Abertura' | 'Fecho') => CHECKLIST_PADRAO[tipo].reduce((s, x) => s + x.itens.length, 0)
    expect(conta('Abertura')).toBe(17)
    expect(conta('Fecho')).toBe(15)
  })

  it('não repete itens que já existem com outra grafia', () => {
    expect(chaveItem('  Ligar Música. ')).toBe(chaveItem('ligar musica'))
    const emFalta = itensEmFalta('Abertura', [{ item: 'LIGAR MÚSICA' }, { item: 'Climatização ligada e ajustada.' }])
    expect(emFalta).toHaveLength(15)
    expect(emFalta.some((x) => x.item === 'Ligar música')).toBe(false)
    expect(emFalta[0]).toEqual({ secao: 'Ambiente', item: 'Iluminação geral ligada e regulada na intensidade correta' })
  })

  it('nada em falta quando o modelo já é o padrão', () => {
    const todos = CHECKLIST_PADRAO.Fecho.flatMap((s) => s.itens.map((item) => ({ item })))
    expect(itensEmFalta('Fecho', todos)).toEqual([])
  })
})
