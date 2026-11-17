import { describe, expect, it } from 'vitest'
import { calcularDerivados } from './avaliacoes'

describe('calcularDerivados', () => {
  it('massa gorda em kg = peso × % / 100, a 2 casas', () => {
    expect(calcularDerivados(72.4, 28.3, null).massaGordaKg).toBe(20.49)
  })
  it('IMC a partir do peso e da altura', () => {
    expect(calcularDerivados(70, null, 175).imc).toBe(22.86)
  })
  it('sem dados suficientes fica vazio', () => {
    expect(calcularDerivados(null, 20, 170)).toEqual({ massaGordaKg: null, imc: null })
    expect(calcularDerivados(70, null, 0).imc).toBeNull()
  })
})
