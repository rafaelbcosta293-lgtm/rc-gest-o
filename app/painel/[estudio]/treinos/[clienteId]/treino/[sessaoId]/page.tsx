import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEquipaDoEstudio } from '@/lib/data/estudios'
import { getCatalogoExercicios } from '@/lib/data/catalogo'
import type { ItemCatalogo } from '@/lib/data/catalogo'
import { atualizarSessao } from '../actions'
import TreinoForm, { type LinhaExercicio } from '../../../TreinoForm'
import type { BlocoTipo } from '@/lib/data/constantes'

type SessaoHistorico = {
  data: string
  sessao_exercicios: {
    exercicio_id: string | null
    series: string | null
    reps: string | null
    carga: string | null
    descanso: string | null
  }[]
}

export default async function EditarTreinoPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string; clienteId: string; sessaoId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { estudio: slug, clienteId, sessaoId } = await params
  const { error } = await searchParams

  const supabase = await createClient()
  const [
    estudio,
    { data: cliente },
    { data: sessao },
    catalogo,
    { data: exerciciosSessao },
    { data: historicoData },
  ] = await Promise.all([
    getEstudioPorSlug(supabase, slug),
    supabase.from('clientes').select('id, nome, estudio_id').eq('id', clienteId).maybeSingle(),
    supabase
      .from('sessoes')
      .select('*')
      .eq('id', sessaoId)
      .eq('cliente_id', clienteId)
      .maybeSingle(),
    getCatalogoExercicios(supabase),
    supabase.from('sessao_exercicios').select('*').eq('sessao_id', sessaoId).order('ordem'),
    // Últimos treinos deste cliente (à parte), para sugerir os
    // exercícios mais usados e pré-preencher séries/reps/carga/descanso
    // com o que ficou registado da última vez que fez o mesmo exercício.
    supabase
      .from('sessoes')
      .select('data, sessao_exercicios(exercicio_id, series, reps, carga, descanso)')
      .eq('cliente_id', clienteId)
      .neq('id', sessaoId)
      .order('data', { ascending: false })
      .limit(20),
  ])

  if (!estudio || !cliente || !sessao || cliente.estudio_id !== estudio.id) {
    notFound()
  }

  const pts = await getEquipaDoEstudio(supabase, estudio.id)

  const historico = (historicoData ?? []) as unknown as SessaoHistorico[]
  const ultimosValores: Record<
    string,
    { series: string; reps: string; carga: string; descanso: string }
  > = {}
  const contagem = new Map<string, number>()
  for (const sessaoAnterior of historico) {
    for (const ex of sessaoAnterior.sessao_exercicios ?? []) {
      if (!ex.exercicio_id) continue
      contagem.set(ex.exercicio_id, (contagem.get(ex.exercicio_id) ?? 0) + 1)
      if (!ultimosValores[ex.exercicio_id]) {
        ultimosValores[ex.exercicio_id] = {
          series: ex.series ?? '',
          reps: ex.reps ?? '',
          carga: ex.carga ?? '',
          descanso: ex.descanso ?? '',
        }
      }
    }
  }
  const maisUsados = [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id]) => catalogo.todos.find((e) => e.id === id))
    .filter((e): e is ItemCatalogo => !!e)

  const exercicios: LinhaExercicio[] = (exerciciosSessao ?? []).map((e) => ({
    key: e.id,
    id: e.id,
    bloco: e.bloco as BlocoTipo,
    exercicio_id: e.exercicio_id,
    exercicio_nome: e.exercicio_nome,
    series: e.series ?? '',
    reps: e.reps ?? '',
    carga: e.carga ?? '',
    descanso: e.descanso ?? '',
    nota: e.nota ?? '',
  }))

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href={`/painel/${slug}/treinos/${clienteId}`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← {cliente.nome}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Editar treino
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{cliente.nome}</p>

      <TreinoForm
        estudioSlug={slug}
        estudioId={estudio.id}
        clienteId={clienteId}
        pts={pts}
        catalogo={catalogo}
        ultimosValores={ultimosValores}
        maisUsados={maisUsados}
        inicial={{
          id: sessao.id,
          data: sessao.data,
          pt_id: sessao.pt_id,
          foco: sessao.foco,
          correu: sessao.correu,
          tipo_nota: sessao.tipo_nota,
          nota_proxima: sessao.nota_proxima,
          exercicios,
        }}
        action={atualizarSessao}
        error={error}
      />
    </div>
  )
}
