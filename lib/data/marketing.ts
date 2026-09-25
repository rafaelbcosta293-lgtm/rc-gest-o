// Funil de marketing (leads → agendamentos → visitas/walk-ins → fechos),
// resumido para um intervalo de datas qualquer — usado tanto no resumo
// rápido de hoje (Coordenação) como no calendário histórico
// (Coordenação → Marketing), para as duas partes nunca terem contas
// diferentes para a mesma coisa.

export type LeadMarketing = {
  estado: string
  entrada: string
  visita_data: string | null
  visita_marcada_em: string | null
  walk_in: boolean
}

export type MetricasMarketing = {
  leads: number
  agendamentos: number
  visitas: number
  fechoVisitas: number
  walkIns: number
  fechoWalkIns: number
  totalFechos: number
}

export const METRICAS_MARKETING: { chave: keyof MetricasMarketing; label: string }[] = [
  { chave: 'leads', label: 'Leads' },
  { chave: 'agendamentos', label: 'Agendamentos' },
  { chave: 'visitas', label: 'Visitas' },
  { chave: 'fechoVisitas', label: 'Fecho de visitas' },
  { chave: 'walkIns', label: 'Walk-ins' },
  { chave: 'fechoWalkIns', label: 'Fecho de walk-ins' },
  { chave: 'totalFechos', label: 'Total de fechos' },
]

// [inicioISO, fimExclusivoISO) — mesma convenção do resto da app
// (intervaloMes, etc.).
export function metricasNoIntervalo(
  leads: LeadMarketing[],
  inicioISO: string,
  fimExclusivoISO: string
): MetricasMarketing {
  const noIntervalo = leads.filter((l) => l.entrada >= inicioISO && l.entrada < fimExclusivoISO)
  const agendamentos = leads.filter(
    (l) => l.visita_marcada_em && l.visita_marcada_em >= inicioISO && l.visita_marcada_em < fimExclusivoISO
  ).length
  const visitasNoIntervalo = leads.filter(
    (l) => l.visita_data && l.visita_data >= inicioISO && l.visita_data < fimExclusivoISO
  )
  const fechoVisitas = visitasNoIntervalo.filter((l) => l.estado === 'Convertido').length
  const walkInsNoIntervalo = noIntervalo.filter((l) => l.walk_in)
  const fechoWalkIns = walkInsNoIntervalo.filter((l) => l.estado === 'Convertido').length

  return {
    leads: noIntervalo.length,
    agendamentos,
    visitas: visitasNoIntervalo.length,
    fechoVisitas,
    walkIns: walkInsNoIntervalo.length,
    fechoWalkIns,
    totalFechos: fechoVisitas + fechoWalkIns,
  }
}
