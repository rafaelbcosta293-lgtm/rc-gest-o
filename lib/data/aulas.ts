import type { SupabaseClient } from '@supabase/supabase-js'
import { somarDias } from './horarios'

// Aulas de grupo (Treino Acompanhado, Pilates): o horário semanal gera
// as aulas concretas das semanas seguintes; cada aula tem lotação e as
// pessoas inscrevem-se aula a aula (semana a semana).

export type HorarioAula = {
  id: string
  estudio_id: number
  servico_id: number
  dia_semana: number // 1 = segunda … 7 = domingo
  hora_inicio: string
  duracao_min: number
  instrutor_id: string | null
  lotacao: number
  ativo: boolean
  desde: string
  ate: string | null
}

export type EstadoAula = 'Aberta' | 'Cancelada'

// A que aulas se aplica uma mudança (ou um apagar), como na Agenda dos
// treinos: só esta, esta e as seguintes, ou todas as do horário semanal.
export type EscopoAula = 'um' | 'seguintes' | 'serie'

// Duração habitual de cada serviço de grupo (quando não há horário de
// onde a tirar).
export const DURACAO_AULA_OMISSAO: Record<string, number> = { acompanhado: 60, pilates: 50 }

export type EstadoInscricao = 'Inscrito' | 'Presente' | 'Faltou' | 'Cancelada'

export type Aula = {
  id: string
  estudio_id: number
  servico_id: number
  horario_id: string | null
  data: string
  hora_inicio: string
  duracao_min: number
  instrutor_id: string | null
  lotacao: number
  estado: EstadoAula
  motivo_cancelamento: string | null
  nota: string | null
}

export type InscricaoAula = {
  id: string
  aula_id: string
  cliente_id: string
  estado: EstadoInscricao
  origem: 'equipa' | 'cliente'
}

// Quantas semanas à frente ficam abertas as aulas (para as pessoas se
// poderem inscrever com antecedência).
export const SEMANAS_ABERTAS = 4

export const DIAS_SEMANA_LONGOS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

// 1 = segunda … 7 = domingo (em UTC, para não depender do fuso).
export function diaSemanaISO(dataISO: string): number {
  const d = new Date(`${dataISO}T00:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}

// As datas em que um horário dá aula entre duas datas (inclusive),
// respeitando o "desde"/"até" do próprio horário.
export function datasDoHorario(h: Pick<HorarioAula, 'dia_semana' | 'desde' | 'ate'>, de: string, ate: string): string[] {
  const inicio = h.desde > de ? h.desde : de
  const fim = h.ate && h.ate < ate ? h.ate : ate
  if (inicio > fim) return []
  let d = inicio
  const avanco = (h.dia_semana - diaSemanaISO(d) + 7) % 7
  d = somarDias(d, avanco)
  const datas: string[] = []
  while (d <= fim) {
    datas.push(d)
    d = somarDias(d, 7)
  }
  return datas
}

// Lugares ocupados (tudo menos as inscrições canceladas).
export function ocupadas(inscricoes: Pick<InscricaoAula, 'estado'>[]): number {
  return inscricoes.filter((i) => i.estado !== 'Cancelada').length
}

// As aulas que faltam criar: uma por horário ativo e data, sem repetir as
// que já existem e saltando os dias em que o estúdio está fechado.
export function aulasEmFalta(
  horarios: HorarioAula[],
  existentes: { horario_id: string | null; data: string }[],
  diasFechados: Set<string>,
  de: string,
  ate: string
): Omit<Aula, 'id' | 'estado' | 'motivo_cancelamento' | 'nota'>[] {
  const ja = new Set(existentes.map((a) => `${a.horario_id}|${a.data}`))
  const novas: Omit<Aula, 'id' | 'estado' | 'motivo_cancelamento' | 'nota'>[] = []
  for (const h of horarios) {
    if (!h.ativo) continue
    for (const data of datasDoHorario(h, de, ate)) {
      if (ja.has(`${h.id}|${data}`) || diasFechados.has(data)) continue
      novas.push({
        estudio_id: h.estudio_id,
        servico_id: h.servico_id,
        horario_id: h.id,
        data,
        hora_inicio: h.hora_inicio,
        duracao_min: h.duracao_min,
        instrutor_id: h.instrutor_id,
        lotacao: h.lotacao,
      })
    }
  }
  return novas
}

// Cria as aulas das próximas semanas a partir do horário semanal.
// Idempotente (nunca duplica). Devolve quantas criou.
export async function gerarAulas(supabase: SupabaseClient, estudioId: number, hoje: string): Promise<number> {
  const ate = somarDias(hoje, SEMANAS_ABERTAS * 7 - 1)
  const [{ data: horarios }, { data: existentes }, { data: fechados }] = await Promise.all([
    supabase.from('aulas_horario').select('*').eq('estudio_id', estudioId).eq('ativo', true),
    supabase.from('aulas').select('horario_id, data').eq('estudio_id', estudioId).gte('data', hoje).lte('data', ate),
    supabase.from('dias_fechados').select('data').eq('estudio_id', estudioId).gte('data', hoje).lte('data', ate),
  ])
  // Datas que um horário deve saltar: a aula desse dia foi apagada ou
  // passou para outro dia ("só esta") — não se volta a abrir.
  const idsHorarios = (horarios ?? []).map((h) => h.id as string)
  const { data: saltos } = idsHorarios.length
    ? await supabase.from('aulas_horario_saltos').select('horario_id, data').in('horario_id', idsHorarios).gte('data', hoje).lte('data', ate)
    : { data: [] }
  const novas = aulasEmFalta(
    (horarios ?? []) as HorarioAula[],
    [...(existentes ?? []), ...(saltos ?? [])] as { horario_id: string | null; data: string }[],
    new Set((fechados ?? []).map((f) => f.data as string)),
    hoje,
    ate
  )
  if (novas.length === 0) return 0
  const { error } = await supabase.from('aulas').upsert(novas, { onConflict: 'horario_id,data', ignoreDuplicates: true })
  return error ? 0 : novas.length
}
