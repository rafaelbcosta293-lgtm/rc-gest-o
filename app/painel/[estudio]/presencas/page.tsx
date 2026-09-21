import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { treinosPrevistos, intervaloMes, MESES, iniciais } from '@/lib/data/presencas'
import { corInstrutor } from '@/lib/data/constantes'
import AnelProgresso from '@/components/AnelProgresso'

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

      <div className="mt-6 flex flex-col overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
        {(clientes ?? []).map((c, indice) => {
          const s = statsPorCliente.get(c.id) ?? { feitos: 0, faltas: 0, avisadas: 0 }
          const prev = treinosPrevistos(c.frequencia_semanal, ano, mes)
          const alvo = prev?.arredondado
          const pct = alvo ? Math.min(100, Math.round((s.feitos / alvo) * 100)) : null
          const cor = corInstrutor(indice)
          return (
            <Link
              key={c.id}
              href={`/painel/${slug}/presencas/${c.id}?ano=${ano}&mes=${mes}`}
              className={`flex items-center gap-4 bg-white px-4 py-3 transition-colors hover:bg-black/[.02] dark:bg-zinc-950 dark:hover:bg-white/[.05] ${
                indice > 0 ? 'border-t border-black/10 dark:border-white/10' : ''
              }`}
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                style={{ background: cor.bg, color: cor.tx }}
              >
                {iniciais(c.nome)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-x-2">
                  <strong className="truncate text-sm text-black dark:text-zinc-50">
                    {c.nome}
                  </strong>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {c.frequencia_semanal ? `${c.frequencia_semanal}×/semana` : 'sem frequência'}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {s.feitos}{alvo != null ? ` de ${alvo}` : ''} treinos
                  </span>
                  {s.faltas > 0 && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                      {s.faltas} faltas
                    </span>
                  )}
                  {s.avisadas > 0 && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      {s.avisadas} avisadas
                    </span>
                  )}
                </div>
              </div>
              {alvo != null && (
                <AnelProgresso
                  percent={pct ?? 0}
                  color={(pct ?? 0) >= 100 ? '#1E7145' : '#0E9594'}
                >
                  <span className="text-xs font-semibold text-black dark:text-zinc-50">
                    {pct}%
                  </span>
                </AnelProgresso>
              )}
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
