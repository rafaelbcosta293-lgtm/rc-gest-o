// Painel operacional (secção 4.4). Tudo calculado em JS puro sobre
// dados já carregados, mesma abordagem dos outros painéis desta fase.

import { treinosPrevistos } from './presencas'

export type RegistoPt = { pt_id: string; horas: number; treinos_40: number; treinos_60: number }

export type OcupacaoPt = {
  ptId: string
  nome: string
  horasRealizadas: number
  horasDisponiveis: number
  ocupacao: number | null
}

// "Disponíveis" vem da escala (cada linha é um slot de 30 min); sem
// nenhum slot marcado não há como calcular ocupação (fica null, não
// 0% — 0% sugeriria que havia disponibilidade e não foi usada).
export function ocupacaoPorPt(
  registos: RegistoPt[],
  escalas: { pt_id: string }[],
  pts: { id: string; nome: string }[]
): OcupacaoPt[] {
  const horasPorPt = new Map<string, number>()
  for (const r of registos) {
    horasPorPt.set(r.pt_id, (horasPorPt.get(r.pt_id) ?? 0) + r.horas)
  }
  const slotsPorPt = new Map<string, number>()
  for (const e of escalas) {
    slotsPorPt.set(e.pt_id, (slotsPorPt.get(e.pt_id) ?? 0) + 1)
  }

  return pts.map((pt) => {
    const horasDisponiveis = (slotsPorPt.get(pt.id) ?? 0) * 0.5
    const horasRealizadas = horasPorPt.get(pt.id) ?? 0
    return {
      ptId: pt.id,
      nome: pt.nome,
      horasRealizadas,
      horasDisponiveis,
      ocupacao: horasDisponiveis > 0 ? Math.min(1, horasRealizadas / horasDisponiveis) : null,
    }
  })
}

export type ClienteDoPt = {
  id: string
  pt_principal_id: string | null
  estado: string
  frequencia_semanal: number | null
}

export type RetencaoAssiduidadePt = {
  ptId: string
  nome: string
  totalClientes: number
  retencao: number | null
  assiduidadeMedia: number | null
}

export function retencaoEAssiduidadePorPt(
  clientes: ClienteDoPt[],
  presencasPorCliente: Map<string, { data: string; estado: string }[]>,
  ano: number,
  mes: number,
  pts: { id: string; nome: string }[]
): RetencaoAssiduidadePt[] {
  const porPt = new Map<string, ClienteDoPt[]>()
  for (const c of clientes) {
    if (!c.pt_principal_id) continue
    const lista = porPt.get(c.pt_principal_id) ?? []
    lista.push(c)
    porPt.set(c.pt_principal_id, lista)
  }

  return pts
    .map((pt) => {
      const lista = porPt.get(pt.id) ?? []
      if (lista.length === 0) {
        return { ptId: pt.id, nome: pt.nome, totalClientes: 0, retencao: null, assiduidadeMedia: null }
      }

      const ativos = lista.filter((c) => c.estado === 'Ativo').length
      const retencao = ativos / lista.length

      const taxas: number[] = []
      for (const c of lista.filter((c) => c.estado === 'Ativo')) {
        const alvo = treinosPrevistos(c.frequencia_semanal, ano, mes)?.arredondado ?? null
        if (!alvo) continue
        const realizados = (presencasPorCliente.get(c.id) ?? []).filter((p) => p.estado === 'Presente').length
        taxas.push(Math.min(1, realizados / alvo))
      }
      const assiduidadeMedia = taxas.length > 0 ? taxas.reduce((a, b) => a + b, 0) / taxas.length : null

      return { ptId: pt.id, nome: pt.nome, totalClientes: lista.length, retencao, assiduidadeMedia }
    })
    .filter((r) => r.totalClientes > 0)
}

export type ResumoReavaliacoes = { feitas: number; aVencer: number; atrasadas: number }

export function resumoReavaliacoes(
  feitasNoMes: number,
  proximasReavaliacoes: (string | null)[],
  hojeISO: string,
  diasAVencer = 14
): ResumoReavaliacoes {
  let aVencer = 0
  let atrasadas = 0
  const limite = new Date(`${hojeISO}T00:00:00`)
  limite.setDate(limite.getDate() + diasAVencer)
  const limiteISO = limite.toISOString().slice(0, 10)

  for (const data of proximasReavaliacoes) {
    if (!data) continue
    if (data < hojeISO) atrasadas++
    else if (data <= limiteISO) aVencer++
  }

  return { feitas: feitasNoMes, aVencer, atrasadas }
}

export type CoberturaChecklist = { submetidos: number; esperados: number }

export function coberturaChecklist(
  registos: { tipo: string; data: string }[],
  tipo: string,
  diasDoMesAteHoje: string[]
): CoberturaChecklist {
  const diasComRegisto = new Set(registos.filter((r) => r.tipo === tipo).map((r) => r.data))
  const submetidos = diasDoMesAteHoje.filter((d) => diasComRegisto.has(d)).length
  return { submetidos, esperados: diasDoMesAteHoje.length }
}
