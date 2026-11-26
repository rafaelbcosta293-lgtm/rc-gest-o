// Leituras da base de dados para o controlo dos instrutores (as contas
// puras estão em controloInstrutores.ts).
import type { SupabaseClient } from '@supabase/supabase-js'
import { somarDias } from '@/lib/data/horarios'
import { diaSemAno } from '@/lib/data/presencas'
import { todasAsLinhas } from '@/lib/supabase/todasAsLinhas'
import { INICIO_CONTROLO, type EventoRelatorio, type PlanoRelatorio } from './controloInstrutores'

// Um treino do cliente marcado na Agenda, para se escolher a que treino
// pertence um plano.
export type TreinoMarcado = {
  id: string
  data: string
  hora_inicio: string
  instrutor: string | null
  // Plano já ligado a este treino (null = ainda não tem).
  planoId: string | null
}

// Treinos (não desmarcados) do cliente à volta de hoje: as duas últimas
// semanas, para ainda se poder inserir o plano de um treino já dado, e
// as três seguintes, para planear com antecedência.
export async function treinosMarcadosDoCliente(supabase: SupabaseClient, clienteId: string, hoje: string): Promise<TreinoMarcado[]> {
  const { data, error } = await supabase
    .from('agenda_eventos')
    .select('id, data, hora_inicio, pt:perfis!pt_id(nome)')
    .eq('cliente_id', clienteId)
    .eq('tipo', 'Treino')
    .neq('estado', 'Cancelado')
    .gte('data', somarDias(hoje, -14))
    .lte('data', somarDias(hoje, 21))
    .order('data')
    .order('hora_inicio')
  if (error) throw new Error(error.message)
  const eventos = (data ?? []) as unknown as { id: string; data: string; hora_inicio: string; pt: { nome: string } | null }[]
  if (eventos.length === 0) return []

  const { data: planos, error: erroPlanos } = await supabase
    .from('sessoes')
    .select('id, agenda_evento_id')
    .in('agenda_evento_id', eventos.map((e) => e.id))
  if (erroPlanos) throw new Error(erroPlanos.message)
  const planoDoEvento = new Map((planos ?? []).map((p) => [p.agenda_evento_id as string, p.id as string]))

  return eventos.map((e) => ({
    id: e.id,
    data: e.data,
    hora_inicio: e.hora_inicio,
    instrutor: e.pt?.nome ?? null,
    planoId: planoDoEvento.get(e.id) ?? null,
  }))
}

// "qui, 27 nov · 08:00 · com Rita" (ou "· sem instrutor").
export function rotuloTreinoMarcado(t: Pick<TreinoMarcado, 'data' | 'hora_inicio' | 'instrutor'>): string {
  return `${diaSemAno(t.data)} · ${t.hora_inicio.slice(0, 5)} · ${t.instrutor ? `com ${t.instrutor}` : 'sem instrutor'}`
}

// Tudo o que o relatório "Avaliação de instrutores" precisa, num
// período: os treinos já dados (não desmarcados, até hoje) e os planos
// de treino. Nunca antes do início do controlo. estudioId null = todos.
export async function carregarAvaliacaoInstrutores(
  supabase: SupabaseClient,
  estudioId: number | null,
  inicio: string,
  fimExclusivo: string,
  hoje: string
): Promise<{ eventos: EventoRelatorio[]; planos: PlanoRelatorio[]; instrutores: { id: string; nome: string }[] }> {
  const desde = inicio > INICIO_CONTROLO ? inicio : INICIO_CONTROLO
  // Só o que já aconteceu (até hoje, inclusive).
  const ate = somarDias(hoje, 1) < fimExclusivo ? somarDias(hoje, 1) : fimExclusivo
  if (desde >= ate) return { eventos: [], planos: [], instrutores: [] }

  type LinhaEvento = {
    id: string
    grupo_id: string | null
    estudio_id: number
    cliente_id: string | null
    pt_id: string | null
    data: string
    hora_inicio: string
    cliente: { nome: string } | null
  }
  type LinhaPlano = {
    id: string
    agenda_evento_id: string | null
    pt_id: string | null
    data: string
    criado_em: string
    correu: string | null
    sessao_exercicios: { count: number }[]
  }

  const [respEventos, respPlanos] = await Promise.all([
    todasAsLinhas<LinhaEvento>((de, ate_) => {
      let q = supabase
        .from('agenda_eventos')
        .select('id, grupo_id, estudio_id, cliente_id, pt_id, data, hora_inicio, cliente:clientes(nome)')
        .eq('tipo', 'Treino')
        .neq('estado', 'Cancelado')
        .not('cliente_id', 'is', null)
        .gte('data', desde)
        .lt('data', ate)
        .order('data')
        .order('id')
        .range(de, ate_)
      if (estudioId != null) q = q.eq('estudio_id', estudioId)
      return q as unknown as PromiseLike<{ data: LinhaEvento[] | null; error: { message: string } | null }>
    }),
    todasAsLinhas<LinhaPlano>((de, ate_) => {
      let q = supabase
        .from('sessoes')
        .select('id, agenda_evento_id, pt_id, data, criado_em, correu, sessao_exercicios(count)')
        .gte('data', desde)
        .lt('data', ate)
        .order('data')
        .order('id')
        .range(de, ate_)
      if (estudioId != null) q = q.eq('estudio_id', estudioId)
      return q as unknown as PromiseLike<{ data: LinhaPlano[] | null; error: { message: string } | null }>
    }),
  ])
  if (respEventos.error) throw new Error(respEventos.error.message)
  if (respPlanos.error) throw new Error(respPlanos.error.message)
  const eventos = respEventos.data
  const planos = respPlanos.data

  // Nomes de quem aparece (instrutores que deram treinos ou fizeram
  // planos), mesmo que já não estejam na equipa.
  const ids = [...new Set([...eventos.map((e) => e.pt_id), ...planos.map((p) => p.pt_id)].filter((i): i is string => !!i))]
  const { data: perfis, error } = ids.length
    ? await supabase.from('perfis').select('id, nome').in('id', ids)
    : { data: [], error: null }
  if (error) throw new Error(error.message)

  return {
    eventos: eventos.map((e) => ({
      id: e.id,
      grupo_id: e.grupo_id,
      estudio_id: e.estudio_id,
      cliente_id: e.cliente_id,
      cliente_nome: e.cliente?.nome ?? null,
      pt_id: e.pt_id,
      data: e.data,
      hora_inicio: e.hora_inicio,
    })),
    planos: planos.map((p) => ({
      id: p.id,
      agenda_evento_id: p.agenda_evento_id,
      pt_id: p.pt_id,
      data: p.data,
      criado_em: p.criado_em,
      exercicios: p.sessao_exercicios?.[0]?.count ?? 0,
      registado: !!p.correu,
    })),
    instrutores: (perfis ?? []) as { id: string; nome: string }[],
  }
}
