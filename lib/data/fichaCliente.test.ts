import { describe, expect, it } from 'vitest'
import { camposEmFalta, ehCampoFicha, type DadosFicha } from './fichaCliente'

const completa: DadosFicha = {
  telefone: '912345678',
  email: 'a@b.pt',
  nif: '123456789',
  nascimento: '1990-01-01',
  genero: 'Feminino',
  morada: 'Rua A',
  codigo_postal: '2495-000',
  cidade: 'Fátima',
  frequencia_semanal: 2,
  pt_principal_id: 'x',
  inicio_contrato: '2025-01-01',
  objetivo: 'Força',
}

describe('camposEmFalta', () => {
  it('ficha completa não tem nada em falta', () => {
    expect(camposEmFalta(completa)).toEqual([])
  })
  it('texto só com espaços conta como vazio; 0 treinos não', () => {
    expect(camposEmFalta({ ...completa, nif: '  ', email: null, frequencia_semanal: 0 })).toEqual(['email', 'nif'])
  })
  it('morada incompleta se faltar o código postal ou a localidade', () => {
    expect(camposEmFalta({ ...completa, codigo_postal: null })).toEqual(['morada'])
    expect(camposEmFalta({ ...completa, cidade: '' })).toEqual(['morada'])
  })
  it('mantém a ordem dos campos', () => {
    expect(camposEmFalta({ ...completa, objetivo: null, telefone: null, pt_principal_id: null })).toEqual([
      'telefone',
      'instrutor',
      'objetivo',
    ])
  })
  it('ehCampoFicha', () => {
    expect(ehCampoFicha('nif')).toBe(true)
    expect(ehCampoFicha('qualquer')).toBe(false)
    expect(ehCampoFicha(undefined)).toBe(false)
  })
})
