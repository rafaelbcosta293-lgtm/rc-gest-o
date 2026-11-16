import type { SupabaseClient } from '@supabase/supabase-js'

const BLOQUEADO = '876000h' // ~100 anos: o login fica impossível

export type ResultadoEliminar = { ok: true } | { ok: false; motivo: string }

// Elimina um instrutor de vez (ficha e conta de acesso), com o cliente
// de administração. Quem chama já confirmou que é a administração e que
// a conta não é uma das fixas do negócio.
//
// 1.º desfaz as ligações do histórico à ficha ("registado por", "criado
//    por"… — os registos ficam, sem o nome dele); é tudo ou nada: se
//    houver registos que não podem ficar sem instrutor, nada muda.
// 2.º apaga a conta — a ficha, as escalas, o registo de horas, as
//    férias, as ausências e os acessos aos estúdios vão com ela.
export async function eliminarInstrutorDeVez(admin: SupabaseClient, id: string): Promise<ResultadoEliminar> {
  const { error: erroDesligar } = await admin.rpc('desligar_perfil_do_historico', { alvo: id })
  if (erroDesligar) return { ok: false, motivo: erroDesligar.message }

  const { error } = await admin.auth.admin.deleteUser(id)
  if (!error) return { ok: true }

  // A conta de acesso não se deixou apagar: apaga-se a ficha (deixa de
  // aparecer na equipa) e a conta fica bloqueada para sempre.
  const { error: erroFicha } = await admin.from('perfis').delete().eq('id', id)
  if (erroFicha) return { ok: false, motivo: `${error.message} — ${erroFicha.message}` }
  await admin.auth.admin.updateUserById(id, { ban_duration: BLOQUEADO })
  return { ok: true }
}
