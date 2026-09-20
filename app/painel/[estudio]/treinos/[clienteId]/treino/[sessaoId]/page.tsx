import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ESTUDIOS } from '@/lib/data/constantes'
import { atualizarSessao } from '../actions'
import TreinoForm from '../../../TreinoForm'

export default async function EditarTreinoPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string; clienteId: string; sessaoId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { estudio, clienteId, sessaoId } = await params
  if (!ESTUDIOS.some((e) => e.id === estudio)) {
    notFound()
  }
  const { error } = await searchParams

  const supabase = await createClient()

  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, nome')
    .eq('id', clienteId)
    .eq('estudio', estudio)
    .maybeSingle()

  const { data: sessao } = await supabase
    .from('sessoes')
    .select('*')
    .eq('id', sessaoId)
    .eq('cliente_id', clienteId)
    .maybeSingle()

  if (!cliente || !sessao) {
    notFound()
  }

  const { data: pts } = await supabase.from('profiles').select('id, nome').order('nome')

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href={`/painel/${estudio}/treinos/${clienteId}`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← {cliente.nome}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Editar treino
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{cliente.nome}</p>

      <TreinoForm
        estudio={estudio}
        clienteId={clienteId}
        pts={pts ?? []}
        sessao={sessao}
        action={atualizarSessao}
        error={error}
      />
    </div>
  )
}
