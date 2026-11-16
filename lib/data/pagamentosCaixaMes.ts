import type { SupabaseClient } from '@supabase/supabase-js'
import { todasAsLinhas } from '@/lib/supabase/todasAsLinhas'
import { diasDoMesISO } from './assiduidade'
import { calcularFechoCaixa, descricaoPagamento, somarPorGrupoMetodo, type GrupoMetodo } from './fechoCaixa'

// Os pagamentos e o caixa de um mês, por estúdio — para o documento
// mensal (PDF) que a administração guarda fora da aplicação: o que
// entrou (mensalidades, seguros, vendas), por que método, quem recebeu,
// e o fecho de caixa de cada dia.

export type PagamentoDoMes = {
  data: string
  cliente: string
  descricao: string
  metodo: string | null
  valor: number
  desconto: number
  quem: string | null
  motivoAnulacao: string | null
}

export type VendaDoMes = { data: string; descricao: string; cliente: string | null; metodo: string | null; valor: number }

export type FechoDoMes = {
  data: string
  saldoAnterior: number
  entradas: number
  saidas: number
  outros: number
  esperado: number
  contado: number
  diferenca: number
  quem: string | null
  nota: string | null
}

export type EstudioDoMes = {
  id: number
  nome: string
  pagamentos: PagamentoDoMes[]
  anulados: PagamentoDoMes[]
  vendas: VendaDoMes[]
  totalPagamentos: number
  totalVendas: number
  descontos: number
  mensalidades: number
  porMetodo: Record<GrupoMetodo, number>
  fechos: FechoDoMes[]
  somaDiferencas: number
}

export type PagamentosCaixaDoMes = { ano: number; mes: number; estudios: EstudioDoMes[] }

type LinhaPagamento = {
  valor: number | string
  desconto: number | string | null
  metodo: string | null
  data_pagamento: string
  mensalidade: boolean
  inclui_inscricao: boolean
  inclui_seguro: boolean
  inclui_reativacao: boolean
  anulado_em: string | null
  motivo_anulacao: string | null
  quem_fez: string | null
  registado_por: string | null
  cliente: { nome: string; estudio_id: number } | null
  plano: { nome: string } | null
}
type LinhaVenda = {
  estudio_id: number
  data: string
  categoria: string
  descricao: string | null
  valor: number | string
  metodo: string | null
  cliente: { nome: string } | null
}
type LinhaFecho = {
  estudio_id: number
  data: string
  valor_numerario_dia: number | string
  saldo_anterior: number | string
  valor_contado: number | string
  saidas_caixa_dia: number | string
  outros_entrada_dia: number | string
  outros_saida_dia: number | string
  nota: string | null
  quem_fez: string | null
  registado_por: string | null
}

export type DadosPagamentosCaixa = {
  ano: number
  mes: number
  estudios: { id: number; nome: string }[]
  // id → nome (para "quem recebeu" e "quem fez o fecho").
  nomes: Map<string, string>
  pagamentos: LinhaPagamento[]
  vendas: LinhaVenda[]
  fechos: LinhaFecho[]
}

const arredondar = (v: number) => Math.round(v * 100) / 100

