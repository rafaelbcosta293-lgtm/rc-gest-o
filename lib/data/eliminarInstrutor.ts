import { randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { emailPerfilSemConta } from './acessos'
import { hojeEmLisboa } from './hoje'

const BLOQUEADO = '876000h' // ~100 anos: o login fica impossível

export type ResultadoEliminar = { ok: true } | { ok: false; motivo: string }

// Elimina um instrutor, com o cliente de administração. Quem chama já
// confirmou que é a administração e que a conta não é uma das fixas do
// negócio.
//
// O que desaparece: a pessoa deixa de existir na equipa (não aparece em
// lado nenhum para escolher), perde o acesso a todos os estúdios, e a
// conta de acesso é destruída — o email fica livre, a palavra-passe é
// trocada por uma ao acaso e o login fica bloqueado para sempre. As
// escalas marcadas para depois de hoje também saem.
//
// O que fica: as escalas passadas, o registo de horas, as férias e as
// ausências — e o resto do histórico (treinos, pagamentos, tarefas) —
// continuam guardados com o nome dela. É por isso que a linha em
// "perfis" não é apagada, só marcada com "eliminado_em": se fosse
// apagada, esses registos iam com ela.
export async function eliminarInstrutorDeVez(admin: SupabaseClient, id: string): Promise<ResultadoEliminar> {
  const hoje = hojeEmLisboa()
  const { data: ficha, error: erroLer } = await admin.from('perfis').select('saiu_em').eq('id', id).maybeSingle()
  if (erroLer) return { ok: false, motivo: erroLer.message }
  if (!ficha) return { ok: false, motivo: 'Ficha não encontrada.' }

  // 1.º a conta de acesso: sem isto feito, não se marca nada.
  const { data: conta, error: erroConta } = await admin.auth.admin.getUserById(id)
  if (erroConta || !conta.user) return { ok: false, motivo: erroConta?.message ?? 'Conta não encontrada.' }
  const { error: erroAcesso } = await admin.auth.admin.updateUserById(id, {
    email: emailPerfilSemConta(randomBytes(8).toString('hex')),
    email_confirm: true,
    password: randomBytes(24).toString('base64url'),
    ban_duration: BLOQUEADO,
    app_metadata: { ...conta.user.app_metadata, sem_conta: true, eliminado: true, modulos: [] },
  })
  if (erroAcesso) return { ok: false, motivo: erroAcesso.message }

  // 2.º a ficha: arquivada, sem contacto.
  const { error: erroFicha } = await admin
    .from('perfis')
    .update({ ativo: false, saiu_em: ficha.saiu_em ?? hoje, eliminado_em: new Date().toISOString(), telefone: null })
    .eq('id', id)
  if (erroFicha) return { ok: false, motivo: erroFicha.message }

  // 3.º sai dos estúdios e das escalas que ainda estão para vir.
  const { error: erroEstudios } = await admin.from('perfis_estudios').delete().eq('perfil_id', id)
  if (erroEstudios) return { ok: false, motivo: erroEstudios.message }
  const { error: erroEscalas } = await admin.from('escalas').delete().eq('pt_id', id).gt('data', hoje)
  if (erroEscalas) return { ok: false, motivo: erroEscalas.message }
  return { ok: true }
}
