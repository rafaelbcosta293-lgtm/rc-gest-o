import { describe, expect, it } from 'vitest'
import { mensagemNumeroCliente, podeReceber } from './smsNumeroCliente'

describe('SMS com o nº de cliente', () => {
  it('diz que é informativo, dá o número e explica o tablet', () => {
    const t = mensagemNumeroCliente('Ana Maria Silva', null, 'F26345')
    expect(t.startsWith('Olá Ana!')).toBe(true)
    expect(t).toContain('apenas informativa')
    expect(t).toContain('F26345')
    expect(t).toContain('(26345)')
    expect(t).toContain('registar a sua presença quando vier treinar')
  })
  it('usa o nome preferido', () => {
    expect(mensagemNumeroCliente('Joaquim Pereira', 'Quim', 'L25003').startsWith('Olá Quim!')).toBe(true)
  })
  it('só envia a quem tem número de cliente e telemóvel válido', () => {
    const base = { id: '1', nome: 'X', nome_preferido: null, estado: 'Ativo', enviado: false }
    expect(podeReceber({ ...base, numero_socio: 'F1', telefone: '912345678' })).toBe(true)
    expect(podeReceber({ ...base, numero_socio: null, telefone: '912345678' })).toBe(false)
    expect(podeReceber({ ...base, numero_socio: 'F1', telefone: '123' })).toBe(false)
  })
})