// Função pura (testável sem base de dados).
export function montarPagamentosCaixa(d: DadosPagamentosCaixa): PagamentosCaixaDoMes {
  // A pessoa escolhida no formulário; se não houver, a conta que registou.
  const quem = (pessoa: string | null, conta: string | null) => d.nomes.get(pessoa ?? '') ?? d.nomes.get(conta ?? '') ?? null
  const estudios = d.estudios.map((e): EstudioDoMes => {
    const linhas = d.pagamentos
      .filter((p) => p.cliente?.estudio_id === e.id)
      .sort((a, b) => a.data_pagamento.localeCompare(b.data_pagamento))
    const paraLinha = (p: LinhaPagamento): PagamentoDoMes => ({
      data: p.data_pagamento,
      cliente: p.cliente?.nome ?? '—',
      descricao: descricaoPagamento(p),
      metodo: p.metodo,
      valor: Number(p.valor),
      desconto: Number(p.desconto ?? 0),
      quem: quem(p.quem_fez, p.registado_por),
      motivoAnulacao: p.motivo_anulacao,
    })
    const ativos = linhas.filter((p) => !p.anulado_em)
    const pagamentos = ativos.map(paraLinha)
    const vendas = d.vendas
      .filter((v) => v.estudio_id === e.id)
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((v) => ({ data: v.data, descricao: v.descricao ?? v.categoria, cliente: v.cliente?.nome ?? null, metodo: v.metodo, valor: Number(v.valor) }))
    const fechos = d.fechos
      .filter((f) => f.estudio_id === e.id)
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((f): FechoDoMes => {
        const saldoAnterior = Number(f.saldo_anterior)
        const entradas = Number(f.valor_numerario_dia)
        const saidas = Number(f.saidas_caixa_dia)
        const outrosEntrada = Number(f.outros_entrada_dia)
        const outrosSaida = Number(f.outros_saida_dia)
        const contado = Number(f.valor_contado)
        const { valorEsperado, diferenca } = calcularFechoCaixa({
          saldoAnterior,
          valorNumerarioDia: entradas,
          saidasCaixaDia: saidas,
          outrosEntradaDia: outrosEntrada,
          outrosSaidaDia: outrosSaida,
          valorContado: contado,
        })
        return {
          data: f.data,
          saldoAnterior,
          entradas,
          saidas,
          outros: arredondar(outrosEntrada - outrosSaida),
          esperado: valorEsperado,
          contado,
          diferenca,
          quem: quem(f.quem_fez, f.registado_por),
          nota: f.nota?.trim() || null,
        }
      })
    return {
      id: e.id,
      nome: e.nome,
      pagamentos,
      anulados: linhas.filter((p) => p.anulado_em).map(paraLinha),
      vendas,
      totalPagamentos: arredondar(pagamentos.reduce((s, p) => s + p.valor, 0)),
      totalVendas: arredondar(vendas.reduce((s, v) => s + v.valor, 0)),
      descontos: arredondar(pagamentos.reduce((s, p) => s + p.desconto, 0)),
      mensalidades: ativos.filter((p) => p.mensalidade).length,
      porMetodo: somarPorGrupoMetodo([...pagamentos, ...vendas]),
      fechos,
      somaDiferencas: arredondar(fechos.reduce((s, f) => s + f.diferenca, 0)),
    }
  })
  return { ano: d.ano, mes: d.mes, estudios }
}

// Lê tudo de um mês, com o cliente de administração (o documento também
// é gerado sem ninguém com sessão aberta).
export async function carregarPagamentosCaixaDoMes(admin: SupabaseClient, ano: number, mes: number): Promise<PagamentosCaixaDoMes> {
  const dias = diasDoMesISO(ano, mes)
  const primeiro = dias[0]
  const ultimo = dias[dias.length - 1]
  const [estudios, perfis, pagamentos, vendas, fechos] = await Promise.all([
    admin.from('estudios').select('id, nome').order('id'),
    admin.from('perfis').select('id, nome'),
    todasAsLinhas<LinhaPagamento>((de, ate) =>
      admin
        .from('pagamentos')
        .select(
          'valor, desconto, metodo, data_pagamento, mensalidade, inclui_inscricao, inclui_seguro, inclui_reativacao, anulado_em, motivo_anulacao, quem_fez, registado_por, cliente:clientes(nome, estudio_id), plano:planos(nome)'
        )
        .gte('data_pagamento', primeiro)
        .lte('data_pagamento', ultimo)
        .order('id')
        .range(de, ate) as unknown as PromiseLike<{ data: LinhaPagamento[] | null; error: { message: string } | null }>
    ),
    todasAsLinhas<LinhaVenda>((de, ate) =>
      admin
        .from('receitas_outras')
        .select('estudio_id, data, categoria, descricao, valor, metodo, cliente:clientes(nome)')
        // Só o que foi registado na app (não os totais importados do Excel).
        .in('origem', ['app', 'venda'])
        .is('anulado_em', null)
        .gte('data', primeiro)
        .lte('data', ultimo)
        .order('id')
        .range(de, ate) as unknown as PromiseLike<{ data: LinhaVenda[] | null; error: { message: string } | null }>
    ),
    admin
      .from('fechos_caixa')
      .select('estudio_id, data, valor_numerario_dia, saldo_anterior, valor_contado, saidas_caixa_dia, outros_entrada_dia, outros_saida_dia, nota, quem_fez, registado_por')
      .gte('data', primeiro)
      .lte('data', ultimo),
  ])
  const erro = estudios.error ?? perfis.error ?? pagamentos.error ?? vendas.error ?? fechos.error
  if (erro) throw new Error(erro.message)
  return montarPagamentosCaixa({
    ano,
    mes,
    estudios: (estudios.data ?? []) as { id: number; nome: string }[],
    nomes: new Map(((perfis.data ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome.trim()])),
    pagamentos: pagamentos.data,
    vendas: vendas.data,
    fechos: (fechos.data ?? []) as LinhaFecho[],
  })
}
