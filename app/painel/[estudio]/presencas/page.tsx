import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { treinosPrevistos, intervaloMes, MESES } from '@/lib/data/presencas'
import { corInstrutor } from '@/lib/data/constantes'
import ListaPresencas, { type LinhaPresenca } from './ListaPresencas'

export default async function PresencasPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ ano?: string; mes?: string }>
}) {
  const { estudio: slug } = await params
  const agora = new Date()
  const { ano: anoParam, mes: mesParam } = await searchParams
  const ano = anoParam ? Number(anoParam) : agora.getFullYear()
  const mes = mesParam ? Number(mesParam) : agora.getMonth() + 1

  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) {
    notFound()
  }

  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nome, frequencia_semanal')
    .eq('estudio_id', estudio.id)
    .eq('estado', 'Ativo')
    .order('nome')

  const ids = (clientes ?? []).map((c) => c.id)
  const { inicio, fimExclusivo } = intervaloMes(ano, mes)
  const { data: presencas, error: erroPresencas } = ids.length
    ? await supabase
        .from('presencas')
        .select('cliente_id, estado')
        .in('cliente_id', ids)
        .gte('data', inicio)
        .lt('data', fimExclusivo)
    : { data: [], error: null }

  if (erroPresencas) {
    throw new Error(erroPresencas.message)
  }

  const statsPorCliente = new Map<string, { feitos: number; faltas: number; avisadas: number }>()
  for (const p of presencas ?? []) {
    const s = statsPorCliente.get(p.cliente_id) ?? { feitos: 0, faltas: 0, avisadas: 0 }
    if (p.estado === 'Presente') s.feitos++
    else if (p.estado === 'Faltou') s.faltas++
    else if (p.estado === 'Faltou (avisou)') s.avisadas++
    statsPorCliente.set(p.cliente_id, s)
  }

  const mesAnterior = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 }
  const mesSeguinte = mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 }

  const linhas: LinhaPresenca[] = (clientes ?? []).map((c, indice) => {
    const s = statsPorCliente.get(c.id) ?? { feitos: 0, faltas: 0, avisadas: 0 }
    const alvo = treinosPrevistos(c.frequencia_semanal, ano, mes)?.arredondado ?? null
    const pct = alvo ? Math.min(100, Math.round((s.feitos / alvo) * 100)) : null
    const cor = corInstrutor(indice)
    return {
      id: c.id,
      nome: c.nome,
      frequenciaSemanal: c.frequencia_semanal,
      feitos: s.feitos,
      faltas: s.faltas,
      avisadas: s.avisadas,
      alvo,
      pct,
      corBg: cor.bg,
      corTx: cor.tx,
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
        Presenças
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {estudio.nome} · quem treinou e quem faltou este mês.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Link
          href={`/painel/${slug}/presencas?ano=${mesAnterior.ano}&mes=${mesAnterior.mes}`}
          className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
        >
          ←
        </Link>
        <span className="text-sm font-medium">
          {MESES[mes - 1]} {ano}
        </span>
        <Link
          href={`/painel/${slug}/presencas?ano=${mesSeguinte.ano}&mes=${mesSeguinte.mes}`}
          className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
        >
          →
        </Link>
      </div>

      <ListaPresencas linhas={linhas} slug={slug} ano={ano} mes={mes} />
    </div>
  )
}
