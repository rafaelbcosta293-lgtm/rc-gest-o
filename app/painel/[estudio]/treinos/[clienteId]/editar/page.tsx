import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { atualizarCliente } from '../../actions'
import ClienteForm from '../../ClienteForm'

export default async function EditarClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string; clienteId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { estudio: slug, clienteId } = await params
  const { error } = await searchParams

  const supabase = await createClient()
  const [estudio, { data: cliente }, { data: pts }] = await Promise.all([
    getEstudioPorSlug(supabase, slug),
    supabase.from('clientes').select('*').eq('id', clienteId).maybeSingle(),
    supabase.from('perfis').select('id, nome').order('nome'),
  ])

  if (!estudio || !cliente || cliente.estudio_id !== estudio.id) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/painel/${slug}/treinos/${clienteId}`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← {cliente.nome}
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Editar ficha
      </h1>

      <ClienteForm
        estudioSlug={slug}
        estudioId={estudio.id}
        cliente={cliente}
        pts={pts ?? []}
        action={atualizarCliente}
        error={error}
      />
    </div>
  )
}
