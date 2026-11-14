import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { fmt } from '@/lib/data/presencas'
import { segurosPorPagar } from '@/lib/data/clientes'
import SubmitButton from '@/components/SubmitButton'
import ConfirmarAcao from '@/components/ConfirmarAcao'
import VendaProdutoForm, { type ProdutoVenda } from './VendaProdutoForm'
import { anularVendaProduto, registarVendaProduto } from './actions'
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
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ venda?: string; erroVenda?: string }>
}) {
  const { estudio: slug } = await params
  const { venda, erroVenda } = await searchParams

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

  // Produtos à venda e as vendas de hoje deste estúdio.
  const hojeLisboa = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date())
  const [{ data: produtosData }, { data: vendasData }] = await Promise.all([
    supabase.from('produtos').select('id, nome, valor, categoria:produto_categorias(nome, ordem)').eq('ativo', true).order('nome'),
    supabase
      .from('receitas_outras')
      .select('id, descricao, categoria, valor, metodo, quantidade, criado_em, cliente:clientes(nome)')
      .eq('estudio_id', estudio.id)
      .eq('origem', 'venda')
      .eq('data', hojeLisboa)
      .is('anulado_em', null)
      .order('criado_em', { ascending: false }),
  ])
  const umDe = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)
  const produtos: ProdutoVenda[] = (produtosData ?? [])
    .map((p) => {
      const c = umDe(p.categoria as unknown as { nome: string; ordem: number } | { nome: string; ordem: number }[] | null)
      return { id: p.id, nome: p.nome, valor: Number(p.valor), categoria: c?.nome ?? 'Produtos', ordem: c?.ordem ?? 99 }
    })
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt'))
  const vendasHoje = (vendasData ?? []).map((v) => ({
    id: v.id as string,
    descricao: (v.descricao as string | null) ?? v.categoria,
    categoria: v.categoria as string,
    valor: Number(v.valor),
    metodo: (v.metodo as string | null) ?? '—',
    hora: new Date(v.criado_em).toLocaleTimeString('pt-PT', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit' }),
    cliente: umDe(v.cliente as unknown as { nome: string } | { nome: string }[] | null)?.nome ?? null,
  }))
  const totalVendasHoje = vendasHoje.reduce((s, v) => s + v.valor, 0)
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
          .from('v_resumo_pagamentos_cliente')
          .select('cliente_id, data_pagamento:ultimo_pagamento, valido_ate:ultimo_valido_ate')
          .eq('estudio_id', estudio.id),
        supabase.from('clientes').select('id, inicio_contrato').in('id', idsClientes),
        supabase
          .from('pagamentos_ativos')
          .select('cliente_id, data_pagamento')
          .in('cliente_id', idsClientes)
          .eq('inclui_seguro', true),
        supabase
          .from('pagamentos_ativos')
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
    estado: c.estado,
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
  const estadoPorCliente = new Map(clientesBase.map((c) => [c.id, c.estado]))
  const linhasSeguros: LinhaSeguro[] = segurosARenovar.map((c) => ({
    clienteId: c.id,
    nome: c.nome,
    estado: estadoPorCliente.get(c.id) ?? 'Ativo',
    dataReferencia: c.dataRenovacao,
  }))
  const linhasInativos: LinhaInativo[] = inativos.map((c) => ({
    clienteId: c.cliente_id,
    nome: c.nome,
    estado: c.estado,
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

      <section id="vendas" className="mt-10 scroll-mt-24">
        <h2 className="text-lg font-bold text-foreground">Venda de produtos</h2>
        <p className="mt-1 text-sm text-muted">
          Bar, merchandising e outros produtos. Entra nas contas do dia e no fecho de caixa — não conta como mensalidade.
        </p>
        {erroVenda && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erroVenda}</p>}
        {venda === 'ok' && <p className="mt-3 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-700">Venda registada.</p>}
        {venda === 'anulada' && <p className="mt-3 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-700">Venda anulada.</p>}

        <div className="mt-3">
          {produtos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border-subtle p-5 text-sm text-muted">
              Ainda não há produtos. A administração cria-os em Administração → Serviços / Produtos.
            </p>
          ) : (
            <VendaProdutoForm
              slug={slug}
              estudioId={estudio.id}
              produtos={produtos}
              clientes={clientesBase.map((c) => ({ id: c.id, nome: c.nome }))}
              action={registarVendaProduto}
            />
          )}
        </div>

        {vendasHoje.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border-subtle bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-2 font-semibold">Vendas de hoje</th>
                  <th className="px-4 py-2 font-semibold">Categoria</th>
                  <th className="px-4 py-2 font-semibold">Cliente</th>
                  <th className="px-4 py-2 font-semibold">Método</th>
                  <th className="px-4 py-2 text-right font-semibold">Valor</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {vendasHoje.map((v) => (
                  <tr key={v.id} className="border-b border-border-subtle/60 last:border-0">
                    <td className="px-4 py-2 text-foreground">
                      {v.descricao} <span className="text-xs text-muted">· {v.hora}</span>
                    </td>
                    <td className="px-4 py-2 text-muted">{v.categoria}</td>
                    <td className="px-4 py-2 text-muted">{v.cliente ?? '—'}</td>
                    <td className="px-4 py-2 text-muted">{v.metodo}</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-foreground">{v.valor.toFixed(2).replace('.', ',')} €</td>
                    <td className="px-4 py-2 text-right">
                      <ConfirmarAcao action={anularVendaProduto} confirmacao={`Anular a venda de ${v.descricao}?`}>
                        <input type="hidden" name="estudio_slug" value={slug} />
                        <input type="hidden" name="id" value={v.id} />
                        <SubmitButton pendingText="…" className="rounded-full border border-border-strong px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-50">
                          Anular
                        </SubmitButton>
                      </ConfirmarAcao>
                    </td>
                  </tr>
                ))}
                <tr className="bg-foreground/[.03] font-bold">
                  <td className="px-4 py-2" colSpan={4}>
                    Total de hoje
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{totalVendasHoje.toFixed(2).replace('.', ',')} €</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
