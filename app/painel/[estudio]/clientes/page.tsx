import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { ESTADOS_CLIENTE, ALERTAS } from '@/lib/data/constantes'
import { mesesAtivo } from '@/lib/data/clientes'
import { proximoAniversario } from '@/lib/data/aniversarios'
import { treinosPrevistos, intervaloMes, fmt } from '@/lib/data/presencas'
import ListaClientes, { type LinhaCliente } from './ListaClientes'
import type { EstadoCliente } from '@/lib/supabase/database.types'

type ClienteLista = {
  id: string
  numero_socio: string | null
  nome: string
  telefone: string | null
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
      'id, numero_socio, nome, telefone, estado, alerta, nascimento, inicio_contrato, saiu_em, frequencia_semanal'
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
      estadoLabel: est.label,
      estadoBg: est.bg,
      estadoTx: est.tx,
      alertaDot: a.dot,
      inscricaoLabel: c.inicio_contrato
        ? `desde ${fmt(c.inicio_contrato)}${meses !== null ? ` · ${meses} ${meses === 1 ? 'mês' : 'meses'}` : ''}`
        : 'sem data de início',
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
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← Voltar
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Clientes</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {estudio.nome} · {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'} ·
            a ficha completa de cada um, num só sítio
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/painel/${slug}/clientes/aniversarios`}
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
          >
            🎂 Aniversários
          </Link>
          <Link
            href={`/painel/${slug}/treinos/novo`}
            className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-brand-strong"
          >
            + Cliente
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-1.5">
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
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                ativo
                  ? 'border-brand bg-brand text-black'
                  : 'border-black/10 text-zinc-600 dark:border-white/10 dark:text-zinc-400'
              }`}
            >
              {f.label} ({contagens[f.valor]})
            </Link>
          )
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
        <span className="font-medium">Ordenar por:</span>
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
              className={`rounded-full border px-3 py-1.5 font-medium ${
                ativo
                  ? 'border-brand bg-brand text-black'
                  : 'border-black/10 text-zinc-600 dark:border-white/10 dark:text-zinc-400'
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
          className="rounded-full border border-black/10 px-3 py-1.5 font-medium text-zinc-600 dark:border-white/10 dark:text-zinc-400"
          title={direcao === 'asc' ? 'Ordem crescente — trocar para decrescente' : 'Ordem decrescente — trocar para crescente'}
        >
          {direcao === 'asc' ? '↑' : '↓'}
        </Link>
      </div>

      <ListaClientes linhas={linhas} slug={slug} />
    </div>
  )
}
