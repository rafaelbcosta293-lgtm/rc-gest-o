import type { SupabaseClient } from '@supabase/supabase-js'
import type { AulaNaAgenda } from '@/app/painel/[estudio]/agenda/AgendaInterativa'
import { ocupadas } from './aulas'

// Cookie com a escolha "mostrar/esconder aulas de grupo na Agenda"
// ('0' = esconder; sem cookie = mostrar).
export const COOKIE_AULAS_AGENDA = 'rc_agenda_aulas'

// As aulas de grupo de um período, prontas para a grelha da Agenda
// (com a ocupação e o endereço da aula). Com instrutor filtrado, só as
// dele. Nunca parte a Agenda: em erro, devolve [].
export async function carregarAulasNaAgenda(
  supabase: SupabaseClient,
  estudioId: number,
  slug: string,
  inicio: string,
  fimExclusivo: string,
  instrutorId?: string
): Promise<AulaNaAgenda[]> {
  let q = supabase
    .from('aulas')
    .select('id, servico_id, horario_id, data, hora_inicio, duracao_min, instrutor_id, lotacao, estado')
    .eq('estudio_id', estudioId)
    .gte('data', inicio)
    .lt('data', fimExclusivo)
  if (instrutorId) q = q.eq('instrutor_id', instrutorId)
  const { data: aulas, error } = await q
  if (error || !aulas?.length) return []
  const ids = aulas.map((a) => a.id as string)
  const instrutores = [...new Set(aulas.map((a) => a.instrutor_id as string | null).filter((x): x is string => !!x))]
  const [{ data: inscricoes }, { data: servicos }, { data: perfis }] = await Promise.all([
    supabase.from('aulas_inscricoes').select('aula_id, estado').in('aula_id', ids),
    supabase.from('servicos').select('id, nome, chave'),
    instrutores.length ? supabase.from('perfis').select('id, nome').in('id', instrutores) : Promise.resolve({ data: [] }),
  ])
  const servico = new Map((servicos ?? []).map((s) => [s.id as number, s as { nome: string; chave: string }]))
  const nome = new Map((perfis ?? []).map((p) => [p.id as string, p.nome as string]))
  return aulas.map((a) => {
    const s = servico.get(a.servico_id as number)
    return {
      id: a.id as string,
      horarioId: (a.horario_id as string | null) ?? null,
      data: a.data as string,
      hora_inicio: a.hora_inicio as string,
      duracao_min: a.duracao_min as number,
      servicoNome: s?.nome ?? 'Aula',
      servicoChave: s?.chave ?? '',
      instrutorNome: a.instrutor_id ? (nome.get(a.instrutor_id as string) ?? null) : null,
      inscritos: ocupadas(((inscricoes ?? []) as { aula_id: string; estado: string }[]).filter((i) => i.aula_id === a.id) as { estado: 'Inscrito' }[]),
      lotacao: a.lotacao as number,
      cancelada: a.estado === 'Cancelada',
      href: `/painel/${slug}/aulas?data=${a.data}&aula=${a.id}`,
    }
  })
}
