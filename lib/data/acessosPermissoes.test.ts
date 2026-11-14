import { describe, expect, it } from 'vitest'
import {
  MODULOS_CONTA_PESSOAL_OMISSAO,
  ehContaFixa,
  ehEmailSemConta,
  emailPerfilSemConta,
  permissoesDaConta,
} from './acessos'

describe('permissões das contas pessoais', () => {
  it('sem nada definido usa os módulos de omissão e a agenda só para ver', () => {
    expect(permissoesDaConta(undefined)).toEqual({ modulos: MODULOS_CONTA_PESSOAL_OMISSAO, agendaEscrita: false })
    expect(permissoesDaConta({ provider: 'email' }).modulos).toEqual(MODULOS_CONTA_PESSOAL_OMISSAO)
  })

  it('respeita o que a Administração definiu, incluindo nenhum módulo', () => {
    expect(permissoesDaConta({ modulos: ['agenda', 'clientes', 7], agenda_escrita: true })).toEqual({
      modulos: ['agenda', 'clientes'],
      agendaEscrita: true,
    })
    expect(permissoesDaConta({ modulos: [] }).modulos).toEqual([])
  })
})

describe('perfis sem conta', () => {
  it('têm um email interno reconhecível, que não é uma conta fixa', () => {
    const email = emailPerfilSemConta('AB12-cd')
    expect(email).toBe('rc.privatefitstudio+perfil-ab12cd@gmail.com')
    expect(ehEmailSemConta(email)).toBe(true)
    expect(ehContaFixa(email)).toBe(false)
    expect(ehEmailSemConta('rc.privatefitstudio@gmail.com')).toBe(false)
    expect(ehEmailSemConta('alguem@gmail.com')).toBe(false)
  })
})
