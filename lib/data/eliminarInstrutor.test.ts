import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { eliminarInstrutorDeVez } from './eliminarInstrutor'

// Um cliente de administração de faz-de-conta que regista o que lhe pedem.
function cliente(opcoes: { semFicha?: boolean; erroAcesso?: string; erroFicha?: string } = {}) {
  const pedidos: string[] = []
  type Resposta = { error: { message: string } | null }
  const updateUserById = vi.fn<(id: string, dados: Record<string, unknown>) => Promise<Resposta>>(async () => ({
    error: opcoes.erroAcesso ? { message: opcoes.erroAcesso } : null,
  }))
  const atualizarFicha = vi.fn<(dados: Record<string, unknown>) => { eq: () => Promise<Resposta> }>(() => ({
    eq: async () => ({ error: opcoes.erroFicha ? { message: opcoes.erroFicha } : null }),
  }))
  const admin = {
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: { id: 'abc', email: 'pessoa@exemplo.pt', app_metadata: { modulos: ['treinos'] } } }, error: null }),
        updateUserById,
      },
    },
    from: (tabela: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opcoes.semFicha ? null : { saiu_em: null }, error: null }) }) }),
      update: atualizarFicha,
      delete: () => ({
        eq: (coluna: string) => {
          pedidos.push(`apagar ${tabela} por ${coluna}`)
          const fim = Promise.resolve({ error: null })
          return Object.assign(fim, { gt: async (c: string, v: string) => (pedidos.push(`só ${c} > ${v}`), { error: null }) })
        },
      }),
    }),
  } as unknown as SupabaseClient
  return { admin, pedidos, updateUserById, atualizarFicha }
}

describe('eliminarInstrutorDeVez', () => {
  it('destrói a conta de acesso e arquiva a ficha, sem a apagar', async () => {
    const c = cliente()
    expect(await eliminarInstrutorDeVez(c.admin, 'abc')).toEqual({ ok: true })

    const conta = c.updateUserById.mock.calls[0][1]
    expect(conta.email).toMatch(/^rc\.privatefitstudio\+perfil-[a-z0-9]+@gmail\.com$/)
    expect(conta.ban_duration).toBe('876000h')
    expect(conta.app_metadata).toMatchObject({ sem_conta: true, eliminado: true, modulos: [] })

    const ficha = c.atualizarFicha.mock.calls[0][0]
    expect(ficha).toMatchObject({ ativo: false, telefone: null })
    expect(ficha.eliminado_em).toBeTruthy()
    expect(ficha.saiu_em).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('só apaga os acessos aos estúdios e as escalas futuras — nunca o histórico', async () => {
    const c = cliente()
    await eliminarInstrutorDeVez(c.admin, 'abc')
    expect(c.pedidos[0]).toBe('apagar perfis_estudios por perfil_id')
    expect(c.pedidos[1]).toBe('apagar escalas por pt_id')
    expect(c.pedidos[2]).toMatch(/^só data > \d{4}-\d{2}-\d{2}$/)
    expect(c.pedidos).toHaveLength(3)
  })

  it('não mexe na ficha se a conta de acesso não se deixar alterar', async () => {
    const c = cliente({ erroAcesso: 'erro na conta' })
    expect(await eliminarInstrutorDeVez(c.admin, 'abc')).toEqual({ ok: false, motivo: 'erro na conta' })
    expect(c.atualizarFicha).not.toHaveBeenCalled()
    expect(c.pedidos).toHaveLength(0)
  })

  it('diz que não encontrou a ficha', async () => {
    const c = cliente({ semFicha: true })
    expect(await eliminarInstrutorDeVez(c.admin, 'abc')).toEqual({ ok: false, motivo: 'Ficha não encontrada.' })
    expect(c.updateUserById).not.toHaveBeenCalled()
  })
})
