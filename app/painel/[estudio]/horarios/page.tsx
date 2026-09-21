import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { fmt } from '@/lib/data/presencas'
import {
  BLOCOS_HORARIO,
  DIAS_SEMANA,
  diasDaSemana,
  inicioDaSemana,
  somarDias,
} from '@/lib/data/horarios'
import { guardarSlot, criarAusencia, apagarAusencia } from './actions'
import SubmitButton from '@/components/SubmitButton'
import type { Ausencia, Perfil } from '@/lib/supabase/database.types'

type SlotPt = { pt_id: string; nome: string }

function chaveSlot(data: string, hora: number, minuto: number) {
  return `${data}_${hora}_${minuto}`
}

export default async function HorariosPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ semana?: string; editar?: string; error?: string }>
}) {
  const { estudio: slug } = await params
  const { semana: semanaParam, editar, error } = await searchParams
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

  const [
    { data: turnosData, error: erroTurnos },
    { data: pts },
    { data: ausenciasData, error: erroAusencias },
  ] = await Promise.all([
    supabase
      .from('escalas')
      .select('data, hora, minuto, pt:perfis!pt_id(id, nome)')
      .eq('estudio_id', estudio.id)
      .gte('data', inicio)
      .lt('data', fimExclusivo)
      .order('criado_em'),
    supabase.from('perfis').select('id, nome').order('nome'),
    supabase.from('ausencias').select('*').gte('fim', hoje).order('inicio').limit(20),
  ])

  if (erroTurnos || erroAusencias) {
    throw new Error((erroTurnos ?? erroAusencias)!.message)
  }

  const ausencias = (ausenciasData ?? []) as Ausencia[]
  const listaPts = (pts ?? []) as Pick<Perfil, 'id' | 'nome'>[]
  const ptsPorId = new Map(listaPts.map((p) => [p.id, p.nome]))

  const slots = new Map<string, SlotPt[]>()
  for (const t of (turnosData ?? []) as unknown as {
    data: string
    hora: number
    minuto: number
    pt: { id: string; nome: string } | null
  }[]) {
    if (!t.pt) continue
    const chave = chaveSlot(t.data, t.hora, t.minuto)
    const lista = slots.get(chave) ?? []
    lista.push({ pt_id: t.pt.id, nome: t.pt.nome })
    slots.set(chave, lista)
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
        Clica num horário para marcar ou mudar quem trabalha (até 3 pessoas em simultâneo).
      </p>

      <div className="mt-4 overflow-x-auto">
        <div
          className="grid min-w-[760px] gap-px overflow-hidden rounded-lg border border-black/10 bg-black/10 text-xs dark:border-white/10 dark:bg-white/10"
          style={{ gridTemplateColumns: '64px repeat(7, 1fr)' }}
        >
          <div className="bg-zinc-50 p-1.5 dark:bg-zinc-900" />
          {dias.map((d, i) => (
            <div
              key={d}
              className="bg-zinc-50 p-1.5 text-center font-medium text-black dark:bg-zinc-900 dark:text-zinc-50"
            >
              {DIAS_SEMANA[i].slice(0, 3)}
              <br />
              <span className="font-normal text-zinc-500">{fmt(d)}</span>
            </div>
          ))}

          {BLOCOS_HORARIO.map((bloco) => (
            <FragmentoLinha
              key={`${bloco.hora}-${bloco.minuto}`}
              bloco={bloco}
              dias={dias}
              slots={slots}
              pts={listaPts}
              estudioSlug={slug}
              estudioId={estudio.id}
              semana={inicio}
              editar={editar}
            />
          ))}
        </div>
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
    </div>
  )
}

function FragmentoLinha({
  bloco,
  dias,
  slots,
  pts,
  estudioSlug,
  estudioId,
  semana,
  editar,
}: {
  bloco: { hora: number; minuto: number; label: string }
  dias: string[]
  slots: Map<string, SlotPt[]>
  pts: Pick<Perfil, 'id' | 'nome'>[]
  estudioSlug: string
  estudioId: number
  semana: string
  editar?: string
}) {
  return (
    <>
      <div className="flex items-center bg-white p-1.5 text-zinc-500 dark:bg-zinc-950">
        {bloco.label}
      </div>
      {dias.map((dia) => {
        const chave = chaveSlot(dia, bloco.hora, bloco.minuto)
        const atual = slots.get(chave) ?? []
        const aEditar = editar === chave

        if (aEditar) {
          const opcoes = [0, 1, 2].map((i) => atual[i]?.pt_id ?? '')
          return (
            <form
              key={dia}
              action={guardarSlot}
              className="flex flex-col gap-1 bg-teal-50 p-1.5 dark:bg-teal-950"
            >
              <input type="hidden" name="estudio_slug" value={estudioSlug} />
              <input type="hidden" name="estudio_id" value={estudioId} />
              <input type="hidden" name="semana" value={semana} />
              <input type="hidden" name="data" value={dia} />
              <input type="hidden" name="hora" value={bloco.hora} />
              <input type="hidden" name="minuto" value={bloco.minuto} />
              {opcoes.map((v, i) => (
                <select
                  key={i}
                  name={`pt_id_${i + 1}`}
                  defaultValue={v}
                  className="w-full rounded border border-black/10 bg-white px-1 py-0.5 text-[11px] dark:border-white/10 dark:bg-zinc-900"
                >
                  <option value="">—</option>
                  {pts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              ))}
              <div className="mt-0.5 flex items-center justify-between gap-1">
                <SubmitButton
                  pendingText="…"
                  className="rounded bg-foreground px-2 py-0.5 text-[11px] font-medium text-background"
                >
                  Guardar
                </SubmitButton>
                <Link
                  href={`/painel/${estudioSlug}/horarios?semana=${semana}`}
                  className="text-[11px] text-zinc-500 underline"
                >
                  Cancelar
                </Link>
              </div>
            </form>
          )
        }

        return (
          <Link
            key={dia}
            href={`/painel/${estudioSlug}/horarios?semana=${semana}&editar=${chave}`}
            className="flex min-h-[2.25rem] flex-col justify-center gap-0.5 bg-white p-1 text-[11px] leading-tight hover:bg-black/[.03] dark:bg-zinc-950 dark:hover:bg-white/[.06]"
          >
            {atual.length === 0 ? (
              <span className="text-center text-zinc-300 dark:text-zinc-700">+</span>
            ) : (
              atual.map((s) => (
                <span key={s.pt_id} className="truncate text-teal-700 dark:text-teal-400">
                  {s.nome}
                </span>
              ))
            )}
          </Link>
        )
      })}
    </>
  )
}
