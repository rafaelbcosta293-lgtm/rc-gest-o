import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEquipaDoEstudio } from '@/lib/data/estudios'
import { criarEvento } from '../actions'
import NovoEventoForm from './NovoEventoForm'

export default async function NovoEventoPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ data?: string; error?: string }>
}) {
  const { estudio: slug } = await params
  const { data: dataParam, error } = await searchParams
  const hoje = new Date().toISOString().slice(0, 10)
  const dataInicial = dataParam ?? hoje

  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) {
    notFound()
  }

  const [pts, { data: clientesData, error: erroClientes }] = await Promise.all([
    getEquipaDoEstudio(supabase, estudio.id),
    supabase
      .from('clientes')
      .select('id, nome')
      .eq('estudio_id', estudio.id)
      .neq('estado', 'Ex-cliente')
      .order('nome'),
  ])
  if (erroClientes) {
    throw new Error(erroClientes.message)
  }
  const clientes = (clientesData ?? []) as { id: string; nome: string }[]

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href={`/painel/${slug}/agenda`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar à agenda
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Novo evento</h1>
      <p className="mt-1 text-sm text-muted">{estudio.nome}</p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {decodeURIComponent(error)}
        </p>
      )}

      <NovoEventoForm
        slug={slug}
        estudioId={estudio.id}
        dataInicial={dataInicial}
        pts={pts}
        clientes={clientes}
        action={criarEvento}
      />
    </div>
  )
}
