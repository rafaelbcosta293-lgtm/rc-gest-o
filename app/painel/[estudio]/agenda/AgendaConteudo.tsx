import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getEquipaDoEstudio, obterOutroEstudioEClientes } from '@/lib/data/estudios'
import { fmt, MESES, DIAS_SEMANA, diasDoMes, offsetPrimeiroDia } from '@/lib/data/presencas'
import { diasDaSemana, inicioDaSemana, somarDias } from '@/lib/data/horarios'
import { corTipoEvento } from '@/lib/data/agenda'
import AgendaInterativa from './AgendaInterativa'
import type { LeadOpcao } from '@/components/CamposSessaoExperimental'
import type { EventoAgenda, Estudio } from '@/lib/supabase/database.types'

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
  cliente: { id: string; nome: string; estudio_id: number; numero_socio: string | null } | null
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
    .select('*, cliente:clientes(id, nome, estudio_id, numero_socio), pt:perfis!pt_id(id, nome)')
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
  basePath,
  hoje,
  qsExtra,
}: {
  dias: string[]
  offset: number
  eventos: EventoComNomes[]
  basePath: string
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
              href={`${basePath}?vista=dia&data=${dia}${qsExtra}`}
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

// Corpo da Agenda, partilhado entre a página dedicada
// (/painel/[estudio]/agenda) e a página principal dos estúdios Fátima e
// Leiria (onde a Agenda passa a ser a página de entrada) — basePath
// aponta os links internos (vista/período) para o sítio certo em cada
// caso, e mostrarVoltar esconde o "← Voltar" quando já se está na
// página principal.
export default async function AgendaConteudo({
  estudio,
  searchParams,
  basePath,
  mostrarVoltar,
}: {
  estudio: Pick<Estudio, 'id' | 'slug' | 'nome'>
  searchParams: { vista?: string; data?: string; pt?: string; error?: string }
  basePath: string
  mostrarVoltar: boolean
}) {
  const slug = estudio.slug
  const { vista: vistaParam, data: dataParam, pt: ptFiltro, error } = searchParams
  const vista: Vista = ehVista(vistaParam) ? vistaParam : 'semana'
  const hoje = new Date().toISOString().slice(0, 10)
  const dataSel = dataParam ?? hoje

  const supabase = await createClient()

  const [pts, { data: clientesData, error: erroClientes }, { data: leadsData, error: erroLeads }, { outroEstudio, clientesOutroEstudio }] =
    await Promise.all([
      getEquipaDoEstudio(supabase, estudio.id),
      supabase
        .from('clientes')
        .select('id, nome')
        .eq('estudio_id', estudio.id)
        .order('nome'),
      supabase
        .from('leads')
        .select('id, nome, telefone')
        .eq('estudio_id', estudio.id)
        .neq('estado', 'Perdida')
        .order('nome'),
      obterOutroEstudioEClientes(supabase, estudio.id),
    ])
  if (erroClientes) {
    throw new Error(erroClientes.message)
  }
  if (erroLeads) {
    throw new Error(erroLeads.message)
  }
  const clientes = (clientesData ?? []) as { id: string; nome: string }[]
  const leads = (leadsData ?? []) as LeadOpcao[]
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
    <div>
      {/* Cabeçalho compactado numa única linha (título+voltar+Evento),
          para a grelha da agenda começar mais perto do topo — pedido
          do dono para ver uma janela maior da agenda de uma vez. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {mostrarVoltar && (
            <Link
              href={`/painel/${slug}`}
              className="inline-flex shrink-0 items-center gap-1 text-sm text-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          )}
          <h1 className="truncate text-xl font-bold tracking-tight text-foreground">
            Agenda <span className="font-normal text-muted">· {estudio.nome}</span>
          </h1>
        </div>
        <Link
          href={`/painel/${slug}/agenda/novo?data=${dataSel}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
        >
          <Plus className="h-4 w-4" /> Evento
        </Link>
      </div>

      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {decodeURIComponent(error)}
        </p>
      )}

      {/* Vistas, navegação de período e filtro de instrutor, tudo numa
          única linha (quebra só se não couber) — antes eram 3 linhas
          separadas. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex shrink-0 gap-1.5 rounded-full bg-border-subtle p-1">
          {VISTAS.map((v) => (
            <Link
              key={v}
              href={`${basePath}${construirQuery({ pt: ptFiltro }, { vista: v })}`}
              className={`rounded-full px-3 py-1.5 text-center text-xs font-semibold transition-all ${
                vista === v ? 'bg-surface text-foreground shadow-pop' : 'text-muted hover:text-foreground'
              }`}
            >
              {LABEL_VISTA[v]}
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`${basePath}${construirQuery({ vista, pt: ptFiltro }, { data: anterior })}`}
            className="rounded-md border border-border-subtle px-2.5 py-1 text-sm"
          >
            ←
          </Link>
          <span className="text-sm font-semibold whitespace-nowrap text-foreground">{tituloPeriodo}</span>
          <Link
            href={`${basePath}${construirQuery({ vista, pt: ptFiltro }, { data: seguinte })}`}
            className="rounded-md border border-border-subtle px-2.5 py-1 text-sm"
          >
            →
          </Link>
        </div>

        {pts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span className="font-semibold">Instrutor:</span>
            <Link
              href={`${basePath}${construirQuery({ vista }, { pt: undefined })}`}
              className={`rounded-full border px-2.5 py-1 font-medium ${
                !ptFiltro ? 'border-brand bg-brand text-black' : 'border-border-subtle text-muted'
              }`}
            >
              Todos
            </Link>
            {pts.map((p) => (
              <Link
                key={p.id}
                href={`${basePath}${construirQuery({ vista }, { pt: p.id })}`}
                className={`rounded-full border px-2.5 py-1 font-medium ${
                  ptFiltro === p.id ? 'border-brand bg-brand text-black' : 'border-border-subtle text-muted'
                }`}
              >
                {p.nome}
              </Link>
            ))}
          </div>
        )}
      </div>

      {(vista === 'dia' || vista === 'semana') && (
        <AgendaInterativa
          slug={slug}
          estudioId={estudio.id}
          dias={vista === 'dia' ? [dataSel] : diasSemana}
          eventos={eventos}
          clientes={clientes}
          outroEstudio={outroEstudio}
          clientesOutroEstudio={clientesOutroEstudio}
          leads={leads}
          pts={pts}
        />
      )}
      {vista === 'mes' && (
        <CalendarioMes
          dias={diasMes}
          offset={offsetMes}
          eventos={eventos}
          basePath={basePath}
          hoje={hoje}
          qsExtra={qsExtra}
        />
      )}
    </div>
  )
}
