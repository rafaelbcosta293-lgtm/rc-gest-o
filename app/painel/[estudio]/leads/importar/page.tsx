import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import ImportarLeadsForm from './ImportarLeadsForm'

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
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/painel/${slug}/leads`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← Leads
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Importar leads (CSV)
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {estudio.nome} · entram todos como etapa &quot;Nova&quot;
      </p>

      <ImportarLeadsForm estudioSlug={slug} estudioId={estudio.id} />
    </div>
  )
}
