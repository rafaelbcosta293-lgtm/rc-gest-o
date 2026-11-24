import { describe, expect, it } from 'vitest'
import { chaveDeLocalidade, localidadeExata, procurarLocalidades } from './localidades'

describe('chaveDeLocalidade', () => {
  it('ignora acentos, maiúsculas e pontuação', () => {
    expect(chaveDeLocalidade(' Sta.ª  Catarina da Serra ')).toBe('sta catarina da serra')
    expect(chaveDeLocalidade('FÁTIMA')).toBe('fatima')
  })
})

describe('procurarLocalidades', () => {
  it('não procura com menos de duas letras', () => {
    expect(procurarLocalidades('f')).toEqual([])
  })
  it('encontra pelo início do nome, sem acentos', () => {
    expect(procurarLocalidades('fatim')[0]).toEqual({ nome: 'Fátima', concelho: 'Ourém', distrito: 'Santarém' })
  })
  it('o nome exato vem primeiro, e entre iguais a maior', () => {
    const r = procurarLocalidades('chainca', { limite: 4 })
    expect(r.every((l) => chaveDeLocalidade(l.nome) === 'chainca')).toBe(true)
    expect(procurarLocalidades('leiri')[0]).toEqual({ nome: 'Leiria', concelho: 'Leiria', distrito: 'Leiria' })
  })
  it('com o código postal, a desse código vem primeiro', () => {
    expect(procurarLocalidades('matas')[0].concelho).not.toBe('')
    expect(procurarLocalidades('atouguia', { cp: '2490-000' })[0].concelho).toBe('Ourém')
  })
  it('encontra por uma palavra do meio e por abreviaturas', () => {
    expect(procurarLocalidades('catarina da serra').some((l) => l.nome === 'Santa Catarina da Serra')).toBe(true)
    expect(procurarLocalidades('Sta. Catarina da Serra')[0].nome).toBe('Santa Catarina da Serra')
    expect(procurarLocalidades('Sta.ª Catarina da Serra')[0].nome).toBe('Santa Catarina da Serra')
  })
  it('respeita o limite', () => {
    expect(procurarLocalidades('casal', { limite: 5 })).toHaveLength(5)
  })
})

describe('localidadeExata', () => {
  it('nome único: responde', () => {
    expect(localidadeExata('fatima')).toEqual({ nome: 'Fátima', concelho: 'Ourém', distrito: 'Santarém' })
    expect(localidadeExata('Sta. Catarina da Serra')?.concelho).toBe('Leiria')
  })
  it('nome repetido: só com o código postal', () => {
    expect(localidadeExata('Chainça')).toBeNull()
    expect(localidadeExata('Chainça', '2495-100')?.concelho ?? null).toBe(localidadeExata('Chainça', '2495')?.concelho ?? null)
  })
  it('nome desconhecido: nada', () => {
    expect(localidadeExata('Suíça')).toBeNull()
  })
})
