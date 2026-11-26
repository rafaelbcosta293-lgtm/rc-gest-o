import type { SupabaseClient } from '@supabase/supabase-js'
import { todasAsLinhas } from '@/lib/supabase/todasAsLinhas'
import { hojeEmLisboa } from './hoje'
import type { EstadoLead } from '@/lib/supabase/database.types'
import type { ContactoRelatorio, DadosRelatorioComercial, LeadRelatorio, SessaoRelatorio } from './relatorioComercial'

// Estados que só se alcançam depois de a pessoa ter vindo à visita.
const ESTADOS_DEPOIS_DA_VISITA: EstadoLead[] = ['Experimental realizada', 'Proposta / Em decisão', 'Ganha']

// Tudo o que o relatório comercial precisa, de uma vez, para os estúdios
// indicados e desde "desde" (1 de janeiro do ano que se está a ver): as
// leads, os contactos e as visitas marcadas. As contas fazem-se depois,
// em lib/data/relatorioComercial.ts.
export async function carregarDadosRelatorioComercial(
  supabase: SupabaseClient,
  estudioIds: number[],
  desde: string
): Promise<DadosRelatorioComercial> {
  type LeadLinha = LeadRelatorio & { visita_data: string | null; visita_marcada_em: string | null }
  const [leadsR, contactosR, sessoesR, historicoR] = await Promise.all([
    todasAsLinhas<LeadLinha>((de, ate) =>
      supabase
        .from('leads')
        .select('id, origem, walk_in, walk_in_tipo, estado, entrada, fecho_em, visita_data, visita_marcada_em')
        .in('estudio_id', estudioIds)
        .order('id')
        .range(de, ate)
    ),
    todasAsLinhas<{ lead_id: string; data: string; sucesso: boolean | null }>((de, ate) =>
      supabase
        .from('lead_contactos')
        .select('lead_id, data, sucesso, lead:leads!inner(estudio_id)')
        .in('lead.estudio_id', estudioIds)
        .gte('data', desde)
        .order('id')
        .range(de, ate)
    ),
    todasAsLinhas<{ lead_id: string | null; data: string; criado_em: string; estado: string }>((de, ate) =>
      supabase
        .from('agenda_eventos')
        .select('lead_id, data, criado_em, estado')
        .eq('tipo', 'Sessão experimental')
        .in('estudio_id', estudioIds)
        .or(`data.gte.${desde},criado_em.gte.${desde}`)
        .order('id')
        .range(de, ate)
    ),
    todasAsLinhas<{ lead_id: string }>((de, ate) =>
      supabase.from('lead_stage_history').select('lead_id').eq('estado_novo', 'Experimental realizada').order('id').range(de, ate)
    ),
  ])
  for (const r of [leadsR, contactosR, sessoesR, historicoR]) if (r.error) throw new Error(r.error.message)

  const leads = leadsR.data
  const contactos: ContactoRelatorio[] = contactosR.data.map((c) => ({ lead_id: c.lead_id, data: c.data, sucesso: c.sucesso }))

  const sessoes: SessaoRelatorio[] = sessoesR.data.map((e) => ({
    lead_id: e.lead_id,
    data: e.data,
    // O dia em que a marcação foi feita, na hora de Portugal.
    marcadaEm: hojeEmLisboa(new Date(e.criado_em)),
    cancelada: e.estado === 'Cancelado',
    concluida: e.estado === 'Concluído',
  }))
  // Uma visita marcada só na ficha da lead (sem evento na Agenda nesse
  // dia) também é uma marcação.
  const comEvento = new Set(sessoes.map((s) => `${s.lead_id}|${s.data}`))
  for (const l of leads) {
    if (!l.visita_data || comEvento.has(`${l.id}|${l.visita_data}`)) continue
    sessoes.push({ lead_id: l.id, data: l.visita_data, marcadaEm: l.visita_marcada_em ?? l.visita_data, cancelada: false, concluida: false })
  }

  const compareceram = new Set<string>(historicoR.data.map((h) => h.lead_id))
  for (const l of leads) if (ESTADOS_DEPOIS_DA_VISITA.includes(l.estado)) compareceram.add(l.id)

  return {
    leads: leads.map((l) => ({ id: l.id, origem: l.origem, walk_in: l.walk_in, walk_in_tipo: l.walk_in_tipo, estado: l.estado, entrada: l.entrada, fecho_em: l.fecho_em })),
    contactos,
    sessoes,
    compareceram,
  }
}
