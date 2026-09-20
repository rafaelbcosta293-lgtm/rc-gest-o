import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ESTUDIOS } from '@/lib/data/constantes'
import { atualizarCliente } from '../../actions'
import ClienteForm from '../../ClienteForm'

export default async function EditarClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string; clienteId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { estudio, clienteId } = await params
  if (!ESTUDIOS.some((e) => e.id === estudio)) {
    notFound()
  }
  const { error } = await searchParams

  const supabase = await createClient()

  const { data: cliente } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', clienteId)
    .eq('estudio', estudio)
    .maybeSingle()

  if (!cliente) {
    notFound()
  }

  const { data: pts } = await supabase.from('profiles').select('id, nome').order('nome')

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/painel/${estudio}/treinos/${clienteId}`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← {cliente.nome}
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Editar ficha
      </h1>

      <ClienteForm
        estudio={estudio}
        cliente={cliente}
        pts={pts ?? []}
        action={atualizarCliente}
        error={error}
      />
    </div>
  )
}
