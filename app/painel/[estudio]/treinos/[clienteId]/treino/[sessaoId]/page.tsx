import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEquipaDoEstudio } from '@/lib/data/estudios'
import { getCatalogoExercicios } from '@/lib/data/catalogo'
import { atualizarSessao } from '../actions'
import TreinoForm, { type LinhaExercicio } from '../../../TreinoForm'
import type { BlocoTipo } from '@/lib/data/constantes'

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
  const [estudio, { data: cliente }, { data: sessao }, catalogo, { data: exerciciosSessao }] =
    await Promise.all([
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
    ])

  if (!estudio || !cliente || !sessao || cliente.estudio_id !== estudio.id) {
    notFound()
  }

  const pts = await getEquipaDoEstudio(supabase, estudio.id)

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
