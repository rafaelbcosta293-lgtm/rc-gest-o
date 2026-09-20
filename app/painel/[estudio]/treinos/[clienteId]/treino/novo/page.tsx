import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ESTUDIOS } from '@/lib/data/constantes'
import { criarSessao } from '../actions'
import TreinoForm from '../../../TreinoForm'

export default async function NovoTreinoPage({
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
    .select('id, nome, pt')
    .eq('id', clienteId)
    .eq('estudio', estudio)
    .maybeSingle()

  if (!cliente) {
    notFound()
  }

  const { data: pts } = await supabase.from('profiles').select('id, nome').order('nome')
  const { data: ultima } = await supabase
    .from('sessoes')
    .select('data, pt, nota_proxima')
    .eq('cliente_id', clienteId)
    .order('data', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href={`/painel/${estudio}/treinos/${clienteId}`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← {cliente.nome}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Planear treino
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{cliente.nome}</p>

      {ultima?.nota_proxima && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:bg-amber-950">
          <div className="text-[11px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Nota do último treino · {ultima.data}
          </div>
          <p className="mt-1 text-sm text-amber-900 dark:text-amber-100">
            {ultima.nota_proxima}
          </p>
        </div>
      )}

      <TreinoForm
        estudio={estudio}
        clienteId={clienteId}
        pts={pts ?? []}
        ptPredefinido={cliente.pt ?? undefined}
        action={criarSessao}
        error={error}
      />
    </div>
  )
}
