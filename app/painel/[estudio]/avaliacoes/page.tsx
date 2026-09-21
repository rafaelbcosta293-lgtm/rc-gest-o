import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { fmt } from '@/lib/data/presencas'

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

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← Voltar
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Avaliações
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {estudio.nome} · avaliações físicas, reavaliações e evolução.
      </p>

      <div className="mt-6 flex flex-col gap-2">
        {clientes.map((c) => {
          const ultima = c.avaliacoes?.[0]
          const reavaliacaoAtrasada = ultima?.proxima_reavaliacao
            ? ultima.proxima_reavaliacao <= hoje
            : false
          return (
            <Link
              key={c.id}
              href={`/painel/${slug}/avaliacoes/${c.id}`}
              className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white p-4 transition-colors hover:border-black/30 dark:border-white/10 dark:bg-zinc-950"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-black dark:text-zinc-50">{c.nome}</span>
                <div className="flex items-center gap-2">
                  {reavaliacaoAtrasada && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      Reavaliação prevista
                    </span>
                  )}
                  <span className="text-xs text-zinc-500">
                    {ultima ? `última em ${fmt(ultima.data)}` : 'sem avaliações'}
                  </span>
                </div>
              </div>
              {ultima && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                  <span>{ultima.peso_kg != null ? `${ultima.peso_kg} kg` : 'sem peso'}</span>
                  {ultima.imc != null && <span>· IMC {ultima.imc}</span>}
                  {ultima.massa_gorda_pct != null && <span>· {ultima.massa_gorda_pct}% gordura</span>}
                </div>
              )}
            </Link>
          )
        })}
      </div>

      {clientes.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-black/10 p-8 text-center text-sm text-zinc-500 dark:border-white/10">
          Ainda não há clientes ativos neste estúdio.
        </div>
      )}
    </div>
  )
}
