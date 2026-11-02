import { describe, expect, it } from 'vitest'
import { preencherMensagem } from './aniversarios'

describe('preencherMensagem', () => {
  it('substitui {nome}', () => {
    expect(preencherMensagem('Olá {nome}!', 'Ana')).toBe('Olá Ana!')
  })

  it('usa só o primeiro nome quando o nome é composto', () => {
    expect(preencherMensagem('Olá {nome}!', 'Maria Albertina Rodrigues Nunes Pena')).toBe('Olá Maria!')
  })

  it('substitui {estimado} por "estimada" para género Feminino', () => {
    expect(preencherMensagem('{nome}, {estimado} cliente', 'Ana', 'Feminino')).toBe('Ana, estimada cliente')
  })

  it('substitui {estimado} por "estimado" para género Masculino', () => {
    expect(preencherMensagem('{nome}, {estimado} cliente', 'Bruno', 'Masculino')).toBe('Bruno, estimado cliente')
  })

  it('usa "estimado" quando o género é desconhecido (null ou omitido)', () => {
    expect(preencherMensagem('{estimado} cliente', 'Ana', null)).toBe('estimado cliente')
    expect(preencherMensagem('{estimado} cliente', 'Ana')).toBe('estimado cliente')
  })
})
