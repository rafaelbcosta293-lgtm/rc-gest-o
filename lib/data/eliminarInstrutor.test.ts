import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { eliminarInstrutorDeVez } from './eliminarInstrutor'

function cliente(opcoes: { erroDesligar?: string; erroConta?: string; erroFicha?: string }) {
  const rpc = vi.fn(async () => ({ error: opcoes.erroDesligar ? { message: opcoes.erroDesligar } : null }))
  const deleteUser = vi.fn(async () => ({ error: opcoes.erroConta ? { message: opcoes.erroConta } : null }))
  const updateUserById = vi.fn(async () => ({ error: null }))
  const apagarFicha = vi.fn(async () => ({ error: opcoes.erroFicha ? { message: opcoes.erroFicha } : null }))
  const admin = {
    rpc,
    auth: { admin: { deleteUser, updateUserById } },
    from: () => ({ delete: () => ({ eq: apagarFicha }) }),
  } as unknown as SupabaseClient
  return { admin, rpc, deleteUser, updateUserById, apagarFicha }
}

describe('eliminarInstrutorDeVez', () => {
  it('desliga o histórico e depois apaga a conta', async () => {
    const c = cliente({})
    expect(await eliminarInstrutorDeVez(c.admin, 'abc')).toEqual({ ok: true })
    expect(c.rpc).toHaveBeenCalledWith('desligar_perfil_do_historico', { alvo: 'abc' })
    expect(c.deleteUser).toHaveBeenCalledWith('abc')
    expect(c.apagarFicha).not.toHaveBeenCalled()
  })

  it('não apaga nada se o histórico não se puder desligar', async () => {
    const c = cliente({ erroDesligar: 'Tem 3 registo(s) em x que não podem ficar sem instrutor.' })
    expect(await eliminarInstrutorDeVez(c.admin, 'abc')).toEqual({ ok: false, motivo: 'Tem 3 registo(s) em x que não podem ficar sem instrutor.' })
    expect(c.deleteUser).not.toHaveBeenCalled()
  })

  it('se a conta de acesso resistir, apaga a ficha e bloqueia a conta', async () => {
    const c = cliente({ erroConta: 'Database error deleting user' })
    expect(await eliminarInstrutorDeVez(c.admin, 'abc')).toEqual({ ok: true })
    expect(c.apagarFicha).toHaveBeenCalledWith('id', 'abc')
    expect(c.updateUserById).toHaveBeenCalledWith('abc', { ban_duration: '876000h' })
  })

  it('diz porquê quando nem a ficha se deixa apagar', async () => {
    const c = cliente({ erroConta: 'erro A', erroFicha: 'erro B' })
    expect(await eliminarInstrutorDeVez(c.admin, 'abc')).toEqual({ ok: false, motivo: 'erro A — erro B' })
    expect(c.updateUserById).not.toHaveBeenCalled()
  })
})
