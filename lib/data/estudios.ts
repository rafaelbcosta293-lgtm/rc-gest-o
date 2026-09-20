import type { SupabaseClient } from '@supabase/supabase-js'
import type { Estudio } from '@/lib/supabase/database.types'

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
