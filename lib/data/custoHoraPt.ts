import type { SupabaseClient } from '@supabase/supabase-js'
import { todasAsLinhas } from '@/lib/supabase/todasAsLinhas'

// Custo por hora de PT, calculado (já não é um valor escrito à mão):
// honorários dos PTs (e prémios) de um mês ÷ horas de treino dadas nesse
// mês (treinos na Agenda + aulas de grupo). É a mesma parte das despesas
// de Recursos Humanos que o Simulador trata como custo variável (horas ×
// custo/hora) — o salário do sócio e os encargos ficam nos custos fixos,
// para nada contar duas vezes.

export const ehHonorarioPt = (subcategoria: string | null) => /^(Honorários PT|Prémios)/.test(subcategoria ?? '')

// Um mês só serve de referência com a Agenda já em uso nesse mês.
export const HORAS_MIN_MES = 40

export type CustoHoraPt = {
  valor: number | null
  mes: string // AAAA-MM usado
  honorarios: number
  horas: number
  // true = mês a decorrer (honorários do mês ÷ horas marcadas no mês todo)
  mesCorrente: boolean
}

// Escolhe o mês de referência: o último mês completo com horas suficientes
// na Agenda; senão, o mês a decorrer (com todas as horas já marcadas nele).
export function escolherMes(horasPorMes: Map<string, number>, mesAtual: string, mesAnterior: string): { mes: string; mesCorrente: boolean } {
  if ((horasPorMes.get(mesAnterior) ?? 0) >= HORAS_MIN_MES) return { mes: mesAnterior, mesCorrente: false }
  return { mes: mesAtual, mesCorrente: true }
}

export function calcularCustoHora(honorarios: number, horas: number): number | null {
  if (horas <= 0 || honorarios <= 0) return null
  return Math.round((honorarios / horas) * 100) / 100
}

const mesAnteriorDe = (mes: string) => {
  const [a, m] = mes.split('-').map(Number)
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`
}
const fimDoMes = (mes: string) => {
  const [a, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10)
}

export async function carregarCustoHoraPt(supabase: SupabaseClient, estudioIds: number[], hoje: string): Promise<CustoHoraPt> {
  const mesAtual = hoje.slice(0, 7)
  const mesAnterior = mesAnteriorDe(mesAtual)
  const de = `${mesAnterior}-01`
  const ate = fimDoMes(mesAtual)

  const [treinos, { data: aulas }, { data: despesas }] = await Promise.all([
    todasAsLinhas<{ id: string; grupo_id: string | null; data: string; duracao_min: number }>((d, a) =>
      supabase
        .from('agenda_eventos')
        .select('id, grupo_id, data, duracao_min')
        .in('estudio_id', estudioIds)
        .eq('tipo', 'Treino')
        .neq('estado', 'Cancelado')
        .gte('data', de)
        .lte('data', ate)
        .order('id')
        .range(d, a)
    ),
    supabase.from('aulas').select('data, duracao_min').in('estudio_id', estudioIds).eq('estado', 'Aberta').gte('data', de).lte('data', ate),
    supabase
      .from('despesas')
      .select('data, subcategoria, valor')
      .in('estudio_id', estudioIds)
      .eq('categoria', 'Recursos Humanos')
      .is('anulado_em', null)
      .gte('data', de)
      .lte('data', ate),
  ])

  // Um treino em simultâneo (várias linhas com o mesmo grupo) conta uma vez.
  const horasPorMes = new Map<string, number>()
  const vistos = new Set<string>()
  for (const t of treinos.data) {
    const chave = t.grupo_id ?? t.id
    if (vistos.has(chave)) continue
    vistos.add(chave)
    horasPorMes.set(t.data.slice(0, 7), (horasPorMes.get(t.data.slice(0, 7)) ?? 0) + t.duracao_min / 60)
  }
  for (const a of (aulas ?? []) as { data: string; duracao_min: number }[]) {
    horasPorMes.set(a.data.slice(0, 7), (horasPorMes.get(a.data.slice(0, 7)) ?? 0) + a.duracao_min / 60)
  }

  const { mes, mesCorrente } = escolherMes(horasPorMes, mesAtual, mesAnterior)
  const honorarios = ((despesas ?? []) as { data: string; subcategoria: string | null; valor: number | string }[])
    .filter((d) => d.data.slice(0, 7) === mes && ehHonorarioPt(d.subcategoria))
    .reduce((s, d) => s + Number(d.valor), 0)
  const horas = Math.round((horasPorMes.get(mes) ?? 0) * 10) / 10
  return { valor: calcularCustoHora(honorarios, horas), mes, honorarios: Math.round(honorarios * 100) / 100, horas, mesCorrente }
}
