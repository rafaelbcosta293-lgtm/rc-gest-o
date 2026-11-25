import Link from '@/components/LinkRapido'
import { Barra, BarraEspaco, BarraOpcoes, BarraPeriodo, BarraSeparador } from '@/components/Barra'
import { ArrowLeft, CalendarOff, Plus } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { ehContaFixa } from '@/lib/data/acessos'
import { getEquipaDoEstudio, obterOutroEstudioEClientes } from '@/lib/data/estudios'
import { fmt, MESES, DIAS_SEMANA, diasDoMes, offsetPrimeiroDia, intervaloCurto, diaCurto } from '@/lib/data/presencas'
import { diasDaSemana, inicioDaSemana, somarDias } from '@/lib/data/horarios'
import { corTipoEvento } from '@/lib/data/agenda'
import { feriadosDoEstudio } from '@/lib/data/assiduidade'
import { carregarDiasFechados } from '@/lib/data/diasFechados'
import FecharDia from './FecharDia'
import AgendaInterativa from './AgendaInterativa'
import BuscaAgenda from './BuscaAgenda'
import BotaoAulasAgenda from './BotaoAulasAgenda'
import { COOKIE_AULAS_AGENDA, carregarAulasNaAgenda } from '@/lib/data/aulasNaAgenda'
import { cookies } from 'next/headers'
import FiltroInstrutor from './FiltroInstrutor'
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
  base: { vista?: string; pt?: string; data?: string },
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
  checkin_em?: string | null
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

  // Hora do check-in no tablet (presenças com origem "checkin") — mostrada
  // no bloco do treino, para o instrutor ver quem já chegou.
  const [{ data, error }, { data: checkins }] = await Promise.all([
    query,
    supabase
      .from('presencas')
      .select('agenda_evento_id, checkin_em')
      .eq('origem', 'checkin')
      .not('agenda_evento_id', 'is', null)
      .gte('data', inicio)
      .lt('data', fimExclusivo),
  ])
  if (error) throw new Error(error.message)
  const horaCheckin = new Map(
    ((checkins ?? []) as { agenda_evento_id: string; checkin_em: string | null }[]).map((c) => [c.agenda_evento_id, c.checkin_em])
  )
  return ((data ?? []) as unknown as EventoComNomes[]).map((e) => (horaCheckin.has(e.id) ? { ...e, checkin_em: horaCheckin.get(e.id) ?? null } : e))
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
  extras,
}: {
  estudio: Pick<Estudio, 'id' | 'slug' | 'nome'>
  searchParams: { vista?: string; data?: string; pt?: string; error?: string }
  basePath: string
  mostrarVoltar: boolean
  // Botões de quem embute a Agenda (o Início do estúdio põe aqui
  // "Relatório mensal" e "Equipa"): ficam no espaço livre da barra,
  // antes do zoom.
  extras?: React.ReactNode
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
    tituloPeriodo = diaCurto(dataSel)
  } else if (vista === 'semana') {
    inicio = inicioDaSemana(dataSel)
    diasSemana = diasDaSemana(inicio)
    fimExclusivo = somarDias(inicio, 7)
    anterior = somarDias(inicio, -7)
    seguinte = somarDias(inicio, 7)
    tituloPeriodo = intervaloCurto(diasSemana[0], diasSemana[6])
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

  // Mostrar as aulas de grupo na grelha? (botão "Aulas"; escolha guardada
  // num cookie deste browser — por omissão, mostra.)
  const verAulas = (await cookies()).get(COOKIE_AULAS_AGENDA)?.value !== '0'

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
    aulasNaAgenda,
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
    // Aulas de grupo na grelha (a sala é a mesma), salvo se escondidas.
    verAulas && vista !== 'mes'
      ? carregarAulasNaAgenda(supabase, estudio.id, slug, inicio, fimExclusivo, ptFiltro)
      : Promise.resolve([]),
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
      {/* Todos os comandos da Agenda numa só barra, com o mesmo formato
          (pedido do dono: nada de botões soltos, cada um à sua maneira).
          No computador cabe numa linha; no telemóvel a barra parte-se em
          linhas arrumadas (a ordem de cada peça está em "max-sm:order-*"):
          título + vistas · período · Aulas/instrutor/+ Evento · pesquisa
          + zoom. */}
      <Barra rotulo="Comandos da Agenda">
        <div className="flex min-w-0 shrink-0 items-center max-sm:order-1">
          {mostrarVoltar && (
            <Link href={`/painel/${slug}`} aria-label="Voltar" title="Voltar" className="barra-item barra-icone">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
          <h1 className="barra-titulo truncate">
            Agenda <span className="font-normal text-muted max-2xl:hidden">· {estudio.nome}</span>
          </h1>
        </div>

        <BarraSeparador />
        <BarraOpcoes
          className="max-sm:order-2 max-sm:ml-auto"
          opcoes={VISTAS.map((v) => ({
            href: `${basePath}${construirQuery({ pt: ptFiltro }, { vista: v })}`,
            rotulo: LABEL_VISTA[v],
            ativo: vista === v,
          }))}
        />

        <BarraSeparador />
        {/* "Hoje" volta ao período de hoje sem mudar a vista nem o filtro
            de instrutor; só se destaca quando se está a ver outro período. */}
        <BarraPeriodo
          className="max-sm:order-3 max-sm:w-full"
          anterior={`${basePath}${construirQuery({ vista, pt: ptFiltro }, { data: anterior })}`}
          seguinte={`${basePath}${construirQuery({ vista, pt: ptFiltro }, { data: seguinte })}`}
          titulo={tituloPeriodo}
          largura="17ch"
          hoje={`${basePath}${construirQuery({ vista, pt: ptFiltro }, {})}`}
          noPeriodoDeHoje={periodoTemHoje}
        />

        {(vista !== 'mes' || pts.length > 0) && <BarraSeparador />}
        {vista !== 'mes' && (
          <span className="flex max-sm:order-4">
            <BotaoAulasAgenda ativo={verAulas} />
          </span>
        )}
        {pts.length > 0 && (
          <div className="flex min-w-0 max-sm:order-5 max-sm:min-w-[9rem] max-sm:flex-1">
            <FiltroInstrutor
              valor={ptFiltro ?? ''}
              opcoes={[
                { id: '', nome: 'Todos', href: `${basePath}${construirQuery({ vista, data: dataParam }, { pt: undefined })}` },
                ...pts.map((p) => ({ id: p.id, nome: p.nome, href: `${basePath}${construirQuery({ vista, data: dataParam }, { pt: p.id })}` })),
              ]}
            />
          </div>
        )}

        <BarraEspaco className="max-sm:hidden" />
        {/* Ajuda e zoom da grelha (vêm de AgendaInterativa), pesquisa e
            "+ Evento", encostados à direita. */}
        {extras && <div className="flex items-center gap-0.5 max-sm:order-8">{extras}</div>}
        <div id="agenda-ferramentas" className="flex items-center gap-0.5 max-sm:order-8" />
        <div className="flex min-w-0 max-sm:order-7 max-sm:min-w-[7rem] max-sm:flex-1">
          <BuscaAgenda estudioId={estudio.id} basePath={basePath} />
        </div>
        {!somenteLeitura && (
          <Link href={`/painel/${slug}/agenda/novo?data=${dataSel}`} className="barra-item barra-primario max-sm:order-6">
            <Plus className="h-4 w-4" /> Evento
          </Link>
        )}
      </Barra>

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
          aulas={aulasNaAgenda}
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
