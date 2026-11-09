import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Estudio, Perfil } from '@/lib/supabase/database.types'

export async function getEstudios(supabase: SupabaseClient): Promise<Estudio[]> {
  const { data } = await supabase
    .from('estudios')
    .select('*')
    .eq('ativo', true)
    .order('nome')
  return (data as Estudio[] | null) ?? []
}

// Usado pelas pastas "filtráveis" da Administração (submenu "só
// Fátima/só Leiria" no menu superior) — sem slug, ou com um slug que
// não bate certo com nenhum estúdio, mostra-os a todos como sempre.
export function filtrarPorEstudio<T extends { slug: string }>(estudios: T[], slug: string | undefined): T[] {
  if (!slug) return estudios
  const filtrado = estudios.filter((e) => e.slug === slug)
  return filtrado.length > 0 ? filtrado : estudios
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

export type ClienteOutroEstudio = { id: string; nome: string }

// Para a Agenda conseguir agendar um cliente de Fátima num evento de
// Leiria (ou vice-versa) sem misturar o resto dos dados dos dois
// estúdios: quem só tem acesso a um dos dois (ex.: conta "RC Leiria")
// não consegue, por RLS, ler a lista de clientes do outro — por isso
// usa-se aqui o cliente de administração (ignora RLS) só para esta
// lista de nomes a escolher, nunca para mais nada. Só faz sentido
// havendo exatamente dois estúdios ativos; com mais do que isso não há
// um "outro" óbvio, por isso a opção fica simplesmente escondida.
export async function obterOutroEstudioEClientes(
  supabase: SupabaseClient,
  estudioAtualId: number
): Promise<{ outroEstudio: Pick<Estudio, 'id' | 'nome'> | null; clientesOutroEstudio: ClienteOutroEstudio[] }> {
  const estudios = await getEstudios(supabase)
  if (estudios.length !== 2) {
    return { outroEstudio: null, clientesOutroEstudio: [] }
  }
  const outro = estudios.find((e) => e.id !== estudioAtualId)
  if (!outro) {
    return { outroEstudio: null, clientesOutroEstudio: [] }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('clientes')
    .select('id, nome')
    .eq('estudio_id', outro.id)
    .order('nome')
  if (error) {
    throw new Error(error.message)
  }

  return {
    outroEstudio: { id: outro.id, nome: outro.nome },
    clientesOutroEstudio: (data ?? []) as ClienteOutroEstudio[],
  }
}
