import type { SupabaseClient } from '@supabase/supabase-js'
import { hojeEmLisboa } from './hoje'

// Clientes que hoje tentaram fazer check-in no tablet sem a mensalidade em
// dia (a presença não ficou registada) e que ainda não regularizaram:
// desaparecem da lista assim que houver um pagamento de mensalidade válido
// para hoje nesse serviço.

export type CheckinSemMensalidade = { clienteId: string; nome: string; horas: string[] }

type Tentativa = {
  criado_em: string
  servico_id: number | null
  cliente: { id: string; nome: string; nome_preferido: string | null } | null
}

export function agruparPorCliente(
  tentativas: Tentativa[],
  hoje: string,
  regularizados: Set<string> // `${clienteId}:${servicoId}`
): CheckinSemMensalidade[] {
  const out = new Map<string, CheckinSemMensalidade>()
  for (const t of tentativas) {
    if (!t.cliente || hojeEmLisboa(new Date(t.criado_em)) !== hoje) continue
    if (regularizados.has(`${t.cliente.id}:${t.servico_id}`)) continue
    const hora = new Date(t.criado_em).toLocaleTimeString('pt-PT', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit' })
    const r = out.get(t.cliente.id) ?? { clienteId: t.cliente.id, nome: t.cliente.nome, horas: [] }
    if (!r.horas.includes(hora)) r.horas.push(hora)
    out.set(t.cliente.id, r)
  }
  return [...out.values()]
}

export async function carregarCheckinsSemMensalidade(supabase: SupabaseClient, estudioId: number): Promise<CheckinSemMensalidade[]> {
  const hoje = hojeEmLisboa()
  const { data, error } = await supabase
    .from('checkin_tentativas')
    .select('criado_em, servico_id, cliente:clientes(id, nome, nome_preferido), posto:checkin_postos!inner(estudio_id)')
    .eq('motivo', 'sem_mensalidade')
    .eq('posto.estudio_id', estudioId)
    // A margem de 1 h cobre a hora de verão; o dia de Lisboa filtra-se em agruparPorCliente.
    .gte('criado_em', `${hoje}T00:00:00+01:00`)
    .order('criado_em')
  if (error || !data?.length) return []
  const tentativas = data as unknown as Tentativa[]
  const ids = [...new Set(tentativas.map((t) => t.cliente?.id).filter((x): x is string => !!x))]
  const { data: pags } = await supabase
    .from('pagamentos')
    .select('cliente_id, servico_id')
    .in('cliente_id', ids)
    .is('anulado_em', null)
    .eq('mensalidade', true)
    .gte('valido_ate', hoje)
  const regularizados = new Set(((pags ?? []) as { cliente_id: string; servico_id: number }[]).map((p) => `${p.cliente_id}:${p.servico_id}`))
  return agruparPorCliente(tentativas, hoje, regularizados)
}
