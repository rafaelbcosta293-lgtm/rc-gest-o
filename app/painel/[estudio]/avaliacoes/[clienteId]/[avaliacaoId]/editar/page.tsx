import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEquipaDoEstudio } from '@/lib/data/estudios'
import { atualizarAvaliacao } from '../../../actions'
import AvaliacaoForm from '../../../AvaliacaoForm'

export default async function EditarAvaliacaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string; clienteId: string; avaliacaoId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { estudio: slug, clienteId, avaliacaoId } = await params
  const { error } = await searchParams

  const supabase = await createClient()
  const [estudio, { data: cliente }, { data: avaliacao }] = await Promise.all([
    getEstudioPorSlug(supabase, slug),
    supabase.from('clientes').select('id, nome, estudio_id').eq('id', clienteId).maybeSingle(),
    supabase
      .from('avaliacoes')
      .select('*')
      .eq('id', avaliacaoId)
      .eq('cliente_id', clienteId)
      .maybeSingle(),
  ])

  if (!estudio || !cliente || !avaliacao || cliente.estudio_id !== estudio.id) {
    notFound()
  }

  const pts = await getEquipaDoEstudio(supabase, estudio.id)

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/painel/${slug}/avaliacoes/${clienteId}`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← {cliente.nome}
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Editar avaliação
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{cliente.nome}</p>

      <AvaliacaoForm
        estudioSlug={slug}
        clienteId={clienteId}
        pts={pts}
        avaliacao={avaliacao}
        action={atualizarAvaliacao}
        error={error}
      />
    </div>
  )
}
