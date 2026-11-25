import JanelaClientes from '@/app/painel/[estudio]/treinos/JanelaClientes'
import { BotaoAbrirJanela } from '@/components/janela/Janela'
import Link from '@/components/LinkRapido'
import { notFound } from 'next/navigation'
import { ArrowLeft, Cake, Plus, ArrowUp, ArrowDown, TrendingUp } from 'lucide-react'
import { Barra, BarraEspaco, BarraSeparador } from '@/components/Barra'
import BarraEscolha from '@/components/BarraEscolha'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { ESTADOS_CLIENTE, ALERTAS } from '@/lib/data/constantes'
import { mesesAtivo } from '@/lib/data/clientes'
import { proximoAniversario, idadeEm } from '@/lib/data/aniversarios'
import { treinosPrevistos, intervaloMes, fmt } from '@/lib/data/presencas'
import ListaClientes, { type LinhaCliente } from './ListaClientes'
import ExportarCsvButton from '@/components/ExportarCsvButton'
import { SERVICO_PT, carregarServicos } from '@/lib/data/servicos'
import { hojeEmLisboa } from '@/lib/data/hoje'
import { CAMPOS_FICHA, camposEmFalta, ehCampoFicha, rotuloCampo, type CampoFicha } from '@/lib/data/fichaCliente'
import type { EstadoCliente, GeneroCliente } from '@/lib/supabase/database.types'

type ClienteLista = {
  id: string
  numero_socio: string | null
  nome: string
  nome_preferido: string | null
  telefone: string | null
  email: string | null
  nif: string | null
  estado: EstadoCliente
  genero: GeneroCliente | null
  alerta: string
  nascimento: string | null
  inicio_contrato: string | null
  saiu_em: string | null
  frequencia_semanal: number | null
  morada: string | null
  codigo_postal: string | null
  cidade: string | null
  objetivo: string | null
  pt_principal_id: string | null
}

type PagamentoResumo = { cliente_id: string; valido_ate: string | null; em_dia: boolean }

const FILTROS: { valor: EstadoCliente | 'Todos'; label: string }[] = [
  { valor: 'Todos', label: 'Todos' },
  { valor: 'Ativo', label: 'Ativos' },
  { valor: 'Pendente', label: 'Pendentes' },
  { valor: 'Suspenso', label: 'Suspensos' },
  { valor: 'Inativo', label: 'Inativos' },
]

type Ordem = 'nome' | 'numero' | 'inscricao'
type Direcao = 'asc' | 'desc'

const ORDENS: { valor: Ordem; label: string }[] = [
  { valor: 'nome', label: 'Nome' },
  { valor: 'numero', label: 'Nº de cliente' },
  { valor: 'inscricao', label: 'Data de inscrição' },
]

// Direção inicial ao mudar de critério (antes de a pessoa tocar na
// seta ↑/↓) — nome continua igual a hoje (A→Z); inscrição começa pelo
// mais recente, que é como a equipa normalmente quer ver isto.
const DIRECAO_POR_OMISSAO: Record<Ordem, Direcao> = {
  nome: 'asc',
  numero: 'asc',
  inscricao: 'desc',
}

function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

// numero_socio é tipo "F24201" — a parte que importa para ordenar é só
// o sequencial final (201), não o texto todo (isso puxaria F23999
// para antes de F24001, por exemplo).
function numeroSequencial(numeroSocio: string | null): number | null {
  if (!numeroSocio) return null
  const m = numeroSocio.match(/(\d+)$/)
  return m ? Number(m[1]) : null
}

