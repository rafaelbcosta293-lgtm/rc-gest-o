import type { SupabaseClient } from '@supabase/supabase-js'
import { todasAsLinhas } from '@/lib/supabase/todasAsLinhas'

// Treinos dados (sessões de PT), por dia e por estúdio, juntando as duas
// fontes sem nunca contar o mesmo dia duas vezes:
// - até ao último dia do histórico de cada estúdio (contagens do Google
//   Calendar, tabela treinos_historico) conta o histórico;
// - depois disso conta a Agenda da app (treinos não desmarcados, já
//   passados; um treino em simultâneo — dupla/trio — conta uma vez).

export type TreinoHistorico = { estudio_id: number; data: string; treinos: number }
export type TreinoAgenda = { estudio_id: number; data: string; id: string; grupo_id: string | null }

// estudioId → (AAAA-MM → nº de treinos)
export type TreinosPorMes = Map<number, Map<string, number>>

export function juntarTreinos(historico: TreinoHistorico[], agenda: TreinoAgenda[], hoje: string): TreinosPorMes {
  const corte = new Map<number, string>()
  for (const h of historico) if (h.data > (corte.get(h.estudio_id) ?? '')) corte.set(h.estudio_id, h.data)
  const out: TreinosPorMes = new Map()
  const somar = (e: number, mes: string, n: number) => {
    const m = out.get(e) ?? new Map<string, number>()
    m.set(mes, (m.get(mes) ?? 0) + n)
    out.set(e, m)
  }
  for (const h of historico) somar(h.estudio_id, h.data.slice(0, 7), h.treinos)
  const vistos = new Set<string>()
  for (const a of agenda) {
    if (a.data >= hoje) continue // só os já dados
    const c = corte.get(a.estudio_id)
    if (c && a.data <= c) continue // esse dia já está no histórico
    const chave = a.grupo_id ?? a.id
    if (vistos.has(chave)) continue
    vistos.add(chave)
    somar(a.estudio_id, a.data.slice(0, 7), 1)
  }
  return out
}

// Total de treinos de um conjunto de meses (opcionalmente só um estúdio).
export function treinosEntre(t: TreinosPorMes, deMes: string, ateMes: string, estudioId?: number): number {
  let s = 0
  for (const [e, meses] of t) {
    if (estudioId != null && e !== estudioId) continue
    for (const [m, n] of meses) if (m >= deMes && m <= ateMes) s += n
  }
  return s
}

export async function carregarTreinosDados(supabase: SupabaseClient, estudioIds: number[], hoje: string): Promise<TreinosPorMes> {
  const [historico, agenda] = await Promise.all([
    todasAsLinhas<TreinoHistorico>((de, ate) =>
      supabase.from('treinos_historico').select('estudio_id, data, treinos').in('estudio_id', estudioIds).order('data').range(de, ate)
    ),
    todasAsLinhas<TreinoAgenda>((de, ate) =>
      supabase
        .from('agenda_eventos')
        .select('estudio_id, data, id, grupo_id')
        .in('estudio_id', estudioIds)
        .eq('tipo', 'Treino')
        .neq('estado', 'Cancelado')
        .lt('data', hoje)
        .order('id')
        .range(de, ate)
    ),
  ])
  return juntarTreinos(historico.data, agenda.data, hoje)
}
