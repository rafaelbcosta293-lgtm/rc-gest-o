import { describe, expect, it } from 'vitest'
import { faltaRegistarSucesso } from './contactoExperimental'

describe('contacto com sucesso ao agendar a sessão experimental', () => {
  it('regista se hoje não há contacto, ou só contactos sem sucesso', () => {
    expect(faltaRegistarSucesso([])).toBe(true)
    expect(faltaRegistarSucesso([{ sucesso: false }, { sucesso: null }])).toBe(true)
  })
  it('não regista a dobrar se já há um contacto com sucesso hoje', () => {
    expect(faltaRegistarSucesso([{ sucesso: false }, { sucesso: true }])).toBe(false)
  })
})
