import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEquipaDoEstudio } from '@/lib/data/estudios'
import { criarLead } from '../actions'
import LeadForm from '../LeadForm'

export default async function NovoLeadPage({
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
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/painel/${slug}/leads`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← Leads
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">Novo lead</h1>

      <LeadForm
        estudioSlug={slug}
        estudioId={estudio.id}
        pts={pts}
        action={criarLead}
        error={error}
      />
    </div>
  )
}
