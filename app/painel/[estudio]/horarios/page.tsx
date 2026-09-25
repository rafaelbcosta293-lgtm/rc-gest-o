import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEquipaDoEstudio } from '@/lib/data/estudios'
import { getSessaoAtual } from '@/lib/data/sessao'
import { fmt } from '@/lib/data/presencas'
import { diasDaSemana, inicioDaSemana, somarDias, chaveSlot } from '@/lib/data/horarios'
import { criarAusencia, apagarAusencia, registarHoras, atualizarMinhasHoras, apagarMinhasHoras } from './actions'
import { corInstrutor } from '@/lib/data/constantes'
import SubmitButton from '@/components/SubmitButton'
import GrelhaHorarios, { type SlotPt, type CorPt } from '@/components/GrelhaHorarios'
import type { Ausencia, RegistoPt } from '@/lib/supabase/database.types'

const inputCls =
  'rounded-md border border-black/10 px-2 py-1.5 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900 dark:focus:border-white/30'

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
  const [estudio, sessao] = await Promise.all([getEstudioPorSlug(supabase, slug), getSessaoAtual()])
  if (!estudio) {
    notFound()
  }

  const [
    { data: turnosData, error: erroTurnos },
    listaPts,
    { data: ausenciasData, error: erroAusencias },
    { data: minhasHorasData, error: erroMinhasHoras },
  ] = await Promise.all([
    supabase
      .from('escalas')
      .select('data, hora, minuto, pt:perfis!pt_id(id, nome)')
      .eq('estudio_id', estudio.id)
      .gte('data', inicio)
      .lt('data', fimExclusivo)
      .order('criado_em'),
    getEquipaDoEstudio(supabase, estudio.id),
    supabase.from('ausencias').select('*').gte('fim', hoje).order('inicio').limit(20),
    supabase
      .from('registos_pt')
      .select('*')
      .eq('estudio_id', estudio.id)
      .eq('pt_id', sessao.userId ?? '')
      .order('data', { ascending: false })
      .limit(20),
  ])

  if (erroTurnos || erroAusencias || erroMinhasHoras) {
    throw new Error((erroTurnos ?? erroAusencias ?? erroMinhasHoras)!.message)
  }
  const minhasHoras = (minhasHorasData ?? []) as RegistoPt[]

  const ausencias = (ausenciasData ?? []) as Ausencia[]
  const ptsPorId = new Map(listaPts.map((p) => [p.id, p.nome]))
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
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← Voltar
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">Horários</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {estudio.nome} · escala da semana e ausências da equipa.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <Link
          href={`/painel/${slug}/horarios?semana=${semanaAnterior}`}
          className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
        >
          ←
        </Link>
        <span className="text-sm font-medium">
          {fmt(dias[0])} – {fmt(dias[6])}
        </span>
        <Link
          href={`/painel/${slug}/horarios?semana=${semanaSeguinte}`}
          className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
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

      <h2 className="mt-10 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Ausências (a partir de hoje)
      </h2>
      <form action={criarAusencia} className="mt-2 flex flex-wrap items-end gap-3">
        <input type="hidden" name="estudio_slug" value={slug} />
        <input type="hidden" name="semana" value={inicio} />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">PT</label>
          <select
            name="pt_id"
            className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900"
          >
            {listaPts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Tipo</label>
          <select
            name="tipo"
            defaultValue="Férias"
            className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900"
          >
            {['Férias', 'Baixa', 'Formação', 'Outra'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Início</label>
          <input
            type="date"
            name="inicio"
            defaultValue={hoje}
            className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Fim</label>
          <input
            type="date"
            name="fim"
            defaultValue={hoje}
            className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Nota (opcional)
          </label>
          <input
            name="nota"
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900"
          />
        </div>
        <SubmitButton
          pendingText="A adicionar…"
          className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
        >
          + Ausência
        </SubmitButton>
      </form>

      {ausencias.length === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-black/10 p-6 text-center text-sm text-zinc-500 dark:border-white/10">
          Sem ausências futuras registadas.
        </div>
      )}
      <div className="mt-3 flex flex-col gap-2">
        {ausencias.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-3 rounded-lg border border-black/10 bg-white p-3 text-sm dark:border-white/10 dark:bg-zinc-950"
          >
            <span className="font-medium text-black dark:text-zinc-50">
              {ptsPorId.get(a.pt_id) ?? '—'}
            </span>
            <span className="text-xs text-zinc-500">{a.tipo}</span>
            <span className="text-xs text-zinc-500">
              {fmt(a.inicio)} – {fmt(a.fim)}
            </span>
            {a.nota && (
              <span className="flex-1 truncate text-xs text-zinc-600 dark:text-zinc-400">
                {a.nota}
              </span>
            )}
            <form action={apagarAusencia}>
              <input type="hidden" name="estudio_slug" value={slug} />
              <input type="hidden" name="semana" value={inicio} />
              <input type="hidden" name="id" value={a.id} />
              <SubmitButton
                pendingText="…"
                aria-label="Apagar"
                className="ml-auto text-lg text-zinc-400 hover:text-red-600"
              >
                ×
              </SubmitButton>
            </form>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        As minhas horas
      </h2>
      <form action={registarHoras} className="mt-2 flex flex-wrap items-end gap-2">
        <input type="hidden" name="estudio_slug" value={slug} />
        <input type="hidden" name="estudio_id" value={estudio.id} />
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Dia</label>
          <input type="date" name="data" defaultValue={hoje} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Horas</label>
          <input type="number" step="0.5" name="horas" defaultValue={0} className={`${inputCls} w-20`} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Treinos 40 min</label>
          <input type="number" name="treinos_40" defaultValue={0} className={`${inputCls} w-20`} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Treinos 60 min</label>
          <input type="number" name="treinos_60" defaultValue={0} className={`${inputCls} w-20`} />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs text-zinc-500">Nota</label>
          <input name="nota" className={`${inputCls} w-full`} />
        </div>
        <SubmitButton
          pendingText="A guardar…"
          className="rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-black"
        >
          Registar
        </SubmitButton>
      </form>

      {minhasHoras.length === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-black/10 p-6 text-center text-sm text-zinc-500 dark:border-white/10">
          Ainda não registaste horas.
        </div>
      )}
      <div className="mt-3 flex flex-col gap-2">
        {minhasHoras.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-black/10 bg-white p-2.5 text-sm dark:border-white/10 dark:bg-zinc-950"
          >
            <span className="w-20 text-xs text-zinc-500">{fmt(r.data)}</span>
            <form action={atualizarMinhasHoras} className="flex flex-1 flex-wrap items-center gap-2">
              <input type="hidden" name="estudio_slug" value={slug} />
              <input type="hidden" name="id" value={r.id} />
              <input
                type="number"
                step="0.5"
                name="horas"
                defaultValue={r.horas}
                className={`${inputCls} w-16`}
              />
              <input
                type="number"
                name="treinos_40"
                defaultValue={r.treinos_40}
                title="Treinos 40 min"
                className={`${inputCls} w-14`}
              />
              <input
                type="number"
                name="treinos_60"
                defaultValue={r.treinos_60}
                title="Treinos 60 min"
                className={`${inputCls} w-14`}
              />
              <input name="nota" defaultValue={r.nota ?? ''} className={`${inputCls} flex-1`} />
              <SubmitButton
                pendingText="…"
                className="rounded-md border border-black/10 px-2 py-1 text-xs dark:border-white/10"
              >
                Guardar
              </SubmitButton>
            </form>
            <form action={apagarMinhasHoras}>
              <input type="hidden" name="estudio_slug" value={slug} />
              <input type="hidden" name="id" value={r.id} />
              <SubmitButton
                pendingText="…"
                aria-label="Apagar registo"
                className="text-lg text-zinc-400 hover:text-red-600"
              >
                ×
              </SubmitButton>
            </form>
          </div>
        ))}
      </div>
    </div>
  )
}
