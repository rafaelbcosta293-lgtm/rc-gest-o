import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import AgendaConteudo from './AgendaConteudo'

export default async function AgendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ vista?: string; data?: string; pt?: string; error?: string }>
}) {
  const { estudio: slug } = await params
  const sp = await searchParams

  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <AgendaConteudo
        estudio={estudio}
        searchParams={sp}
        basePath={`/painel/${slug}/agenda`}
        mostrarVoltar
      />
    </div>
  )
}
