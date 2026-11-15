import Link from '@/components/LinkRapido'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEquipaDoEstudio } from '@/lib/data/estudios'
import { criarCliente } from '../actions'
import ClienteForm from '../ClienteForm'
import { ArrowLeft } from 'lucide-react'

export default async function NovoClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { estudio: slug } = await params
  const { error } = await searchParams

  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) {
    notFound()
  }
  const pts = await getEquipaDoEstudio(supabase, estudio.id)

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href={`/painel/${slug}/treinos`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Treinos
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
        Novo cliente
      </h1>

      <ClienteForm
        estudioSlug={slug}
        estudioId={estudio.id}
        pts={pts}
        action={criarCliente}
        error={error}
      />
    </div>
  )
}
