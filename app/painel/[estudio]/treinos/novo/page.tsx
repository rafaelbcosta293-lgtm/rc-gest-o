import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ESTUDIOS } from '@/lib/data/constantes'
import { criarCliente } from '../actions'
import ClienteForm from '../ClienteForm'

export default async function NovoClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { estudio } = await params
  if (!ESTUDIOS.some((e) => e.id === estudio)) {
    notFound()
  }
  const { error } = await searchParams

  const supabase = await createClient()
  const { data: pts } = await supabase.from('profiles').select('id, nome').order('nome')

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/painel/${estudio}/treinos`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← Treinos
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Novo cliente
      </h1>

      <ClienteForm estudio={estudio} pts={pts ?? []} action={criarCliente} error={error} />
    </div>
  )
}
