import type { SupabaseClient } from '@supabase/supabase-js'

// Quantos alertas estão por resolver num estúdio — o número que aparece
// no menu, o mesmo que o Centro de alertas mostra no topo: a gestão vê
// todos; os outros só os destinados ao seu papel. Nunca parte a página.
export async function contarAlertasAbertos(supabase: SupabaseClient, estudioId: number, papel: string | null): Promise<number> {
  const ehGestao = papel === 'admin' || papel === 'studio_manager'
  let consulta = supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('estudio_id', estudioId).neq('estado', 'Resolvido')
  if (!ehGestao) {
    if (!papel) return 0
    consulta = consulta.eq('papel_destinatario', papel)
  }
  const { count, error } = await consulta
  return error ? 0 : (count ?? 0)
}
