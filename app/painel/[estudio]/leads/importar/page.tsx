import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import ImportarLeadsForm from './ImportarLeadsForm'
import { ArrowLeft } from 'lucide-react'

export default async function ImportarLeadsPage({
  params,
}: {
  params: Promise<{ estudio: string }>
}) {
  const { estudio: slug } = await params

  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href={`/painel/${slug}/leads`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Leads
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
        Importar leads (CSV)
      </h1>
      <p className="mt-1 text-sm text-muted">
        {estudio.nome} · entram todos como etapa &quot;Nova&quot;
      </p>

      <ImportarLeadsForm estudioSlug={slug} estudioId={estudio.id} />
    </div>
  )
}
