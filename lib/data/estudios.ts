import type { SupabaseClient } from '@supabase/supabase-js'
import type { Estudio, Perfil } from '@/lib/supabase/database.types'

export async function getEstudios(supabase: SupabaseClient): Promise<Estudio[]> {
  const { data } = await supabase
    .from('estudios')
    .select('*')
    .eq('ativo', true)
    .order('nome')
  return (data as Estudio[] | null) ?? []
}

export async function getEstudioPorSlug(
  supabase: SupabaseClient,
  slug: string
): Promise<Estudio | null> {
  const { data } = await supabase
    .from('estudios')
    .select('*')
    .eq('slug', slug)
    .eq('ativo', true)
    .maybeSingle()
  return data as Estudio | null
}

// Só quem o admin autorizou (em "Equipa") aparece para escolher como PT
// dentro deste estúdio — em vez de toda a gente registada na app.
export async function getEquipaDoEstudio(
  supabase: SupabaseClient,
  estudioId: number
): Promise<Pick<Perfil, 'id' | 'nome'>[]> {
  const { data, error } = await supabase
    .from('perfis_estudios')
    .select('perfil:perfis!perfil_id(id, nome)')
    .eq('estudio_id', estudioId)

  if (error) {
    throw new Error(error.message)
  }

  const pessoas = (data ?? [])
    .map((d) => d.perfil as unknown as Pick<Perfil, 'id' | 'nome'> | null)
    .filter((p): p is Pick<Perfil, 'id' | 'nome'> => p !== null)

  return pessoas.sort((a, b) => a.nome.localeCompare(b.nome))
}
