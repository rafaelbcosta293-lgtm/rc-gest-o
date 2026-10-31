import type { SupabaseClient } from '@supabase/supabase-js'
import type { Estudio } from '@/lib/supabase/database.types'
import { intervaloMes } from '@/lib/data/presencas'

export type PontoMensal = { mes: number; valor: number }
export type SerieEstudio = { estudioId: number; slug: string; nome: string; pontos: PontoMensal[] }
export type EvolucaoMensal = {
  meses: number[]
  novosSocios: SerieEstudio[]
  faturacao: SerieEstudio[]
  treinosRealizados: SerieEstudio[]
  ativosAgora: { estudioId: number; slug: string; nome: string; total: number }[]
}

// Resumo da Administração (gráficos "Resumo" na página inicial): uma
// curva por estúdio, mês a mês, desde janeiro até ao mês atual do ano
// corrente — para ver a evolução e a média, não só o valor de agora.
//
// Não dá para mostrar "sócios ativos ao longo do tempo" com rigor: isso
// precisaria de saber a data de saída de cada cliente que já não está
// ativo, e o campo "saiu_em" nunca chegou a ser preenchido em nenhum dos
// clientes que já saíram (verificado diretamente na base de dados) — não
// há forma de reconstruir esse histórico a partir dos dados existentes.
// "kpi_snapshots_daily" foi pensada para isto mas também nunca chegou a
// gravar nada (bug à parte, já corrigido, em lib/supabase/proxy.ts: os
// crons de alertas e deste snapshot estavam a ser redirecionados para
// /login antes de correr) — a partir de agora começa a acumular dados
// reais, dia a dia, para o futuro. Por agora mostra-se "novos sócios"
// (mês de inicio_contrato), que é um número 100% fiável para toda a
// história e ainda assim conclusivo sobre o crescimento.
export async function getEvolucaoMensal(
  supabase: SupabaseClient,
  estudios: Estudio[],
  ano: number
): Promise<EvolucaoMensal> {
  const idsEstudios = estudios.map((e) => e.id)
  const agora = new Date()
  const mesAtual = ano === agora.getFullYear() ? agora.getMonth() + 1 : 12
  const meses = Array.from({ length: mesAtual }, (_, i) => i + 1)

  const inicioAno = `${ano}-01-01`
  const fimAnoExclusivo = `${ano + 1}-01-01`

  const [
    { data: clientesData, error: erroClientes },
    { data: pagamentosData, error: erroPagamentos },
    { data: presencasData, error: erroPresencas },
  ] = await Promise.all([
    supabase
      .from('clientes')
      .select('estudio_id, inicio_contrato, estado')
      .in('estudio_id', idsEstudios),
    // O filtro por estúdio é feito em JS, a partir do join (estudioIdDoJoin)
    // — mais seguro do que confiar em ".in()" sobre uma coluna de um
    // recurso embutido, que não é um caminho tão bem testado nesta app
    // como ".eq()" (já usado assim na página "Este mês").
    supabase
      .from('pagamentos')
      .select('valor, data_pagamento, clientes!inner(estudio_id)')
      .gte('data_pagamento', inicioAno)
      .lt('data_pagamento', fimAnoExclusivo),
    supabase
      .from('presencas')
      .select('data, clientes!inner(estudio_id)')
      .eq('estado', 'Presente')
      .gte('data', inicioAno)
      .lt('data', fimAnoExclusivo),
  ])
  if (erroClientes || erroPagamentos || erroPresencas) {
    throw new Error((erroClientes ?? erroPagamentos ?? erroPresencas)!.message)
  }

  type ClienteLinha = { estudio_id: number; inicio_contrato: string | null; estado: string }
  type PagamentoLinha = { valor: number; data_pagamento: string; clientes: { estudio_id: number } | { estudio_id: number }[] }
  type PresencaLinha = { data: string; clientes: { estudio_id: number } | { estudio_id: number }[] }

  const clientes = (clientesData ?? []) as unknown as ClienteLinha[]
  const pagamentos = (pagamentosData ?? []) as unknown as PagamentoLinha[]
  const presencas = (presencasData ?? []) as unknown as PresencaLinha[]

  // O join embutido do Supabase devolve um objeto normalmente, mas o
  // tipo gerado é sempre array — esta função aceita as duas formas.
  function estudioIdDoJoin(valor: { estudio_id: number } | { estudio_id: number }[]): number | null {
    const linha = Array.isArray(valor) ? valor[0] : valor
    return linha?.estudio_id ?? null
  }

  const novosSocios: SerieEstudio[] = estudios.map((estudio) => ({
    estudioId: estudio.id,
    slug: estudio.slug,
    nome: estudio.nome,
    pontos: meses.map((mes) => {
      const { inicio, fimExclusivo } = intervaloMes(ano, mes)
      const novos = clientes.filter(
        (c) =>
          c.estudio_id === estudio.id &&
          c.inicio_contrato !== null &&
          c.inicio_contrato >= inicio &&
          c.inicio_contrato < fimExclusivo
      ).length
      return { mes, valor: novos }
    }),
  }))

  const faturacao: SerieEstudio[] = estudios.map((estudio) => ({
    estudioId: estudio.id,
    slug: estudio.slug,
    nome: estudio.nome,
    pontos: meses.map((mes) => {
      const { inicio, fimExclusivo } = intervaloMes(ano, mes)
      const total = pagamentos
        .filter(
          (p) =>
            estudioIdDoJoin(p.clientes) === estudio.id &&
            p.data_pagamento >= inicio &&
            p.data_pagamento < fimExclusivo
        )
        .reduce((soma, p) => soma + Number(p.valor), 0)
      return { mes, valor: total }
    }),
  }))

  const treinosRealizados: SerieEstudio[] = estudios.map((estudio) => ({
    estudioId: estudio.id,
    slug: estudio.slug,
    nome: estudio.nome,
    pontos: meses.map((mes) => {
      const { inicio, fimExclusivo } = intervaloMes(ano, mes)
      const total = presencas.filter(
        (p) => estudioIdDoJoin(p.clientes) === estudio.id && p.data >= inicio && p.data < fimExclusivo
      ).length
      return { mes, valor: total }
    }),
  }))

  const ativosAgora = estudios.map((estudio) => ({
    estudioId: estudio.id,
    slug: estudio.slug,
    nome: estudio.nome,
    total: clientes.filter((c) => c.estudio_id === estudio.id && c.estado === 'Ativo').length,
  }))

  return { meses, novosSocios, faturacao, treinosRealizados, ativosAgora }
}
