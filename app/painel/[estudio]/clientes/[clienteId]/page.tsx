import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { ESTADOS_CLIENTE, ALERTAS } from '@/lib/data/constantes'
import { mesesAtivo } from '@/lib/data/clientes'
import { proximoAniversario, idadeEm, fmtDiaMes } from '@/lib/data/aniversarios'
import { fmt, intervaloMes, MESES } from '@/lib/data/presencas'
import type { Cliente, EstadoPagamento } from '@/lib/supabase/database.types'

type ClienteCompleto = Cliente & { pt_principal: { nome: string } | null }
type AvaliacaoResumo = {
  id: string
  data: string
  peso_kg: number | null
  massa_gorda_pct: number | null
  imc: number | null
  proxima_reavaliacao: string | null
}
type SessaoResumo = {
  id: string
  data: string
  foco: string | null
  nota_proxima: string
  pt: { nome: string } | null
}

export default async function FichaCompletaClientePage({
  params,
}: {
  params: Promise<{ estudio: string; clienteId: string }>
}) {
  const { estudio: slug, clienteId } = await params
  const agora = new Date()
  const { ano, mes } = { ano: agora.getFullYear(), mes: agora.getMonth() + 1 }
  const { inicio, fimExclusivo } = intervaloMes(ano, mes)

  const supabase = await createClient()

  const [estudio, sessao, { data: cliente }] = await Promise.all([
    getEstudioPorSlug(supabase, slug),
    getSessaoAtual(),
    supabase
      .from('clientes')
      .select('*, pt_principal:perfis!pt_principal_id(nome)')
      .eq('id', clienteId)
      .maybeSingle(),
  ])

  if (!estudio || !cliente || cliente.estudio_id !== estudio.id) {
    notFound()
  }
  const { ehAdmin } = papeisDaSessao(sessao)
  const c = cliente as unknown as ClienteCompleto

  const [
    { data: avaliacoesData, count: totalAvaliacoes },
    { data: sessoesData, count: totalSessoes },
    { data: presencasMes },
    pagamento,
  ] = await Promise.all([
    supabase
      .from('avaliacoes')
      .select('id, data, peso_kg, massa_gorda_pct, imc, proxima_reavaliacao', { count: 'exact' })
      .eq('cliente_id', clienteId)
      .order('data', { ascending: false })
      .limit(1),
    supabase
      .from('sessoes')
      .select('id, data, foco, nota_proxima, pt:perfis!pt_id(nome)', { count: 'exact' })
      .eq('cliente_id', clienteId)
      .order('data', { ascending: false })
      .limit(3),
    supabase
      .from('presencas')
      .select('estado')
      .eq('cliente_id', clienteId)
      .gte('data', inicio)
      .lt('data', fimExclusivo),
    ehAdmin
      ? supabase.from('v_estado_pagamento').select('*').eq('cliente_id', clienteId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const avaliacao = (avaliacoesData?.[0] ?? null) as AvaliacaoResumo | null
  const sessoes = (sessoesData ?? []) as unknown as SessaoResumo[]
  const presencas = presencasMes ?? []
  const feitos = presencas.filter((p) => p.estado === 'Presente').length
  const faltas = presencas.filter((p) => p.estado.startsWith('Faltou')).length
  const est = ESTADOS_CLIENTE[c.estado] ?? ESTADOS_CLIENTE.Ativo
  const a = ALERTAS[c.alerta as keyof typeof ALERTAS] ?? ALERTAS.Nenhum
  const meses = mesesAtivo(c.inicio_contrato, c.saiu_em)
  const aniversario = c.nascimento ? proximoAniversario(c.nascimento, agora) : null
  const idade = aniversario && c.nascimento ? idadeEm(c.nascimento, aniversario.data) : null
  const estadoPagamento = pagamento?.data as EstadoPagamento | null | undefined

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/painel/${slug}/clientes`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← Clientes
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">{c.nome}</h1>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{ background: est.bg, color: est.tx }}
            >
              {est.label}
            </span>
          </div>
          {c.objetivo && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{c.objetivo}</p>
          )}
        </div>
        <Link
          href={`/painel/${slug}/treinos/${clienteId}/editar`}
          className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
        >
          Editar ficha
        </Link>
      </div>

      {c.alerta !== 'Nenhum' && (
        <div
          className="mt-4 rounded-lg px-4 py-2.5 text-sm"
          style={{ background: a.bg, color: a.tx }}
        >
          <strong>{a.label}</strong>
          {c.alerta_detalhe && <span> — {c.alerta_detalhe}</span>}
        </div>
      )}

      {/* Dados gerais */}
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
          <strong className="block text-lg text-black dark:text-zinc-50">
            {meses !== null ? meses : '—'}
          </strong>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">meses ativo</span>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
          <strong className="block text-lg text-black dark:text-zinc-50">
            {c.frequencia_semanal ?? '—'}
          </strong>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">treinos / semana</span>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
          <strong className="block text-lg text-black dark:text-zinc-50">
            {c.nascimento ? fmtDiaMes(new Date(`${c.nascimento}T00:00:00`)) : '—'}
          </strong>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            {idade !== null ? `aniversário · faz ${idade} anos` : 'aniversário'}
          </span>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
          <strong className="block text-lg text-black dark:text-zinc-50">
            {c.pt_principal?.nome ?? '—'}
          </strong>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">PT principal</span>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
        {c.telefone && <p>📞 {c.telefone}</p>}
        {c.email && <p>✉️ {c.email}</p>}
        {c.notas && <p className="mt-1 italic">“{c.notas}”</p>}
      </div>

      {/* Avaliações */}
      <section className="mt-8 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Avaliações
          </h2>
          <Link
            href={`/painel/${slug}/avaliacoes/${clienteId}`}
            className="text-xs font-medium text-zinc-600 underline dark:text-zinc-400"
          >
            Ver histórico ({totalAvaliacoes ?? 0})
          </Link>
        </div>
        {avaliacao ? (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-700 dark:text-zinc-300">
            <span>{fmt(avaliacao.data)}</span>
            {avaliacao.peso_kg && <span>{avaliacao.peso_kg} kg</span>}
            {avaliacao.massa_gorda_pct && <span>{avaliacao.massa_gorda_pct}% gordura</span>}
            {avaliacao.imc && <span>IMC {avaliacao.imc}</span>}
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">Ainda não há avaliações.</p>
        )}
        {avaliacao?.proxima_reavaliacao && (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            Próxima reavaliação: {fmt(avaliacao.proxima_reavaliacao)}
          </p>
        )}
      </section>

      {/* Planos de treino */}
      <section className="mt-4 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Planos de treino
          </h2>
          <Link
            href={`/painel/${slug}/treinos/${clienteId}`}
            className="text-xs font-medium text-zinc-600 underline dark:text-zinc-400"
          >
            Ver histórico ({totalSessoes ?? 0})
          </Link>
        </div>
        {sessoes.length === 0 && <p className="mt-2 text-sm text-zinc-500">Sem treinos registados.</p>}
        <div className="mt-2 flex flex-col gap-1.5">
          {sessoes.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-sm">
              <span className="w-16 shrink-0 text-xs text-zinc-500">{fmt(s.data)}</span>
              <span className="truncate text-zinc-700 dark:text-zinc-300">{s.foco || 'Treino'}</span>
              <span className="shrink-0 text-xs text-zinc-500">{s.pt?.nome ?? '—'}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Presenças */}
      <section className="mt-4 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Presenças · {MESES[mes - 1]}
          </h2>
          <Link
            href={`/painel/${slug}/presencas/${clienteId}`}
            className="text-xs font-medium text-zinc-600 underline dark:text-zinc-400"
          >
            Ver detalhe
          </Link>
        </div>
        <div className="mt-2 flex gap-4 text-sm">
          <span className="text-green-700 dark:text-green-400">{feitos} feitos</span>
          <span className="text-red-700 dark:text-red-400">{faltas} faltas</span>
        </div>
      </section>

      {/* Pagamentos — só admin */}
      {ehAdmin && (
        <section className="mt-4 rounded-xl border border-black/10 p-4 dark:border-white/10">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Pagamento
            </h2>
            <Link
              href={`/painel/${slug}/pagamentos/${clienteId}`}
              className="text-xs font-medium text-zinc-600 underline dark:text-zinc-400"
            >
              Ver detalhe
            </Link>
          </div>
          {estadoPagamento ? (
            <p
              className={`mt-2 text-sm ${estadoPagamento.em_dia ? 'text-teal-700 dark:text-teal-400' : 'text-red-700 dark:text-red-400'}`}
            >
              {estadoPagamento.em_dia
                ? `Em dia · válido até ${fmt(estadoPagamento.valido_ate)}`
                : `Por regularizar${estadoPagamento.valido_ate ? ` · venceu em ${fmt(estadoPagamento.valido_ate)}` : ''}`}
            </p>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">Sem pagamentos registados.</p>
          )}
        </section>
      )}
    </div>
  )
}
