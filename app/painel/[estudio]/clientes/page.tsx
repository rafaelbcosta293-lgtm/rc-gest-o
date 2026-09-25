import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { ESTADOS_CLIENTE, ALERTAS } from '@/lib/data/constantes'
import { mesesAtivo } from '@/lib/data/clientes'
import { proximoAniversario } from '@/lib/data/aniversarios'
import { treinosPrevistos, intervaloMes, fmt } from '@/lib/data/presencas'
import type { EstadoCliente } from '@/lib/supabase/database.types'

type ClienteLista = {
  id: string
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

export default async function ClientesPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ q?: string; estado?: string }>
}) {
  const { estudio: slug } = await params
  const { q, estado } = await searchParams
  const agora = new Date()

  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) {
    notFound()
  }

  let query = supabase
    .from('clientes')
    .select('id, nome, telefone, estado, alerta, nascimento, inicio_contrato, saiu_em, frequencia_semanal')
    .eq('estudio_id', estudio.id)
    .order('nome')

  if (estado && estado !== 'Todos') {
    query = query.eq('estado', estado)
  }
  if (q) {
    query = query.ilike('nome', `%${q}%`)
  }

  const [
    { data, error },
    { data: todosData, error: erroTodos },
    { data: pagamentosData, error: erroPagamentos },
  ] = await Promise.all([
    query,
    supabase.from('clientes').select('estado').eq('estudio_id', estudio.id),
    supabase.from('v_estado_pagamento').select('cliente_id, valido_ate, em_dia').eq('estudio_id', estudio.id),
  ])
  if (error || erroTodos || erroPagamentos) {
    throw new Error((error ?? erroTodos ?? erroPagamentos)!.message)
  }
  const clientes = (data ?? []) as ClienteLista[]
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

  const anoAtual = agora.getFullYear()
  const mesAtual = agora.getMonth() + 1
  const { inicio, fimExclusivo } = intervaloMes(anoAtual, mesAtual)
  const idsClientes = clientes.map((c) => c.id)
  const { data: presencasData, error: erroPresencas } = idsClientes.length
    ? await supabase
        .from('presencas')
        .select('cliente_id')
        .in('cliente_id', idsClientes)
        .eq('estado', 'Presente')
        .gte('data', inicio)
        .lt('data', fimExclusivo)
    : { data: [], error: null }
  if (erroPresencas) {
    throw new Error(erroPresencas.message)
  }
  const feitosPorCliente = new Map<string, number>()
  for (const p of presencasData ?? []) {
    feitosPorCliente.set(p.cliente_id, (feitosPorCliente.get(p.cliente_id) ?? 0) + 1)
  }

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
          const ativo = (estado ?? 'Todos') === f.valor
          const params = new URLSearchParams()
          if (f.valor !== 'Todos') params.set('estado', f.valor)
          if (q) params.set('q', q)
          const qs = params.toString()
          return (
            <Link
              key={f.valor}
              href={`/painel/${slug}/clientes${qs ? `?${qs}` : ''}`}
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

      <form method="get" className="mt-4">
        {estado && <input type="hidden" name="estado" value={estado} />}
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Procurar cliente…"
          className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900"
        />
      </form>

      <div className="mt-4 flex flex-col overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
        {clientes.map((c, i) => {
          const est = ESTADOS_CLIENTE[c.estado] ?? ESTADOS_CLIENTE.Ativo
          const a = ALERTAS[c.alerta as keyof typeof ALERTAS] ?? ALERTAS.Nenhum
          const meses = mesesAtivo(c.inicio_contrato, c.saiu_em)
          const aniversario = c.nascimento ? proximoAniversario(c.nascimento, agora) : null
          const pagamento = pagamentoPorCliente.get(c.id)
          const feitos = feitosPorCliente.get(c.id) ?? 0
          const alvo = treinosPrevistos(c.frequencia_semanal, anoAtual, mesAtual)?.arredondado

          return (
            <Link
              key={c.id}
              href={`/painel/${slug}/clientes/${c.id}`}
              className={`flex flex-col gap-1.5 bg-white px-4 py-3 text-sm transition-colors hover:bg-black/[.02] dark:bg-zinc-950 dark:hover:bg-white/[.05] ${
                i > 0 ? 'border-t border-black/10 dark:border-white/10' : ''
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="flex min-w-[160px] flex-1 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: a.dot }} />
                  <span className="truncate font-medium text-black dark:text-zinc-50">{c.nome}</span>
                </span>
                <span
                  className="w-24 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-medium"
                  style={{ background: est.bg, color: est.tx }}
                >
                  {est.label}
                </span>
                <span className="w-32 shrink-0 text-xs text-zinc-500">
                  {c.telefone ?? 'sem contacto'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                <span className="w-36 shrink-0">
                  {meses !== null ? `${meses} ${meses === 1 ? 'mês' : 'meses'} de contrato` : 'sem data de início'}
                </span>
                <span className="w-36 shrink-0">
                  {pagamento ? (
                    <span className={pagamento.em_dia ? 'text-teal-700 dark:text-teal-400' : 'text-red-600'}>
                      {pagamento.valido_ate ? `pag. até ${fmt(pagamento.valido_ate)}` : 'sem pagamentos'}
                    </span>
                  ) : (
                    'sem pagamentos'
                  )}
                </span>
                <span className="w-32 shrink-0">
                  {alvo != null ? `${feitos} de ${alvo} treinos` : `${feitos} treinos`}
                </span>
                <span className="w-40 shrink-0">
                  {aniversario &&
                    (aniversario.dias === 0
                      ? '🎂 faz anos hoje'
                      : aniversario.dias <= 30
                        ? `🎂 em ${aniversario.dias}d`
                        : `🎂 ${aniversario.data.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}`)}
                </span>
              </div>
            </Link>
          )
        })}
      </div>

      {clientes.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-black/10 p-8 text-center text-sm text-zinc-500 dark:border-white/10">
          {q ? 'Nenhum cliente com esse nome.' : 'Ainda não há clientes com este filtro.'}
        </div>
      )}
    </div>
  )
}
