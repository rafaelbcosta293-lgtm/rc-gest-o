import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { fmt } from '@/lib/data/presencas'
import ListaAvaliacoes, { type LinhaAvaliacao } from './ListaAvaliacoes'

type ClienteComUltimaAvaliacao = {
  id: string
  nome: string
  avaliacoes: {
    data: string
    proxima_reavaliacao: string | null
    peso_kg: number | null
    imc: number | null
    massa_gorda_pct: number | null
  }[]
}

export default async function AvaliacoesPage({
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

  // Uma única consulta: clientes ativos e, para cada um, só a avaliação
  // mais recente (embutida), tal como já fazemos em Treinos.
  const { data: clientesData, error } = await supabase
    .from('clientes')
    .select('id, nome, avaliacoes(data, proxima_reavaliacao, peso_kg, imc, massa_gorda_pct)')
    .eq('estudio_id', estudio.id)
    .eq('estado', 'Ativo')
    .order('nome')
    .order('data', { referencedTable: 'avaliacoes', ascending: false })
    .limit(1, { referencedTable: 'avaliacoes' })

  if (error) {
    throw new Error(error.message)
  }

  const clientes = (clientesData ?? []) as unknown as ClienteComUltimaAvaliacao[]
  const hoje = new Date().toISOString().slice(0, 10)

  const linhas: LinhaAvaliacao[] = clientes.map((c) => {
    const ultima = c.avaliacoes?.[0]
    return {
      id: c.id,
      nome: c.nome,
      reavaliacaoAtrasada: ultima?.proxima_reavaliacao ? ultima.proxima_reavaliacao <= hoje : false,
      ultimaData: ultima ? fmt(ultima.data) : null,
      pesoKg: ultima?.peso_kg ?? null,
      imc: ultima?.imc ?? null,
      massaGordaPct: ultima?.massa_gorda_pct ?? null,
    }
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Avaliações
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {estudio.nome} · avaliações físicas, reavaliações e evolução.
      </p>

      <ListaAvaliacoes linhas={linhas} slug={slug} />
    </div>
  )
}
