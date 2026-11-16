import type { SupabaseClient } from '@supabase/supabase-js'

// Os números que aparecem no menu do estúdio, ao lado de Leads e de
// Pagamentos — o que há para tratar hoje. Nunca partem a página: se a
// conta não tiver acesso ou algo falhar, fica 0 (sem número).

// Leads em aberto com contacto marcado para hoje (ou já atrasado) ou
// com visita hoje.
export async function contarLeadsParaHoje(supabase: SupabaseClient, estudioId: number, hoje: string): Promise<number> {
  const { count, error } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('estudio_id', estudioId)
    .not('estado', 'in', '("Ganha","Perdida")')
    .or(`proximo_contacto.lte.${hoje},visita_data.eq.${hoje}`)
  return error ? 0 : (count ?? 0)
}

// Clientes (não inativos) sem mensalidade em dia — os "atrasados" da
// página de Pagamentos.
export async function contarPagamentosEmAtraso(supabase: SupabaseClient, estudioId: number): Promise<number> {
  const { data, error } = await supabase.rpc('contar_pagamentos_em_atraso', { p_estudio: estudioId })
  return error || typeof data !== 'number' ? 0 : data
}
