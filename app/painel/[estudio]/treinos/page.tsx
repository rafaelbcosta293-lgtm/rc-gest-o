import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { ALERTAS } from '@/lib/data/constantes'
import ListaTreinos, { type LinhaTreino } from './ListaTreinos'

function diasDesde(iso: string) {
  return Math.round((Date.now() - new Date(iso).getTime()) / 86400000)
}

export default async function TreinosPage({
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

  // Uma única consulta: traz os clientes e, para cada um, apenas a
  // data do treino mais recente (embutido), em vez de duas consultas
  // separadas (clientes, depois sessões).
  const { data: clientesData } = await supabase
    .from('clientes')
    .select('id, nome, objetivo, alerta, sessoes(data)')
    .eq('estudio_id', estudio.id)
    .eq('estado', 'Ativo')
    .order('nome')
    .order('data', { referencedTable: 'sessoes', ascending: false })
    .limit(1, { referencedTable: 'sessoes' })

  type ClienteComUltimoTreino = {
    id: string
    nome: string
    objetivo: string | null
    alerta: string
    sessoes: { data: string }[]
  }
  const clientes = (clientesData ?? []) as unknown as ClienteComUltimoTreino[]

  const linhas: LinhaTreino[] = clientes.map((c) => {
    const a = ALERTAS[c.alerta as keyof typeof ALERTAS] ?? ALERTAS.Nenhum
    const ultima = c.sessoes?.[0]?.data
    return {
      id: c.id,
      nome: c.nome,
      objetivo: c.objetivo,
      alertaLabel: c.alerta !== 'Nenhum' ? a.label : null,
      alertaBg: a.bg,
      alertaTx: a.tx,
      alertaDot: a.dot,
      ultimoTreinoLabel: ultima
        ? diasDesde(ultima) === 0
          ? 'Treinou hoje'
          : diasDesde(ultima) === 1
            ? 'Ontem'
            : `Há ${diasDesde(ultima)} dias`
        : 'Sem treinos registados',
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

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Treinos
          </h1>
          <p className="mt-1 text-sm text-muted">
            {estudio.nome} · {clientes.length} clientes ativos
          </p>
        </div>
        <Link
          href={`/painel/${slug}/treinos/novo`}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
        >
          + Cliente
        </Link>
      </div>

      <ListaTreinos linhas={linhas} slug={slug} />
    </div>
  )
}
