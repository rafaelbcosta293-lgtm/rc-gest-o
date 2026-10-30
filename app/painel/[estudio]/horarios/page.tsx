import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEquipaDoEstudio } from '@/lib/data/estudios'
import { fmt } from '@/lib/data/presencas'
import { diasDaSemana, inicioDaSemana, somarDias, chaveSlot } from '@/lib/data/horarios'
import { corInstrutor } from '@/lib/data/constantes'
import GrelhaHorarios, { type SlotPt, type CorPt } from '@/components/GrelhaHorarios'

export default async function HorariosPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ semana?: string; error?: string }>
}) {
  const { estudio: slug } = await params
  const { semana: semanaParam, error } = await searchParams
  const hoje = new Date().toISOString().slice(0, 10)
  const inicio = inicioDaSemana(semanaParam ?? hoje)
  const dias = diasDaSemana(inicio)
  const fimExclusivo = somarDias(inicio, 7)
  const semanaAnterior = somarDias(inicio, -7)
  const semanaSeguinte = somarDias(inicio, 7)

  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) {
    notFound()
  }

  const [{ data: turnosData, error: erroTurnos }, listaPts] = await Promise.all([
    supabase
      .from('escalas')
      .select('data, hora, minuto, pt:perfis!pt_id(id, nome)')
      .eq('estudio_id', estudio.id)
      .gte('data', inicio)
      .lt('data', fimExclusivo)
      .order('criado_em'),
    getEquipaDoEstudio(supabase, estudio.id),
  ])

  if (erroTurnos) {
    throw new Error(erroTurnos.message)
  }

  // Mesma cor por instrutor que aparece em Coordenação (mesma ordem
  // alfabética de getEquipaDoEstudio), para se reconhecer quem é quem.
  const corPorPt: Record<string, CorPt> = Object.fromEntries(
    listaPts.map((p, i) => [p.id, corInstrutor(i)])
  )

  // Objeto simples (não Map) porque isto atravessa a fronteira
  // servidor → cliente como propriedade de GrelhaHorarios.
  const slots: Record<string, SlotPt[]> = {}
  for (const t of (turnosData ?? []) as unknown as {
    data: string
    hora: number
    minuto: number
    pt: { id: string; nome: string } | null
  }[]) {
    if (!t.pt) continue
    const chave = chaveSlot(t.data, t.hora, t.minuto)
    const lista = slots[chave] ?? []
    lista.push({ pt_id: t.pt.id, nome: t.pt.nome })
    slots[chave] = lista
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-foreground">Horários</h1>
      <p className="mt-1 text-sm text-muted">
        {estudio.nome} · escala da semana.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <Link
          href={`/painel/${slug}/horarios?semana=${semanaAnterior}`}
          className="rounded-md border border-border-subtle px-3 py-1.5 text-sm"
        >
          ←
        </Link>
        <span className="text-sm font-medium">
          {fmt(dias[0])} – {fmt(dias[6])}
        </span>
        <Link
          href={`/painel/${slug}/horarios?semana=${semanaSeguinte}`}
          className="rounded-md border border-border-subtle px-3 py-1.5 text-sm"
        >
          →
        </Link>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Só para consulta — a escala é planeada em Coordenação.
      </p>

      <div className="mt-4">
        <GrelhaHorarios dias={dias} slots={slots} corPorPt={corPorPt} />
      </div>
    </div>
  )
}
