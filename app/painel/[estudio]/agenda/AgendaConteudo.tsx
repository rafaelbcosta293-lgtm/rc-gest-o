import Link from '@/components/LinkRapido'
import { ArrowLeft, CalendarOff, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { ehContaFixa } from '@/lib/data/acessos'
import { getEquipaDoEstudio, obterOutroEstudioEClientes } from '@/lib/data/estudios'
import { fmt, MESES, DIAS_SEMANA, diasDoMes, offsetPrimeiroDia } from '@/lib/data/presencas'
import { diasDaSemana, inicioDaSemana, somarDias } from '@/lib/data/horarios'
import { corTipoEvento } from '@/lib/data/agenda'
import { feriadosDoEstudio } from '@/lib/data/assiduidade'
import { carregarDiasFechados } from '@/lib/data/diasFechados'
import FecharDia from './FecharDia'
import AgendaInterativa from './AgendaInterativa'
import BuscaAgenda from './BuscaAgenda'
import type { LeadOpcao } from '@/components/CamposSessaoExperimental'
import type { EventoAgenda, Estudio } from '@/lib/supabase/database.types'
import { hojeEmLisboa } from '@/lib/data/hoje'

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
  cliente: {
    id: string
    nome: string
    nome_preferido: string | null
    estudio_id: number
    numero_socio: string | null
    estado: string
    alerta: string
  } | null
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
    .select(
      '*, cliente:clientes(id, nome, nome_preferido, estudio_id, numero_socio, estado, alerta), pt:perfis!pt_id(id, nome)'
    )
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
  diasFechados,
}: {
  dias: string[]
  offset: number
  eventos: EventoComNomes[]
  basePath: string
  hoje: string
  qsExtra: string
  diasFechados: Record<string, string>
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
              title={diasFechados[dia] ? `Estúdio fechado — ${diasFechados[dia]}` : undefined}
              className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg hover:bg-brand/[.06] ${
                dia === hoje ? 'ring-2 ring-brand ring-offset-1' : ''
              } ${diasFechados[dia] ? 'bg-amber-100/70 dark:bg-amber-950/60' : ''}`}
            >
              <span className="text-[10px] text-muted">{numero}</span>
              {diasFechados[dia] && <span className="text-[9px] font-bold text-amber-800 dark:text-amber-300">Fechado</span>}
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
  const hoje = hojeEmLisboa()
  const dataSel = dataParam ?? hoje

  const supabase = await createClient()

  // O período (inicio/fimExclusivo) só depende de vista/dataSel, já
  // conhecidos — calcula-se já aqui para buscarEventos poder correr na
  // mesma leva que o resto, em vez de ser um 5º pedido só depois deles.
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

  // O período que se está a ver inclui o dia de hoje?
  const periodoTemHoje = hoje >= inicio && hoje < fimExclusivo

  const [
    pts,
    { data: clientesData, error: erroClientes },
    { data: leadsData, error: erroLeads },
    { outroEstudio, clientesOutroEstudio },
    eventos,
    sessao,
    diasFechados,
  ] = await Promise.all([
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
    buscarEventos(supabase, estudio.id, inicio, fimExclusivo, ptFiltro),
    getSessaoAtual(),
    carregarDiasFechados(supabase, estudio.id, inicio, fimExclusivo),
  ])
  // Conta pessoal (fora das 4 contas fixas do negócio — ver ehContaFixa)
  // só pode VER a Agenda: sem botão de criar, sem arrastar para criar/
  // mover/redimensionar (ver AgendaInterativa.tsx) — a escrita já fica
  // bloqueada nas próprias ações (actions.ts), isto é só para a UI
  // deixar de sugerir algo que ia ser recusado.
  const somenteLeitura = !ehContaFixa(sessao.email) && !sessao.agendaEscrita
  if (erroClientes) {
    throw new Error(erroClientes.message)
  }
  if (erroLeads) {
    throw new Error(erroLeads.message)
  }
  const clientes = (clientesData ?? []) as { id: string; nome: string }[]
  const leads = (leadsData ?? []) as LeadOpcao[]
  const qsExtra = ptFiltro ? `&pt=${ptFiltro}` : ''
  // Feriados do estúdio (nacionais + o municipal de cada concelho) e os
  // dias que a gestão fechou no período — um dia fechado que não seja
  // feriado também aparece, para se poder reabrir.
  const anos = [...new Set([Number(inicio.slice(0, 4)), Number(fimExclusivo.slice(0, 4))])]
  const feriados = anos
    .flatMap((a) => feriadosDoEstudio(slug, a))
    .filter((f) => f.data >= inicio && f.data < fimExclusivo)
  const nomesFeriado = new Map(feriados.map((f) => [f.data, f.nome]))
  const diasAvisados = [...new Set([...feriados.map((f) => f.data), ...Object.keys(diasFechados)])].sort()
  const podeFechar = !somenteLeitura && papeisDaSessao(sessao).ehGestao
  // Treinos ainda marcados num dia fechado — ficam como estão; avisa-se.
  const marcadosNoDia = (data: string) => eventos.filter((e) => e.data === data && e.estado !== 'Cancelado').length

  return (
    <div>
      {/* Cabeçalho todo numa única linha (quebra só se não couber) —
          voltar, título, vistas, navegação de período, filtro de
          instrutor e o botão de criar, lado a lado, para a grelha da
          agenda começar o mais perto possível do topo (pedido do
          dono, repetido — cada vez mais compacto). */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          {mostrarVoltar && (
            <Link
              href={`/painel/${slug}`}
              className="inline-flex shrink-0 items-center gap-1 text-sm text-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          )}
          <h1 className="truncate text-base font-bold tracking-tight text-foreground">
            Agenda <span className="font-normal text-muted">· {estudio.nome}</span>
          </h1>
        </div>

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
            className="rounded-full border border-border-strong px-2 py-1 text-sm font-semibold text-foreground hover:bg-brand/[.08]"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-semibold whitespace-nowrap text-foreground">{tituloPeriodo}</span>
          <Link
            href={`${basePath}${construirQuery({ vista, pt: ptFiltro }, { data: seguinte })}`}
            className="rounded-full border border-border-strong px-2 py-1 text-sm font-semibold text-foreground hover:bg-brand/[.08]"
            aria-label="Seguinte"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
          {/* Volta ao período de hoje sem mudar a vista (semana continua
              semana) nem o filtro de instrutor. Fica em destaque quando se
              está a ver outro período. */}
          <Link
            href={`${basePath}${construirQuery({ vista, pt: ptFiltro }, {})}`}
            aria-current={periodoTemHoje ? 'date' : undefined}
            title={periodoTemHoje ? 'Já estás no período de hoje' : 'Voltar a hoje'}
            className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
              periodoTemHoje ? 'border border-border-subtle text-muted hover:bg-brand/[.08]' : 'bg-brand text-black hover:bg-brand-strong'
            }`}
          >
            Hoje
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

        {/* Na mesma linha da data e dos instrutores: ajuda e zoom da
            grelha (vêm de AgendaInterativa), pesquisa e "+ Evento". */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div id="agenda-ferramentas" className="flex items-center gap-1.5" />
          <BuscaAgenda estudioId={estudio.id} basePath={basePath} />
          {!somenteLeitura && (
            <Link
              href={`/painel/${slug}/agenda/novo?data=${dataSel}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
            >
              <Plus className="h-3.5 w-3.5" /> Evento
            </Link>
          )}
        </div>
      </div>

      {diasAvisados.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-amber-700 dark:text-amber-400">
          {diasAvisados.map((data) => {
            const nome = nomesFeriado.get(data)
            const fechado = data in diasFechados
            const marcados = fechado ? marcadosNoDia(data) : 0
            return (
              <span key={data} className="inline-flex flex-wrap items-center gap-1.5">
                <CalendarOff className="h-3 w-3 shrink-0" />
                <span>
                  {nome ? 'Feriado' : 'Dia fechado'}
                  {vista !== 'dia' ? ` · ${fmt(data)}` : ''}: {nome ?? diasFechados[data]}
                  {fechado && <strong> · Estúdio fechado</strong>}
                </span>
                {podeFechar && (
                  <FecharDia
                    estudioSlug={slug}
                    estudioId={estudio.id}
                    data={data}
                    motivo={nome ?? diasFechados[data] ?? 'Estúdio fechado'}
                    fechado={fechado}
                  />
                )}
                {marcados > 0 && (
                  <span className="font-semibold text-red-700 dark:text-red-300">
                    {marcados === 1 ? 'Ainda há 1 treino marcado' : `Ainda há ${marcados} treinos marcados`} neste dia — desmarca-os se for
                    preciso.
                  </span>
                )}
              </span>
            )
          })}
        </div>
      )}

      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {decodeURIComponent(error)}
        </p>
      )}

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
          somenteLeitura={somenteLeitura}
          diasFechados={diasFechados}
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
          diasFechados={diasFechados}
        />
      )}
    </div>
  )
}
