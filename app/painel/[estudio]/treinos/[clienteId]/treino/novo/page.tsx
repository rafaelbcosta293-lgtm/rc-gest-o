import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEquipaDoEstudio } from '@/lib/data/estudios'
import { getCatalogoExercicios } from '@/lib/data/catalogo'
import { criarSessao } from '../actions'
import TreinoForm from '../../../TreinoForm'

export default async function NovoTreinoPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string; clienteId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { estudio: slug, clienteId } = await params
  const { error } = await searchParams

  const supabase = await createClient()
  const [estudio, { data: cliente }, catalogo, { data: ultima }] = await Promise.all([
    getEstudioPorSlug(supabase, slug),
    supabase
      .from('clientes')
      .select('id, nome, pt_principal_id, estudio_id')
      .eq('id', clienteId)
      .maybeSingle(),
    getCatalogoExercicios(supabase),
    supabase
      .from('sessoes')
      .select('data, nota_proxima')
      .eq('cliente_id', clienteId)
      .order('data', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!estudio || !cliente || cliente.estudio_id !== estudio.id) {
    notFound()
  }

  const pts = await getEquipaDoEstudio(supabase, estudio.id)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href={`/painel/${slug}/treinos/${clienteId}`}
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
        estudioSlug={slug}
        estudioId={estudio.id}
        clienteId={clienteId}
        pts={pts}
        ptPredefinido={cliente.pt_principal_id}
        catalogo={catalogo}
        action={criarSessao}
        error={error}
      />
    </div>
  )
}
