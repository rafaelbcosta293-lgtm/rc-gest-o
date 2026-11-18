'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual } from '@/lib/data/sessao'

// "Visto" na faixa de alterações de acessos (só a administração consegue —
// a RLS de alertas_acesso recusa as outras contas).
export async function marcarAlertasAcessoVistos(formData: FormData) {
  const ids = formData.getAll('id').map(Number).filter(Number.isInteger)
  if (ids.length === 0) return
  const [supabase, sessao] = await Promise.all([createClient(), getSessaoAtual()])
  await supabase.from('alertas_acesso').update({ visto_em: new Date().toISOString(), visto_por: sessao.userId }).in('id', ids)
  revalidatePath('/painel', 'layout')
}
