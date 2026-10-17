import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { fmt, treinosNoPeriodo } from '@/lib/data/presencas'
import { segurosPorPagar } from '@/lib/data/clientes'
import ListaPagamentos, { type LinhaPagamentoAtraso, type LinhaSeguro } from './ListaPagamentos'
import type { EstadoPagamento } from '@/lib/supabase/database.types'

type PagamentoDetalhe = {
  cliente_id: string
  data_pagamento: string
  valido_ate: string
  plano: { nome: string; sessoes_por_semana: number | null } | null
}

type ClientePagamento = EstadoPagamento & {
  tipoMensalidade: string | null
  realizados: number
  adquiridos: number | null
}

export default async function PagamentosPage({
  params,
}: {
  params: Promise<{ estudio: string }>
}) {
  const { estudio: slug } = await params

  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) {
    notFound()
  }

  const { data, error } = await supabase
    .from('v_estado_pagamento')
    .select('*')
    .eq('estudio_id', estudio.id)
    .order('nome')

  if (error) {
    throw new Error(error.message)
  }

  const clientes = (data ?? []) as EstadoPagamento[]
  const idsClientes = clientes.map((c) => c.cliente_id)
  const hoje = new Date().toISOString().slice(0, 10)

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

  const clientesComResumo: ClientePagamento[] = clientes.map((c) => {
    const pagamento = ultimoPagamentoPorCliente.get(c.cliente_id)
    if (!pagamento) {
      return { ...c, tipoMensalidade: null, realizados: 0, adquiridos: null }
    }
    const fimPeriodo = pagamento.valido_ate < hoje ? pagamento.valido_ate : hoje
    const adquiridos = treinosNoPeriodo(
      pagamento.plano?.sessoes_por_semana ?? null,
      pagamento.data_pagamento,
      fimPeriodo
    )
    const realizados = (presencasPorCliente.get(c.cliente_id) ?? []).filter(
      (d) => d >= pagamento.data_pagamento && d <= fimPeriodo
    ).length
    return { ...c, tipoMensalidade: pagamento.plano?.nome ?? null, realizados, adquiridos }
  })

  const emDia = clientesComResumo.filter((c) => c.em_dia)
  const atrasados = clientesComResumo.filter((c) => !c.em_dia)

  const inicioContratoPorCliente = new Map(
    (clientesInicioData ?? []).map((c) => [c.id, c.inicio_contrato])
  )
  const clientesParaSeguro = clientes.map((c) => ({
    id: c.cliente_id,
    nome: c.nome,
    inicio_contrato: inicioContratoPorCliente.get(c.cliente_id) ?? null,
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
  })
  const linhasAtrasados = atrasados.map((c) => paraLinha(c, 'atrasado'))
  const linhasEmDia = emDia.map((c) => paraLinha(c, 'emDia'))
  const linhasSeguros: LinhaSeguro[] = segurosARenovar.map((c) => ({
    clienteId: c.id,
    nome: c.nome,
    emDividaDesdeLabel: `em dívida desde ${fmt(c.dataRenovacao)}`,
  }))

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">Pagamentos</h1>
      <p className="mt-1 text-sm text-muted">
        {estudio.nome} · {atrasados.length} {atrasados.length === 1 ? 'atrasado' : 'atrasados'} de{' '}
        {clientes.length} clientes ativos
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
    </div>
  )
}
