import Link from '@/components/LinkRapido'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEquipaDoEstudio } from '@/lib/data/estudios'
import { atualizarAvaliacao } from '../../../actions'
import AvaliacaoForm from '../../../AvaliacaoForm'
import { ArrowLeft } from 'lucide-react'

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

  const pts = await getEquipaDoEstudio(supabase, estudio.id, avaliacao.pt_id)

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href={`/painel/${slug}/avaliacoes/${clienteId}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {cliente.nome}
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
        Editar avaliação
      </h1>
      <p className="mt-1 text-sm text-muted">{cliente.nome}</p>

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
