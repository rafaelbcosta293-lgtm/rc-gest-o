import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { fmt } from '@/lib/data/presencas'
import { segurosPorPagar } from '@/lib/data/clientes'
import ListaPagamentos, { type LinhaPagamentoAtraso, type LinhaSeguro, type LinhaInativo } from './ListaPagamentos'
import type { EstadoCliente } from '@/lib/supabase/database.types'

type PagamentoDetalhe = {
  cliente_id: string
  data_pagamento: string
  valido_ate: string
}

type ClientePagamento = {
  cliente_id: string
  nome: string
  valido_ate: string | null
  dataPagamento: string | null
  em_dia: boolean
  estado: EstadoCliente
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

  // Todos os clientes do estúdio, independentemente do estado — um
  // cliente inativo ou suspenso pode voltar a treinar, e é preciso
  // conseguir encontrá-lo aqui para lhe registar um pagamento (o que,
  // por si só, já o reativa).
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nome, estado')
    .eq('estudio_id', estudio.id)
    .order('nome')

  if (error) {
    throw new Error(error.message)
  }

  const clientesBase = data ?? []
  const idsClientes = clientesBase.map((c) => c.id)
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
          .select('cliente_id, data_pagamento, valido_ate')
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

  const clientesComResumo: ClientePagamento[] = clientesBase.map((c) => {
    const pagamento = ultimoPagamentoPorCliente.get(c.id)
    if (!pagamento) {
      return {
        cliente_id: c.id,
        nome: c.nome,
        valido_ate: null,
        dataPagamento: null,
        em_dia: false,
        estado: c.estado,
      }
    }
    return {
      cliente_id: c.id,
      nome: c.nome,
      valido_ate: pagamento.valido_ate,
      dataPagamento: pagamento.data_pagamento,
      em_dia: pagamento.valido_ate >= hoje,
      estado: c.estado,
    }
  })

  // Um cliente Inativo está sem pagar há muito tempo e, na prática,
  // já não vai voltar a pagar nem a treinar — por isso não entra nos
  // "atrasados" (que devem refletir dívida real, não histórico morto)
  // nem no "seguro a renovar" (não faz sentido renovar o seguro de
  // quem não treina). Fica à parte, só para continuar a ser
  // encontrável se um dia voltar a pagar.
  const emDia = clientesComResumo.filter((c) => c.em_dia)
  const atrasados = clientesComResumo.filter((c) => !c.em_dia && c.estado !== 'Inativo')
  const inativos = clientesComResumo.filter((c) => !c.em_dia && c.estado === 'Inativo')

  const inicioContratoPorCliente = new Map(
    (clientesInicioData ?? []).map((c) => [c.id, c.inicio_contrato])
  )
  const clientesParaSeguro = clientesBase
    .filter((c) => c.estado !== 'Inativo')
    .map((c) => ({
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
        // "Em dia" já não mostra este texto — a lista passou a ter as
        // colunas "Pagamento"/"Validade" com as datas em separado.
        : `válido até ${fmt(c.valido_ate)}`,
    dataReferencia: c.valido_ate,
    dataPagamento: c.dataPagamento,
  })
  const linhasAtrasados = atrasados.map((c) => paraLinha(c, 'atrasado'))
  const linhasEmDia = emDia.map((c) => paraLinha(c, 'emDia'))
  const linhasSeguros: LinhaSeguro[] = segurosARenovar.map((c) => ({
    clienteId: c.id,
    nome: c.nome,
    dataReferencia: c.dataRenovacao,
  }))
  const linhasInativos: LinhaInativo[] = inativos.map((c) => ({
    clienteId: c.cliente_id,
    nome: c.nome,
    semPagarDesdeLabel: c.valido_ate ? `sem pagar desde ${fmt(c.valido_ate)}` : 'sem pagamentos',
  }))

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
        {clientesBase.length - inativos.length} clientes
        {segurosARenovar.length > 0 &&
          ` · ${segurosARenovar.length} ${segurosARenovar.length === 1 ? 'seguro' : 'seguros'} a renovar`}
        .
      </p>

      <ListaPagamentos
        slug={slug}
        atrasados={linhasAtrasados}
        emDia={linhasEmDia}
        segurosARenovar={linhasSeguros}
        inativos={linhasInativos}
      />
    </div>
  )
}
