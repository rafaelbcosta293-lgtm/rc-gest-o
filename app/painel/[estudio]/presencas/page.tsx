import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { treinosPrevistos, intervaloMes, MESES } from '@/lib/data/presencas'

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

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← Voltar
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

      <div className="mt-4 flex flex-col gap-2">
        {(clientes ?? []).map((c) => {
          const s = statsPorCliente.get(c.id) ?? { feitos: 0, faltas: 0, avisadas: 0 }
          const prev = treinosPrevistos(c.frequencia_semanal, ano, mes)
          const alvo = prev?.arredondado
          const pct = alvo ? Math.min(100, Math.round((s.feitos / alvo) * 100)) : null
          return (
            <Link
              key={c.id}
              href={`/painel/${slug}/presencas/${c.id}?ano=${ano}&mes=${mes}`}
              className="rounded-xl border border-black/10 bg-white p-4 transition-colors hover:border-black/30 dark:border-white/10 dark:bg-zinc-950"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-sm text-black dark:text-zinc-50">{c.nome}</strong>
                <span className="text-xs text-zinc-500">
                  {c.frequencia_semanal ? `${c.frequencia_semanal}×/semana` : 'sem frequência'}
                </span>
              </div>
              {alvo !== null && alvo !== undefined && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-teal-600"
                    style={{ width: `${pct ?? 0}%` }}
                  />
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                <span>
                  {s.feitos} {alvo !== null ? `de ${alvo}` : ''} treinos
                </span>
                {s.faltas > 0 && <span className="text-red-600">{s.faltas} faltas</span>}
                {s.avisadas > 0 && <span className="text-amber-600">{s.avisadas} avisadas</span>}
              </div>
            </Link>
          )
        })}
      </div>

      {(clientes ?? []).length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-black/10 p-8 text-center text-sm text-zinc-500 dark:border-white/10">
          Ainda não há clientes ativos neste estúdio.
        </div>
      )}
    </div>
  )
}
