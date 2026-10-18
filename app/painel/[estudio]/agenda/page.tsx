import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEquipaDoEstudio } from '@/lib/data/estudios'
import { fmt, MESES, DIAS_SEMANA, diasDoMes, offsetPrimeiroDia } from '@/lib/data/presencas'
import { diasDaSemana, inicioDaSemana, somarDias } from '@/lib/data/horarios'
import { corTipoEvento } from '@/lib/data/agenda'
import AgendaInterativa from './AgendaInterativa'
import type { EventoAgenda } from '@/lib/supabase/database.types'

const VISTAS = ['dia', 'semana', 'mes'] as const
type Vista = (typeof VISTAS)[number]
const LABEL_VISTA: Record<Vista, string> = { dia: 'Dia', semana: 'Semana', mes: 'Mês' }

function ehVista(v: string | undefined): v is Vista {
  return VISTAS.includes(v as Vista)
}

function construirQuery(
  base: { vista?: string; pt?: string },
  overrides: Record<string, string | undefined>
) {
  const combinado = { ...base, ...overrides }
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(combinado)) {
    if (v) params.set(k, v)
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

type EventoComNomes = EventoAgenda & {
  cliente: { id: string; nome: string } | null
  pt: { id: string; nome: string } | null
}

async function buscarEventos(
  supabase: SupabaseClient,
  estudioId: number,
  inicio: string,
  fimExclusivo: string,
  ptFiltro?: string
) {
  let query = supabase
    .from('agenda_eventos')
    .select('*, cliente:clientes(id, nome), pt:perfis!pt_id(id, nome)')
    .eq('estudio_id', estudioId)
    .gte('data', inicio)
    .lt('data', fimExclusivo)
    .order('data')
    .order('hora_inicio')
  if (ptFiltro) query = query.eq('pt_id', ptFiltro)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as EventoComNomes[]
}

function PontosDia({ eventos }: { eventos: EventoComNomes[] }) {
  const ativos = eventos.filter((e) => e.estado !== 'Cancelado')
  if (ativos.length === 0) return null
  return (
    <div className="flex flex-wrap items-center justify-center gap-0.5">
      {ativos.slice(0, 4).map((e) => (
        <span key={e.id} className="h-1.5 w-1.5 rounded-full" style={{ background: corTipoEvento(e.tipo).tx }} />
      ))}
      {ativos.length > 4 && <span className="text-[9px] text-muted">+{ativos.length - 4}</span>}
    </div>
  )
}

function CalendarioMes({
  dias,
  offset,
  eventos,
  slug,
  hoje,
  qsExtra,
}: {
  dias: string[]
  offset: number
  eventos: EventoComNomes[]
  slug: string
  hoje: string
  qsExtra: string
}) {
  const porDia = new Map<string, EventoComNomes[]>()
  for (const e of eventos) {
    const lista = porDia.get(e.data) ?? []
    lista.push(e)
    porDia.set(e.data, lista)
  }

  return (
    <div className="mt-4 rounded-xl border border-border-subtle bg-surface p-4 shadow-card">
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted">
        {DIAS_SEMANA.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {dias.map((dia) => {
          const numero = Number(dia.slice(8, 10))
          return (
            <Link
              key={dia}
              href={`/painel/${slug}/agenda?vista=dia&data=${dia}${qsExtra}`}
              className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg hover:bg-brand/[.06] ${
                dia === hoje ? 'ring-2 ring-brand ring-offset-1' : ''
              }`}
            >
              <span className="text-[10px] text-muted">{numero}</span>
              <PontosDia eventos={porDia.get(dia) ?? []} />
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default async function AgendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ vista?: string; data?: string; pt?: string; error?: string }>
}) {
  const { estudio: slug } = await params
  const { vista: vistaParam, data: dataParam, pt: ptFiltro, error } = await searchParams
  const vista: Vista = ehVista(vistaParam) ? vistaParam : 'semana'
  const hoje = new Date().toISOString().slice(0, 10)
  const dataSel = dataParam ?? hoje

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
  const qsExtra = ptFiltro ? `&pt=${ptFiltro}` : ''

  let inicio: string
  let fimExclusivo: string
  let anterior: string
  let seguinte: string
  let tituloPeriodo: string
  let diasSemana: string[] = []
  let diasMes: string[] = []
  let offsetMes = 0

  if (vista === 'dia') {
    inicio = dataSel
    fimExclusivo = somarDias(dataSel, 1)
    anterior = somarDias(dataSel, -1)
    seguinte = somarDias(dataSel, 1)
    tituloPeriodo = fmt(dataSel)
  } else if (vista === 'semana') {
    inicio = inicioDaSemana(dataSel)
    diasSemana = diasDaSemana(inicio)
    fimExclusivo = somarDias(inicio, 7)
    anterior = somarDias(inicio, -7)
    seguinte = somarDias(inicio, 7)
    tituloPeriodo = `${fmt(diasSemana[0])} – ${fmt(diasSemana[6])}`
  } else {
    const ano = Number(dataSel.slice(0, 4))
    const mes = Number(dataSel.slice(5, 7))
    diasMes = diasDoMes(ano, mes)
    offsetMes = offsetPrimeiroDia(ano, mes)
    inicio = diasMes[0]
    fimExclusivo = somarDias(diasMes[diasMes.length - 1], 1)
    const anoAnt = mes === 1 ? ano - 1 : ano
    const mesAnt = mes === 1 ? 12 : mes - 1
    const anoSeg = mes === 12 ? ano + 1 : ano
    const mesSeg = mes === 12 ? 1 : mes + 1
    anterior = `${anoAnt}-${String(mesAnt).padStart(2, '0')}-01`
    seguinte = `${anoSeg}-${String(mesSeg).padStart(2, '0')}-01`
    tituloPeriodo = `${MESES[mes - 1]} ${ano}`
  }

  const eventos = await buscarEventos(supabase, estudio.id, inicio, fimExclusivo, ptFiltro)

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Agenda</h1>
          <p className="mt-1 text-sm text-muted">
            {estudio.nome} · treinos, avaliações e reuniões
          </p>
        </div>
        <Link
          href={`/painel/${slug}/agenda/novo?data=${dataSel}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black shadow-pop hover:bg-brand-strong"
        >
          <Plus className="h-4 w-4" /> Evento
        </Link>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {decodeURIComponent(error)}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-1.5 rounded-full bg-border-subtle p-1">
        {VISTAS.map((v) => (
          <Link
            key={v}
            href={`/painel/${slug}/agenda${construirQuery({ pt: ptFiltro }, { vista: v })}`}
            className={`flex-1 rounded-full px-3 py-1.5 text-center text-xs font-semibold transition-all ${
              vista === v ? 'bg-surface text-foreground shadow-pop' : 'text-muted hover:text-foreground'
            }`}
          >
            {LABEL_VISTA[v]}
          </Link>
        ))}
      </div>

      {pts.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span className="font-semibold">Instrutor:</span>
          <Link
            href={`/painel/${slug}/agenda${construirQuery({ vista }, { pt: undefined })}`}
            className={`rounded-full border px-2.5 py-1 font-medium ${
              !ptFiltro ? 'border-brand bg-brand text-black' : 'border-border-subtle text-muted'
            }`}
          >
            Todos
          </Link>
          {pts.map((p) => (
            <Link
              key={p.id}
              href={`/painel/${slug}/agenda${construirQuery({ vista }, { pt: p.id })}`}
              className={`rounded-full border px-2.5 py-1 font-medium ${
                ptFiltro === p.id ? 'border-brand bg-brand text-black' : 'border-border-subtle text-muted'
              }`}
            >
              {p.nome}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-3">
        <Link
          href={`/painel/${slug}/agenda${construirQuery({ vista, pt: ptFiltro }, { data: anterior })}`}
          className="rounded-md border border-border-subtle px-3 py-1.5 text-sm"
        >
          ←
        </Link>
        <span className="text-sm font-semibold text-foreground">{tituloPeriodo}</span>
        <Link
          href={`/painel/${slug}/agenda${construirQuery({ vista, pt: ptFiltro }, { data: seguinte })}`}
          className="rounded-md border border-border-subtle px-3 py-1.5 text-sm"
        >
          →
        </Link>
      </div>

      {(vista === 'dia' || vista === 'semana') && (
        <AgendaInterativa
          slug={slug}
          estudioId={estudio.id}
          dias={vista === 'dia' ? [dataSel] : diasSemana}
          eventos={eventos}
          clientes={clientes}
          pts={pts}
        />
      )}
      {vista === 'mes' && (
        <CalendarioMes
          dias={diasMes}
          offset={offsetMes}
          eventos={eventos}
          slug={slug}
          hoje={hoje}
          qsExtra={qsExtra}
        />
      )}
    </div>
  )
}
