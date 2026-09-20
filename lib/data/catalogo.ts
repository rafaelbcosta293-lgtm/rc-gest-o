import type { SupabaseClient } from '@supabase/supabase-js'
import type { Categoria } from '@/lib/supabase/database.types'

export type ItemCatalogo = { id: string; nome: string }

export type CatalogoExercicios = {
  categorias: Categoria[]
  porCategoria: Record<string, ItemCatalogo[]>
  todos: ItemCatalogo[]
}

export async function getCatalogoExercicios(
  supabase: SupabaseClient
): Promise<CatalogoExercicios> {
  const [{ data: categorias }, { data: exercicios }, { data: links }] = await Promise.all([
    supabase
      .from('categorias')
      .select('id, parte, nome, nota, ordem, ativo')
      .eq('ativo', true)
      .order('ordem'),
    supabase.from('exercicios').select('id, nome').eq('ativo', true).order('nome'),
    supabase.from('exercicios_categorias').select('exercicio_id, categoria_id'),
  ])

  const exerciciosPorId = new Map<string, ItemCatalogo>(
    (exercicios ?? []).map((e) => [e.id, { id: e.id, nome: e.nome }])
  )

  const porCategoria: Record<string, ItemCatalogo[]> = {}
  for (const link of links ?? []) {
    const ex = exerciciosPorId.get(link.exercicio_id)
    if (!ex) continue
    if (!porCategoria[link.categoria_id]) porCategoria[link.categoria_id] = []
    porCategoria[link.categoria_id].push(ex)
  }
  for (const lista of Object.values(porCategoria)) {
    lista.sort((a, b) => a.nome.localeCompare(b.nome))
  }

  return {
    categorias: (categorias as Categoria[] | null) ?? [],
    porCategoria,
    todos: [...exerciciosPorId.values()].sort((a, b) => a.nome.localeCompare(b.nome)),
  }
}
