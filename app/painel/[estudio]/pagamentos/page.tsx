import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { fmt, treinosNoPeriodo, intervaloMes, MESES } from '@/lib/data/presencas'
import { segurosPorPagar } from '@/lib/data/clientes'
import ListaPagamentos, { type LinhaPagamentoAtraso, type LinhaSeguro } from './ListaPagamentos'

type PagamentoDoMes = {
  id: string
  valor: number
  metodo: string | null
  data_pagamento: string
  clientes: { nome: string } | null
}

function fmtEuro(v: number) {
  return `€${v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

type PagamentoDetalhe = {
  cliente_id: string
  data_pagamento: string
  valido_ate: string
  plano: { nome: string; sessoes_por_semana: number | null } | null
}

type ClientePagamento = {
  cliente_id: string
  nome: string
  valido_ate: string | null
  em_dia: boolean
  tipoMensalidade: string | null
  realizados: number
  adquiridos: number | null
}

export default async function PagamentosPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ mes?: string }>
}) {
  const { estudio: slug } = await params
  const sp = await searchParams

  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) {
    notFound()
  }

  const hojeDate = new Date()
  const [anoMes, mesMes] = /^\d{4}-\d{2}$/.test(sp.mes ?? '')
    ? sp.mes!.split('-').map(Number)
    : [hojeDate.getFullYear(), hojeDate.getMonth() + 1]
  const { inicio: inicioMes, fimExclusivo: fimMesExclusivo } = intervaloMes(anoMes, mesMes)

  // Todos os clientes do estúdio, independentemente do estado — um
  // cliente inativo ou suspenso pode voltar a treinar, e é preciso
  // conseguir encontrá-lo aqui para lhe registar um pagamento (o que,
  // por si só, já o reativa).
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nome')
    .eq('estudio_id', estudio.id)
    .order('nome')

  if (error) {
    throw new Error(error.message)
  }

  const clientesBase = data ?? []
  const idsClientes = clientesBase.map((c) => c.id)
  const hoje = new Date().toISOString().slice(0, 10)

  // Para "consultar os pagamentos por mês" — uma lista à parte, por
  // pagamento (não por cliente), de tudo o que foi recebido no mês
  // escolhido. Independente do resto da página, que mostra o estado
  // atual, não um histórico.
  const { data: pagamentosMesData, error: erroPagamentosMes } = await supabase
    .from('pagamentos')
    .select('id, valor, metodo, data_pagamento, clientes!inner(nome, estudio_id)')
    .eq('clientes.estudio_id', estudio.id)
    .gte('data_pagamento', inicioMes)
    .lt('data_pagamento', fimMesExclusivo)
    .order('data_pagamento', { ascending: false })
  if (erroPagamentosMes) {
    throw new Error(erroPagamentosMes.message)
  }
  const pagamentosMes = (pagamentosMesData ?? []) as unknown as PagamentoDoMes[]
  const totalPagamentosMes = pagamentosMes.reduce((soma, p) => soma + p.valor, 0)

  // Estas quatro só precisam dos ids dos clientes, não dos resultados
  // umas das outras — correm todas ao mesmo tempo.
  const [
    { data: pagamentosData, error: erroPagamentosDetalhe },
    { data: clientesInicioData, error: erroClientesInicio },
    { data: segurosPagosData, error: erroSegurosPagos },
    { data: reativacoesData, error: erroReativacoesSeguro },
  ] = idsClientes.length
    ? await Promise.all([
        supabase
          .from('pagamentos')
          .select('cliente_id, data_pagamento, valido_ate, plano:planos(nome, sessoes_por_semana)')
          .in('cliente_id', idsClientes)
          .order('data_pagamento', { ascending: false }),
        supabase.from('clientes').select('id, inicio_contrato').in('id', idsClientes),
        supabase
          .from('pagamentos')
          .select('cliente_id, data_pagamento')
          .in('cliente_id', idsClientes)
          .eq('inclui_seguro', true),
        supabase
          .from('pagamentos')
          .select('cliente_id, data_pagamento')
          .in('cliente_id', idsClientes)
          .eq('inclui_reativacao', true),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ]
  if (erroPagamentosDetalhe || erroClientesInicio || erroSegurosPagos || erroReativacoesSeguro) {
    throw new Error(
      (erroPagamentosDetalhe ?? erroClientesInicio ?? erroSegurosPagos ?? erroReativacoesSeguro)!.message
    )
  }

  // A consulta já vem ordenada por data decrescente, por isso a primeira
  // ocorrência de cada cliente é o pagamento mais recente.
  const ultimoPagamentoPorCliente = new Map<string, PagamentoDetalhe>()
  for (const p of (pagamentosData ?? []) as unknown as PagamentoDetalhe[]) {
    if (!ultimoPagamentoPorCliente.has(p.cliente_id)) {
      ultimoPagamentoPorCliente.set(p.cliente_id, p)
    }
  }

  const datasInicio = [...ultimoPagamentoPorCliente.values()].map((p) => p.data_pagamento)
  const dataMinima = datasInicio.length
    ? datasInicio.reduce((a, b) => (a < b ? a : b))
    : hoje

  const { data: presencasData, error: erroPresencasDetalhe } = idsClientes.length
    ? await supabase
        .from('presencas')
        .select('cliente_id, data')
        .in('cliente_id', idsClientes)
        .eq('estado', 'Presente')
        .gte('data', dataMinima)
    : { data: [], error: null }
  if (erroPresencasDetalhe) {
    throw new Error(erroPresencasDetalhe.message)
  }

  const presencasPorCliente = new Map<string, string[]>()
  for (const p of presencasData ?? []) {
    const lista = presencasPorCliente.get(p.cliente_id) ?? []
    lista.push(p.data)
    presencasPorCliente.set(p.cliente_id, lista)
  }

  const clientesComResumo: ClientePagamento[] = clientesBase.map((c) => {
    const pagamento = ultimoPagamentoPorCliente.get(c.id)
    if (!pagamento) {
      return {
        cliente_id: c.id,
        nome: c.nome,
        valido_ate: null,
        em_dia: false,
        tipoMensalidade: null,
        realizados: 0,
        adquiridos: null,
      }
    }
    const fimPeriodo = pagamento.valido_ate < hoje ? pagamento.valido_ate : hoje
    const adquiridos = treinosNoPeriodo(
      pagamento.plano?.sessoes_por_semana ?? null,
      pagamento.data_pagamento,
      fimPeriodo
    )
    const realizados = (presencasPorCliente.get(c.id) ?? []).filter(
      (d) => d >= pagamento.data_pagamento && d <= fimPeriodo
    ).length
    return {
      cliente_id: c.id,
      nome: c.nome,
      valido_ate: pagamento.valido_ate,
      em_dia: pagamento.valido_ate >= hoje,
      tipoMensalidade: pagamento.plano?.nome ?? null,
      realizados,
      adquiridos,
    }
  })

  const emDia = clientesComResumo.filter((c) => c.em_dia)
  const atrasados = clientesComResumo.filter((c) => !c.em_dia)

  const inicioContratoPorCliente = new Map(
    (clientesInicioData ?? []).map((c) => [c.id, c.inicio_contrato])
  )
  const clientesParaSeguro = clientesBase.map((c) => ({
    id: c.id,
    nome: c.nome,
    inicio_contrato: inicioContratoPorCliente.get(c.id) ?? null,
  }))
  const segurosARenovar = segurosPorPagar(
    clientesParaSeguro,
    new Date(),
    segurosPagosData ?? [],
    reativacoesData ?? []
  )

  const paraLinha = (c: ClientePagamento, variante: 'atrasado' | 'emDia'): LinhaPagamentoAtraso => ({
    clienteId: c.cliente_id,
    nome: c.nome,
    variante,
    situacaoLabel:
      variante === 'atrasado'
        ? c.valido_ate
          ? `venceu em ${fmt(c.valido_ate)}`
          : 'sem pagamentos'
        : `válido até ${fmt(c.valido_ate)}`,
    tipoMensalidade: c.tipoMensalidade,
    realizados: c.realizados,
    adquiridos: c.adquiridos,
    dataReferencia: c.valido_ate,
  })
  const linhasAtrasados = atrasados.map((c) => paraLinha(c, 'atrasado'))
  const linhasEmDia = emDia.map((c) => paraLinha(c, 'emDia'))
  const linhasSeguros: LinhaSeguro[] = segurosARenovar.map((c) => ({
    clienteId: c.id,
    nome: c.nome,
    emDividaDesdeLabel: `em dívida desde ${fmt(c.dataRenovacao)}`,
    dataReferencia: c.dataRenovacao,
  }))

  const anoMesAnterior = mesMes === 1 ? anoMes - 1 : anoMes
  const mesMesAnterior = mesMes === 1 ? 12 : mesMes - 1
  const anoMesSeguinte = mesMes === 12 ? anoMes + 1 : anoMes
  const mesMesSeguinte = mesMes === 12 ? 1 : mesMes + 1

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Pagamentos</h1>
      <p className="mt-1 text-sm text-muted">
        {estudio.nome} · {atrasados.length} {atrasados.length === 1 ? 'atrasado' : 'atrasados'} de{' '}
        {clientesBase.length} clientes
        {segurosARenovar.length > 0 &&
          ` · ${segurosARenovar.length} ${segurosARenovar.length === 1 ? 'seguro' : 'seguros'} a renovar`}
        .
      </p>

      <ListaPagamentos
        slug={slug}
        atrasados={linhasAtrasados}
        emDia={linhasEmDia}
        segurosARenovar={linhasSeguros}
      />

      {/* Histórico por mês — pagamentos recebidos num mês em concreto,
          independente do estado atual de cada cliente (acima). */}
      <div className="mt-10 border-t border-border-subtle pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-foreground">Pagamentos por mês</h2>
          <div className="flex items-center gap-2">
            <Link
              href={`/painel/${slug}/pagamentos?mes=${anoMesAnterior}-${String(mesMesAnterior).padStart(2, '0')}`}
              className="rounded-md border border-border-subtle px-3 py-1.5 text-sm"
            >
              ← {MESES[mesMesAnterior - 1].slice(0, 3)}
            </Link>
            <strong className="text-sm text-foreground">
              {MESES[mesMes - 1]} {anoMes}
            </strong>
            <Link
              href={`/painel/${slug}/pagamentos?mes=${anoMesSeguinte}-${String(mesMesSeguinte).padStart(2, '0')}`}
              className="rounded-md border border-border-subtle px-3 py-1.5 text-sm"
            >
              {MESES[mesMesSeguinte - 1].slice(0, 3)} →
            </Link>
          </div>
        </div>

        <p className="mt-2 text-sm text-muted">
          {pagamentosMes.length} {pagamentosMes.length === 1 ? 'pagamento' : 'pagamentos'} · total{' '}
          <span className="font-mono font-semibold text-foreground">{fmtEuro(totalPagamentosMes)}</span>
        </p>

        {pagamentosMes.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border-subtle p-6 text-center text-sm text-muted">
            Sem pagamentos registados em {MESES[mesMes - 1].toLowerCase()}.
          </div>
        ) : (
          <div className="mt-4 flex flex-col overflow-hidden rounded-2xl border border-border-subtle shadow-card">
            {pagamentosMes.map((p, i) => (
              <div
                key={p.id}
                className={`flex flex-wrap items-center justify-between gap-2 bg-surface px-4 py-3 text-sm ${
                  i === 0 ? '' : 'border-t border-border-subtle'
                }`}
              >
                <div>
                  <span className="font-medium text-foreground">{p.clientes?.nome ?? '—'}</span>
                  <span className="ml-2 text-xs text-muted">
                    {fmt(p.data_pagamento)}
                    {p.metodo && ` · ${p.metodo}`}
                  </span>
                </div>
                <span className="font-mono font-semibold text-foreground">{fmtEuro(p.valor)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