function construirQuery(
  base: { estado?: string; ordem?: string; dir?: string; falta?: string; servico?: string },
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

export default async function ClientesPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ estado?: string; ordem?: string; dir?: string; falta?: string; servico?: string }>
}) {
  const { estudio: slug } = await params
  const { estado: estadoParam, ordem: ordemParam, dir: dirParam, falta: faltaParam, servico: servicoParam } = await searchParams
  // Serviço: cada um tem a sua lista de clientes (o PT é o de sempre).
  const servicoSel = Number(servicoParam) > 0 ? Number(servicoParam) : SERVICO_PT
  const ePt = servicoSel === SERVICO_PT
  // Para os links manterem o serviço escolhido.
  const servicoQs = ePt ? undefined : String(servicoSel)
  // Filtro "Dados incompletos": 'qualquer' (falta pelo menos um campo)
  // ou um campo em concreto (ex.: só quem não tem NIF).
  const falta: CampoFicha | 'qualquer' | null =
    faltaParam === 'qualquer' ? 'qualquer' : ehCampoFicha(faltaParam) ? faltaParam : null
  // Sem filtro na URL, mostra os ativos por omissão — "Todos" passa a
  // ser uma escolha explícita, como qualquer outro filtro.
  const estado = estadoParam ?? 'Ativo'
  const ordem: Ordem = ordemParam === 'numero' || ordemParam === 'inscricao' ? ordemParam : 'nome'
  const direcao: Direcao = dirParam === 'asc' || dirParam === 'desc' ? dirParam : DIRECAO_POR_OMISSAO[ordem]
  const agora = new Date()

  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) {
    notFound()
  }

  // Noutro serviço, o estado e o início vêm da inscrição nesse serviço.
  const [servicos, { data: inscricoesData }, { data: ativosPorServicoData }] = await Promise.all([
    carregarServicos(supabase, { soAtivos: true }),
    ePt
      ? Promise.resolve({ data: [] as { cliente_id: string; estado: EstadoCliente; inicio: string | null; saiu_em: string | null }[] })
      : supabase.from('clientes_servicos').select('cliente_id, estado, inicio, saiu_em').eq('servico_id', servicoSel),
    supabase.from('clientes_servicos').select('servico_id, clientes!inner(estudio_id)').eq('estado', 'Ativo').eq('clientes.estudio_id', estudio.id),
  ])
  const inscricaoPorCliente = new Map(
    ((inscricoesData ?? []) as { cliente_id: string; estado: EstadoCliente; inicio: string | null; saiu_em: string | null }[]).map((i) => [
      i.cliente_id,
      i,
    ])
  )
  const ativosPorServico = new Map<number, number>()
  for (const a of (ativosPorServicoData ?? []) as { servico_id: number }[]) {
    ativosPorServico.set(a.servico_id, (ativosPorServico.get(a.servico_id) ?? 0) + 1)
  }

  let query = supabase
    .from('clientes')
    .select(
      'id, numero_socio, nome, nome_preferido, telefone, email, nif, estado, genero, alerta, nascimento, inicio_contrato, saiu_em, frequencia_semanal, morada, codigo_postal, cidade, objetivo, pt_principal_id'
    )
    .eq('estudio_id', estudio.id)

  if (ePt) {
    query = query.eq('cliente_pt', true)
    if (estado !== 'Todos') query = query.eq('estado', estado)
  } else {
    query = query.in('id', [...inscricaoPorCliente.keys(), '00000000-0000-0000-0000-000000000000'])
  }

  const anoAtual = agora.getFullYear()
  const mesAtual = agora.getMonth() + 1
  const { inicio, fimExclusivo } = intervaloMes(anoAtual, mesAtual)

  // Todas estas só precisam do estúdio, não dos resultados umas das
  // outras — correm todas ao mesmo tempo. As presenças filtram pelo
  // estúdio do cliente (clientes!inner) em vez de por uma lista de ids,
  // precisamente para não terem de esperar pela consulta de clientes.
  const [
    { data, error },
    { data: todosData, error: erroTodos },
    { data: pagamentosData, error: erroPagamentos },
    { data: presencasData, error: erroPresencas },
  ] = await Promise.all([
    query,
    ePt
      ? supabase.from('clientes').select('estado').eq('estudio_id', estudio.id).eq('cliente_pt', true).eq('teste', false)
      : Promise.resolve({ data: [...inscricaoPorCliente.values()].map((i) => ({ estado: i.estado })), error: null }),
    ePt
      ? supabase.from('v_estado_pagamento').select('cliente_id, valido_ate, em_dia').eq('estudio_id', estudio.id)
      : supabase
          .from('v_validade_por_servico')
          .select('cliente_id, validade_maxima')
          .eq('servico_id', servicoSel)
          .then(({ data, error }) => ({
            data: (data ?? []).map((v) => ({
              cliente_id: v.cliente_id as string,
              valido_ate: v.validade_maxima as string,
              em_dia: (v.validade_maxima as string) >= hojeEmLisboa(),
            })),
            error,
          })),
    supabase
      .from('presencas')
      .select('cliente_id, clientes!inner(estudio_id)')
      .eq('clientes.estudio_id', estudio.id)
      .eq('estado', 'Presente')
      .gte('data', inicio)
      .lt('data', fimExclusivo),
  ])
  if (error || erroTodos || erroPagamentos || erroPresencas) {
    throw new Error((error ?? erroTodos ?? erroPagamentos ?? erroPresencas)!.message)
  }
  const doEstado = ((data ?? []) as ClienteLista[])
    .map((c) => {
      const i = inscricaoPorCliente.get(c.id)
      return ePt || !i ? c : { ...c, estado: i.estado, inicio_contrato: i.inicio, saiu_em: i.saiu_em }
    })
    .filter((c) => ePt || estado === 'Todos' || c.estado === estado)
  // Campos em falta de cada cliente (do filtro de estado escolhido) e
  // quantos clientes têm cada um em falta — os números dos botões.
  const emFaltaPorCliente = new Map(doEstado.map((c) => [c.id, camposEmFalta(c)]))
  const incompletos = doEstado.filter((c) => emFaltaPorCliente.get(c.id)!.length > 0).length
  const contagemFalta = new Map<CampoFicha, number>()
  for (const lista of emFaltaPorCliente.values()) for (const k of lista) contagemFalta.set(k, (contagemFalta.get(k) ?? 0) + 1)
  const clientes =
    falta === null
      ? doEstado
      : doEstado.filter((c) => {
          const lista = emFaltaPorCliente.get(c.id)!
          return falta === 'qualquer' ? lista.length > 0 : lista.includes(falta)
        })

  // Ordenado aqui (não no Supabase) porque o critério "Nº de cliente"
  // precisa de extrair a parte numérica do numero_socio — não dá para
  // pedir isso ao Postgrest diretamente. Sem nunca mexer na ordem
  // interna de quem não tem o campo preenchido: fica sempre no fim,
  // seja qual for a direção escolhida.
  const clientesOrdenados = [...clientes].sort((a, b) => {
    let comparacao = 0
    if (ordem === 'numero') {
      const na = numeroSequencial(a.numero_socio)
      const nb = numeroSequencial(b.numero_socio)
      if (na === null && nb === null) return 0
      if (na === null) return 1
      if (nb === null) return -1
      comparacao = na - nb
    } else if (ordem === 'inscricao') {
      if (!a.inicio_contrato && !b.inicio_contrato) return 0
      if (!a.inicio_contrato) return 1
      if (!b.inicio_contrato) return -1
      comparacao = a.inicio_contrato.localeCompare(b.inicio_contrato)
    } else {
      comparacao = normalizarNome(a.nome).localeCompare(normalizarNome(b.nome))
    }
    return direcao === 'desc' ? -comparacao : comparacao
  })

  const todos = (todosData ?? []) as { estado: EstadoCliente }[]
  // Ativos de PT (número no separador do PT) — só se sabe aqui quando a
  // lista é a do PT; noutro separador conta-se à parte.
  const contagemPtAtivos = ePt
    ? todos.filter((c) => c.estado === 'Ativo').length
    : (
        await supabase
          .from('clientes')
          .select('id', { count: 'exact', head: true })
          .eq('estudio_id', estudio.id)
          .eq('cliente_pt', true)
          .eq('teste', false)
          .eq('estado', 'Ativo')
      ).count ?? 0
  const contagens: Record<EstadoCliente | 'Todos', number> = {
    Todos: todos.length,
    Ativo: todos.filter((c) => c.estado === 'Ativo').length,
    Pendente: todos.filter((c) => c.estado === 'Pendente').length,
    Suspenso: todos.filter((c) => c.estado === 'Suspenso').length,
    Inativo: todos.filter((c) => c.estado === 'Inativo').length,
  }
  const pagamentoPorCliente = new Map(
    ((pagamentosData ?? []) as PagamentoResumo[]).map((p) => [p.cliente_id, p])
  )

  const feitosPorCliente = new Map<string, number>()
  for (const p of presencasData ?? []) {
    feitosPorCliente.set(p.cliente_id, (feitosPorCliente.get(p.cliente_id) ?? 0) + 1)
  }

  const linhas: LinhaCliente[] = clientesOrdenados.map((c) => {
    const est = ESTADOS_CLIENTE[c.estado] ?? ESTADOS_CLIENTE.Ativo
    const a = ALERTAS[c.alerta as keyof typeof ALERTAS] ?? ALERTAS.Nenhum
    const meses = mesesAtivo(c.inicio_contrato, c.saiu_em)
    const aniversario = c.nascimento ? proximoAniversario(c.nascimento, agora) : null
    const pagamento = pagamentoPorCliente.get(c.id)
    const feitos = feitosPorCliente.get(c.id) ?? 0
    const alvo = treinosPrevistos(c.frequencia_semanal, anoAtual, mesAtual)?.arredondado

    return {
      id: c.id,
      numeroSocio: c.numero_socio,
      nome: c.nome,
      nomePreferido: c.nome_preferido,
      telefone: c.telefone,
      email: c.email,
      nif: c.nif,
      nascimento: c.nascimento,
      frequenciaSemanal: c.frequencia_semanal,
      estado: c.estado,
      genero: c.genero,
      estadoLabel: est.label,
      estadoBg: est.bg,
      estadoTx: est.tx,
      alertaDot: a.dot,
      inscricaoLabel: c.inicio_contrato
        ? `desde ${fmt(c.inicio_contrato)}${meses !== null ? ` · ${meses} ${meses === 1 ? 'mês' : 'meses'}` : ''}`
        : 'sem data de início',
      idadeLabel: c.nascimento ? `${idadeEm(c.nascimento, agora)} anos` : null,
      pagamentoLabel: pagamento
        ? pagamento.valido_ate
          ? `pag. até ${fmt(pagamento.valido_ate)}`
          : 'sem pagamentos'
        : 'sem pagamentos',
      pagamentoEmDia: pagamento ? pagamento.em_dia : null,
      treinosLabel: alvo != null ? `${feitos} de ${alvo} treinos` : `${feitos} treinos`,
      emFalta: (emFaltaPorCliente.get(c.id) ?? []).map(rotuloCampo),
      emFaltaTexto: (emFaltaPorCliente.get(c.id) ?? []).map(rotuloCampo).join(', '),
      aniversarioLabel: aniversario
        ? aniversario.dias === 0
          ? '🎂 faz anos hoje'
          : aniversario.dias <= 30
            ? `🎂 em ${aniversario.dias}d`
            : `🎂 ${aniversario.data.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}`
        : null,
    }
  })

  return (
    <JanelaClientes slug={slug}>
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Clientes</h1>
          <p className="mt-1 text-sm text-muted">
            {estudio.nome} · {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'} ·
            a ficha completa de cada um, num só sítio
          </p>
        </div>
        <Barra rotulo="Ações" className="max-sm:w-full max-sm:justify-between">
          <ExportarCsvButton
            className="barra-item max-sm:hidden"
            colunas={[
              { chave: 'numeroSocio', label: 'Nº de cliente' },
              { chave: 'nome', label: 'Nome' },
              { chave: 'telefone', label: 'Telefone' },
              { chave: 'estadoLabel', label: 'Estado' },
              { chave: 'inscricaoLabel', label: 'Inscrição' },
              { chave: 'idadeLabel', label: 'Idade' },
              { chave: 'pagamentoLabel', label: 'Pagamento' },
              { chave: 'treinosLabel', label: 'Treinos' },
              { chave: 'email', label: 'Email' },
              { chave: 'nif', label: 'NIF' },
              { chave: 'emFaltaTexto', label: 'Dados em falta na ficha' },
            ]}
            linhas={linhas}
            nomeFicheiro={`clientes-${slug}`}
          />
          <Link href={`/painel/${slug}/clientes/retencao`} className="barra-item">
            <TrendingUp className="h-4 w-4" /> Retenção
          </Link>
          <Link href={`/painel/${slug}/clientes/aniversarios`} className="barra-item">
            <Cake className="h-4 w-4" /> Aniversários
          </Link>
          <BotaoAbrirJanela className="barra-item barra-primario">
            <Plus className="h-4 w-4" /> Cliente
          </BotaoAbrirJanela>
        </Barra>
      </div>

      {/* A pesquisa (dentro de ListaClientes) e todos os filtros ficam
          numa só barra: por cima os serviços (cada um tem a sua lista e
          os seus números), por baixo o estado, a ordem e os dados em
          falta na ficha — estes dois em menu, para caber numa linha. */}
      <ListaClientes
        linhas={linhas}
        slug={slug}
        mostrarEmFalta={falta !== null}
        linhaDeCima={
          servicos.length > 1 ? (
            <div className="barra-linha desliza">
              {servicos.map((sv) => {
                const n = sv.id === SERVICO_PT ? contagemPtAtivos : ativosPorServico.get(sv.id) ?? 0
                return (
                  <Link
                    key={sv.id}
                    href={`/painel/${slug}/clientes${construirQuery({ ordem: ordemParam, dir: dirParam }, { servico: sv.id === SERVICO_PT ? undefined : String(sv.id) })}`}
                    aria-current={sv.id === servicoSel ? 'page' : undefined}
                    className="barra-item"
                  >
                    {sv.nome} <span className="font-normal text-muted">{n}</span>
                  </Link>
                )
              })}
            </div>
          ) : null
        }
        filtros={
          <>
            <BarraSeparador />
            <div className="flex min-w-0 items-center gap-0.5 max-sm:order-3 max-sm:w-full max-sm:overflow-x-auto max-sm:[scrollbar-width:none]">
              {FILTROS.map((f) => (
                <Link
                  key={f.valor}
                  href={`/painel/${slug}/clientes${construirQuery(
                    { ordem: ordemParam, dir: dirParam, falta: faltaParam, servico: servicoQs },
                    { estado: f.valor }
                  )}`}
                  aria-current={estado === f.valor ? 'page' : undefined}
                  className="barra-item"
                >
                  {f.label} <span className="font-normal text-muted">{contagens[f.valor]}</span>
                </Link>
              ))}
            </div>
            <BarraEspaco className="max-sm:hidden" />
            <BarraEscolha
              rotulo="Ordenar por"
              valor={ordem}
              className="max-sm:order-4 max-sm:min-w-0 max-sm:flex-1 sm:w-44"
              opcoes={ORDENS.map((o) => ({
                id: o.valor,
                nome: `Por ${o.label.toLowerCase()}`,
                href: `/painel/${slug}/clientes${construirQuery(
                  { estado, falta: faltaParam, servico: servicoQs },
                  { ordem: o.valor === 'nome' ? undefined : o.valor, dir: ordem === o.valor ? direcao : undefined }
                )}`,
              }))}
            />
            <Link
              href={`/painel/${slug}/clientes${construirQuery(
                { estado, ordem: ordemParam, falta: faltaParam, servico: servicoQs },
                { dir: direcao === 'asc' ? 'desc' : 'asc' }
              )}`}
              className="barra-item barra-icone max-sm:order-4"
              aria-label={direcao === 'asc' ? 'Ordem crescente — trocar para decrescente' : 'Ordem decrescente — trocar para crescente'}
              title={direcao === 'asc' ? 'Ordem crescente — trocar para decrescente' : 'Ordem decrescente — trocar para crescente'}
            >
              {direcao === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            </Link>
            {/* Dados incompletos na ficha: todos os que têm algo em falta,
                ou só os que não têm um campo em concreto. Junta-se ao
                filtro de estado (ex.: ativos sem NIF). */}
            <BarraEscolha
              rotulo="Dados em falta na ficha"
              valor={falta ?? ''}
              realce={falta !== null}
              className="max-sm:order-4 max-sm:min-w-0 max-sm:flex-1 sm:w-44"
              opcoes={(
                [
                  { valor: undefined, label: 'Ficha: todas' },
                  { valor: 'qualquer', label: `Dados incompletos (${incompletos})` },
                  ...CAMPOS_FICHA.filter((c) => (contagemFalta.get(c.campo) ?? 0) > 0 || falta === c.campo).map((c) => ({
                    valor: c.campo,
                    label: `Sem ${c.rotulo === 'NIF' ? 'NIF' : c.rotulo.toLowerCase()} (${contagemFalta.get(c.campo) ?? 0})`,
                  })),
                ] as { valor: string | undefined; label: string }[]
              ).map((f) => ({
                id: f.valor ?? '',
                nome: f.label,
                href: `/painel/${slug}/clientes${construirQuery({ estado, ordem: ordemParam, dir: dirParam, servico: servicoQs }, { falta: f.valor })}`,
              }))}
            />
          </>
        }
      />
    </div>
    </JanelaClientes>
  )
}
