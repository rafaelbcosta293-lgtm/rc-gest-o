import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Cake, Plus, ArrowUp, ArrowDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { ESTADOS_CLIENTE, ALERTAS } from '@/lib/data/constantes'
import { mesesAtivo } from '@/lib/data/clientes'
import { proximoAniversario, idadeEm } from '@/lib/data/aniversarios'
import { treinosPrevistos, intervaloMes, fmt } from '@/lib/data/presencas'
import ListaClientes, { type LinhaCliente } from './ListaClientes'
import ExportarCsvButton from '@/components/ExportarCsvButton'
import type { EstadoCliente } from '@/lib/supabase/database.types'

type ClienteLista = {
  id: string
  numero_socio: string | null
  nome: string
  telefone: string | null
  email: string | null
  estado: EstadoCliente
  alerta: string
  nascimento: string | null
  inicio_contrato: string | null
  saiu_em: string | null
  frequencia_semanal: number | null
}

type PagamentoResumo = { cliente_id: string; valido_ate: string | null; em_dia: boolean }

const FILTROS: { valor: EstadoCliente | 'Todos'; label: string }[] = [
  { valor: 'Todos', label: 'Todos' },
  { valor: 'Ativo', label: 'Ativos' },
  { valor: 'Suspenso', label: 'Suspensos' },
  { valor: 'Ex-cliente', label: 'Inativos' },
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
  base: { estado?: string; ordem?: string; dir?: string },
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
  searchParams: Promise<{ estado?: string; ordem?: string; dir?: string }>
}) {
  const { estudio: slug } = await params
  const { estado: estadoParam, ordem: ordemParam, dir: dirParam } = await searchParams
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

  let query = supabase
    .from('clientes')
    .select(
      'id, numero_socio, nome, telefone, email, estado, alerta, nascimento, inicio_contrato, saiu_em, frequencia_semanal'
    )
    .eq('estudio_id', estudio.id)

  if (estado !== 'Todos') {
    query = query.eq('estado', estado)
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
    supabase.from('clientes').select('estado').eq('estudio_id', estudio.id),
    supabase.from('v_estado_pagamento').select('cliente_id, valido_ate, em_dia').eq('estudio_id', estudio.id),
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
  const clientes = (data ?? []) as ClienteLista[]

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
  const contagens: Record<EstadoCliente | 'Todos', number> = {
    Todos: todos.length,
    Ativo: todos.filter((c) => c.estado === 'Ativo').length,
    Suspenso: todos.filter((c) => c.estado === 'Suspenso').length,
    'Ex-cliente': todos.filter((c) => c.estado === 'Ex-cliente').length,
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
      telefone: c.telefone,
      email: c.email,
      nascimento: c.nascimento,
      frequenciaSemanal: c.frequencia_semanal,
      estado: c.estado,
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
        <div className="flex items-center gap-2">
          <ExportarCsvButton
            colunas={[
              { chave: 'numeroSocio', label: 'Nº de cliente' },
              { chave: 'nome', label: 'Nome' },
              { chave: 'telefone', label: 'Telefone' },
              { chave: 'estadoLabel', label: 'Estado' },
              { chave: 'inscricaoLabel', label: 'Inscrição' },
              { chave: 'idadeLabel', label: 'Idade' },
              { chave: 'pagamentoLabel', label: 'Pagamento' },
              { chave: 'treinosLabel', label: 'Treinos' },
            ]}
            linhas={linhas}
            nomeFicheiro={`clientes-${slug}`}
          />
          <Link
            href={`/painel/${slug}/clientes/retencao`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-4 py-2 text-sm font-semibold shadow-pop transition-colors hover:border-border-strong hover:bg-brand/[.06]"
          >
            Retenção
          </Link>
          <Link
            href={`/painel/${slug}/clientes/aniversarios`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-4 py-2 text-sm font-semibold shadow-pop transition-colors hover:border-border-strong hover:bg-brand/[.06]"
          >
            <Cake className="h-4 w-4" /> Aniversários
          </Link>
          <Link
            href={`/painel/${slug}/treinos/novo`}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
          >
            <Plus className="h-4 w-4" /> Cliente
          </Link>
        </div>
      </div>

      {/* Controlo segmentado, ao estilo iOS — uma só faixa, com o filtro
          ativo a "flutuar" lá dentro, em vez de pílulas soltas. */}
      <div className="mt-6 flex flex-wrap gap-1.5 rounded-full bg-border-subtle p-1">
        {FILTROS.map((f) => {
          const ativo = estado === f.valor
          const href = `/painel/${slug}/clientes${construirQuery(
            { ordem: ordemParam, dir: dirParam },
            { estado: f.valor }
          )}`
          return (
            <Link
              key={f.valor}
              href={href}
              className={`flex-1 rounded-full px-3 py-1.5 text-center text-xs font-semibold transition-all ${
                ativo ? 'bg-surface text-foreground shadow-pop' : 'text-muted hover:text-foreground'
              }`}
            >
              {f.label} ({contagens[f.valor]})
            </Link>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <span className="font-semibold">Ordenar por:</span>
        {ORDENS.map((o) => {
          const ativo = ordem === o.valor
          const href = `/painel/${slug}/clientes${construirQuery(
            { estado },
            { ordem: o.valor === 'nome' ? undefined : o.valor, dir: ativo ? direcao : undefined }
          )}`
          return (
            <Link
              key={o.valor}
              href={href}
              className={`rounded-full border px-3 py-1.5 font-semibold transition-colors ${
                ativo
                  ? 'border-brand bg-brand text-black'
                  : 'border-border-subtle text-muted hover:border-border-strong'
              }`}
            >
              {o.label}
            </Link>
          )
        })}
        <Link
          href={`/painel/${slug}/clientes${construirQuery(
            { estado, ordem: ordemParam },
            { dir: direcao === 'asc' ? 'desc' : 'asc' }
          )}`}
          className="flex items-center rounded-full border border-border-subtle px-2.5 py-1.5 font-semibold text-muted transition-colors hover:border-border-strong"
          title={direcao === 'asc' ? 'Ordem crescente — trocar para decrescente' : 'Ordem decrescente — trocar para crescente'}
        >
          {direcao === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
        </Link>
      </div>

      <ListaClientes linhas={linhas} slug={slug} />
    </div>
  )
}
