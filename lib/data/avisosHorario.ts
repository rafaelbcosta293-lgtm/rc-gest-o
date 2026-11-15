import type { SupabaseClient } from '@supabase/supabase-js'
import { idsContasPartilhadas } from './contasPartilhadas'
import { somarDias } from './horarios'
import { hojeEmLisboa } from './hoje'

// Aviso "o horário foi atualizado": sempre que a coordenação guarda a
// escala de uma semana, cada pessoa da equipa desse estúdio fica com um
// aviso na sua conta (tabela avisos_horario) até o fechar. Um aviso por
// pessoa, estúdio e semana — guardar outra vez a mesma semana volta a
// pôr o mesmo aviso "por ver", em vez de acumular vários.

export type AvisoHorario = { estudioId: number; semana: string; slug: string; nomeEstudio: string }

// Quem recebe: a equipa ativa do estúdio, sem as contas partilhadas
// (Coordenação, RC Fátima, RC Leiria — não são pessoas) e sem quem
// acabou de guardar (já sabe). Nunca faz falhar a gravação da escala:
// se o aviso não puder ser criado, a escala fica guardada na mesma.
export async function avisarEquipaDeHorarioNovo(
  supabase: SupabaseClient,
  { estudioId, semana, autorId }: { estudioId: number; semana: string; autorId: string | null }
): Promise<void> {
  // Uma semana que já acabou não interessa a ninguém.
  if (somarDias(semana, 7) <= hojeEmLisboa()) return
  try {
    const [{ data: ligacoes, error }, partilhadas] = await Promise.all([
      supabase.from('perfis_estudios').select('perfil:perfis!perfil_id(id, ativo)').eq('estudio_id', estudioId),
      idsContasPartilhadas(),
    ])
    if (error) throw new Error(error.message)
    const destinatarios = (ligacoes ?? [])
      .map((l) => l.perfil as unknown as { id: string; ativo: boolean } | null)
      .filter((p): p is { id: string; ativo: boolean } => !!p && p.ativo && !partilhadas.has(p.id) && p.id !== autorId)
    if (destinatarios.length === 0) return
    const agora = new Date().toISOString()
    const { error: erroAviso } = await supabase.from('avisos_horario').upsert(
      destinatarios.map((p) => ({
        perfil_id: p.id,
        estudio_id: estudioId,
        semana,
        atualizado_em: agora,
        visto_em: null,
      })),
      { onConflict: 'perfil_id,estudio_id,semana' }
    )
    if (erroAviso) throw new Error(erroAviso.message)
  } catch (e) {
    console.error('Não foi possível avisar a equipa do horário novo:', (e as Error).message)
  }
}

// Avisos por ver desta pessoa, da semana mais próxima para a mais distante.
export async function listarAvisosHorario(supabase: SupabaseClient, userId: string): Promise<AvisoHorario[]> {
  const { data, error } = await supabase
    .from('avisos_horario')
    .select('estudio_id, semana, estudio:estudios!estudio_id(slug, nome)')
    .eq('perfil_id', userId)
    .is('visto_em', null)
    .order('semana')
  // Um aviso é um extra: se a leitura falhar, a página abre sem faixa.
  if (error) return []
  return (data ?? []).flatMap((a) => {
    const estudio = a.estudio as unknown as { slug: string; nome: string } | null
    return estudio
      ? [{ estudioId: a.estudio_id as number, semana: a.semana as string, slug: estudio.slug, nomeEstudio: estudio.nome }]
      : []
  })
}
