// Painel comercial (secção 4.2): evolução semanal, leads por origem e
// ranking de comerciais — tudo calculado em JS puro sobre dados já
// carregados, mesma lógica de lib/data/funil.ts.

import { inicioDaSemana, somarDias } from './horarios'

export type PontoEvolucaoSemanal = {
  semana: string // segunda-feira dessa semana (YYYY-MM-DD)
  novas: number
  experimentais: number
  vendas: number
}

export function evolucaoSemanal(
  leads: { entrada: string }[],
  transicoes: { estado_novo: string; criado_em: string }[],
  semanas: number,
  hojeISO: string
): PontoEvolucaoSemanal[] {
  const inicioJanela = somarDias(inicioDaSemana(hojeISO), -(semanas - 1) * 7)
  const pontos: PontoEvolucaoSemanal[] = []
  for (let i = 0; i < semanas; i++) {
    pontos.push({ semana: somarDias(inicioJanela, i * 7), novas: 0, experimentais: 0, vendas: 0 })
  }
  const indicePorSemana = new Map(pontos.map((p, i) => [p.semana, i]))

  for (const l of leads) {
    const idx = indicePorSemana.get(inicioDaSemana(l.entrada))
    if (idx !== undefined) pontos[idx].novas += 1
  }
  for (const t of transicoes) {
    const idx = indicePorSemana.get(inicioDaSemana(t.criado_em.slice(0, 10)))
    if (idx === undefined) continue
    if (t.estado_novo === 'Experimental agendada') pontos[idx].experimentais += 1
    else if (t.estado_novo === 'Ganha') pontos[idx].vendas += 1
  }

  return pontos
}

export type OrigemResumo = { origem: string; total: number; ganhas: number; taxaConversao: number }

export function porOrigem(leads: { origem: string | null; estado: string }[]): OrigemResumo[] {
  const mapa = new Map<string, { total: number; ganhas: number }>()
  for (const l of leads) {
    const origem = l.origem?.trim() || 'Sem origem'
    const atual = mapa.get(origem) ?? { total: 0, ganhas: 0 }
    atual.total += 1
    if (l.estado === 'Ganha') atual.ganhas += 1
    mapa.set(origem, atual)
  }
  return Array.from(mapa.entries())
    .map(([origem, v]) => ({
      origem,
      total: v.total,
      ganhas: v.ganhas,
      taxaConversao: v.total > 0 ? v.ganhas / v.total : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

export type LeadParaRanking = {
  responsavel_id: string | null
  estado: string
  visita_marcada_em: string | null
  valor_potencial: number | null
  contactos: number
  alcancouExperimentalRealizada: boolean
}

export type RankingComercial = {
  responsavelId: string
  nome: string
  contactos: number
  agendamentos: number
  realizadas: number
  showRate: number | null
  fechos: number
  vendasValor: number
}

export function rankingComerciais(
  leads: LeadParaRanking[],
  pts: { id: string; nome: string }[]
): RankingComercial[] {
  const porResponsavel = new Map<string, LeadParaRanking[]>()
  for (const l of leads) {
    if (!l.responsavel_id) continue
    const lista = porResponsavel.get(l.responsavel_id) ?? []
    lista.push(l)
    porResponsavel.set(l.responsavel_id, lista)
  }

  const resultado: RankingComercial[] = []
  for (const pt of pts) {
    const lista = porResponsavel.get(pt.id)
    if (!lista || lista.length === 0) continue
    const contactos = lista.reduce((soma, l) => soma + l.contactos, 0)
    const agendamentos = lista.filter((l) => l.visita_marcada_em !== null).length
    const realizadas = lista.filter((l) => l.alcancouExperimentalRealizada).length
    const fechos = lista.filter((l) => l.estado === 'Ganha').length
    const vendasValor = lista
      .filter((l) => l.estado === 'Ganha')
      .reduce((soma, l) => soma + (l.valor_potencial ?? 0), 0)

    resultado.push({
      responsavelId: pt.id,
      nome: pt.nome,
      contactos,
      agendamentos,
      realizadas,
      showRate: agendamentos > 0 ? realizadas / agendamentos : null,
      fechos,
      vendasValor,
    })
  }

  return resultado.sort((a, b) => b.fechos - a.fechos)
}

// Mapa de calor dia-da-semana × hora, no fuso de Portugal — os
// timestamps vêm em UTC da base de dados, e usar a hora do servidor
// (Vercel corre em UTC) desalinharia todas as horas da realidade de
// quem está a ligar.
const DIAS_ABREV = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function diaDaSemanaEmLisboa(iso: string): number {
  const abrev = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Lisbon', weekday: 'short' }).format(
    new Date(iso)
  )
  return DIAS_ABREV.findIndex((d) => abrev.startsWith(d))
}

function horaEmLisboa(iso: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', hour: 'numeric', hour12: false }).format(
      new Date(iso)
    )
  ) % 24
}

export function mapaDeCalorSemanaHora(
  timestamps: string[],
  horaInicio: number,
  horaFim: number
): number[][] {
  const nHoras = horaFim - horaInicio
  const grelha: number[][] = Array.from({ length: 7 }, () => Array(nHoras).fill(0))
  for (const ts of timestamps) {
    const dia = diaDaSemanaEmLisboa(ts)
    const hora = horaEmLisboa(ts)
    if (hora >= horaInicio && hora < horaFim) {
      grelha[dia][hora - horaInicio] += 1
    }
  }
  return grelha
}
