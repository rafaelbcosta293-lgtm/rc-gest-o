import { describe, expect, it } from 'vitest'
import { normalizarTelefoneLead } from './leads'

describe('normalizarTelefoneLead', () => {
  it('adiciona o prefixo +351 a um número nacional de 9 dígitos', () => {
    expect(normalizarTelefoneLead('912345678')).toBe('+351912345678')
  })

  it('remove espaços e parênteses antes de normalizar', () => {
    expect(normalizarTelefoneLead('912 345 678')).toBe('+351912345678')
    expect(normalizarTelefoneLead('(912) 345-678')).toBe('+351912345678')
  })

  it('mantém um número que já vem com "+"', () => {
    expect(normalizarTelefoneLead('+351912345678')).toBe('+351912345678')
  })

  it('adiciona "+" a um número que já vem com 351 sem o "+"', () => {
    expect(normalizarTelefoneLead('351912345678')).toBe('+351912345678')
  })

  it('reconhece o prefixo internacional "00351"', () => {
    expect(normalizarTelefoneLead('00351912345678')).toBe('+351912345678')
  })

  it('devolve null quando não há telefone', () => {
    expect(normalizarTelefoneLead(null)).toBeNull()
    expect(normalizarTelefoneLead(undefined)).toBeNull()
    expect(normalizarTelefoneLead('')).toBeNull()
  })

  it('não perde um formato que não reconhece — só limpa os espaços', () => {
    expect(normalizarTelefoneLead('21 123 4567')).toBe('211234567')
  })
})
