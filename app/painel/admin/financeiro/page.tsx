import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { todasAsLinhas } from '@/lib/supabase/todasAsLinhas'
import { getEstudios, filtrarPorEstudio } from '@/lib/data/estudios'
import { intervaloMes } from '@/lib/data/presencas'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { desbloquearAdmin } from '../actions'
import { PALETA, corEstudio } from '@/lib/data/constantes'
import {
  mrrAtual,
  arpu,
  taxaPagamentoAteDia8,
  agingDivida,
  margemPorHora,
  parseValorConfig,
  ultimosMeses,
} from '@/lib/data/financeiro'
import PortaSenha from '@/components/PortaSenha'
import StatCard from '@/components/StatCard'
import LineChart from '@/components/LineChart'
import BarMeter from '@/components/BarMeter'
import ExportarCsvButton from '@/components/ExportarCsvButton'

const MESES_HISTORICO = 24

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; erroSenha?: string; estudio?: string }>
}) {
  const { erroSenha, estudio: estudioParam } = await searchParams

  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'admin')
  const desbloqueada = protegida ? await areaDesbloqueada('admin') : true
  if (protegida && !desbloqueada) {
    return (
      <PortaSenha
        titulo="Administração — Financeiro"
        destino="/painel/admin/financeiro"
        action={desbloquearAdmin}
        erro={erroSenha}
      />
    )
  }

  const estudios = filtrarPorEstudio(await getEstudios(supabase), estudioParam)
  const idsEstudios = new Set(estudios.map((e) => e.id))
  const hoje = new Date().toISOString().slice(0, 10)
  const ano = Number(hoje.slice(0, 4))
  const mes = Number(hoje.slice(5, 7))
  const { inicio, fimExclusivo } = intervaloMes(ano, mes)
  const meses = ultimosMeses(hoje, MESES_HISTORICO)

  const [
    { data: clientesData, error: erroClientes },
    { data: resumoData, error: erroResumo },
    { data: receitaMensalData, error: erroReceita },
    { data: pagamentosMesData, error: erroPagamentosMes },
    { data: registosData, error: erroRegistos },
    { data: configData, error: erroConfig },
  ] = await Promise.all([
    supabase.from('clientes').select('id, estudio_id, estado'),
    todasAsLinhas((de, ate) =>
      supabase
        .from('v_resumo_pagamentos_cliente')
        .select('cliente_id, estudio_id, ultimo_valor, ultimo_valido_ate')
        .order('cliente_id')
        .range(de, ate)
    ),
    supabase.from('v_receita_mensal').select('estudio_id, mes, receita').order('mes'),
    todasAsLinhas((de, ate) =>
      supabase
        .from('pagamentos_ativos')
        .select('cliente_id, valor, data_pagamento, inclui_inscricao, inclui_seguro, inclui_reativacao, clientes!inner(estudio_id)')
        .gte('data_pagamento', inicio)
        .lt('data_pagamento', fimExclusivo)
        .order('id')
        .range(de, ate)
    ),
    supabase.from('registos_pt').select('estudio_id, horas').gte('data', inicio).lt('data', fimExclusivo),
    supabase.from('config').select('valor').eq('chave', 'custo_hora_pt').maybeSingle(),
  ])

  for (const erro of [erroClientes, erroResumo, erroReceita, erroPagamentosMes, erroRegistos, erroConfig]) {
    if (erro) throw new Error(erro.message)
  }

  // Filtrados para o(s) estúdio(s) escolhidos no submenu do menu
  // superior (ou todos, sem filtro).
  const clientes = (clientesData ?? []).filter((c) => idsEstudios.has(c.estudio_id))
  const registos = (registosData ?? []).filter((r) => idsEstudios.has(r.estudio_id))
  const ativosPorEstudio = new Map<number, number>()
  for (const c of clientes) {
    if (c.estado === 'Ativo') ativosPorEstudio.set(c.estudio_id, (ativosPorEstudio.get(c.estudio_id) ?? 0) + 1)
  }
  const totalAtivos = clientes.filter((c) => c.estado === 'Ativo').length

  // Pagamento mais recente de cada cliente — base do MRR "reconhecido".
  const maisRecentePorCliente = new Map<string, { valor: number; valido_ate: string; estudio_id: number }>()
  for (const r of resumoData) {
    if (!idsEstudios.has(r.estudio_id)) continue
    maisRecentePorCliente.set(r.cliente_id, {
      valor: Number(r.ultimo_valor),
      valido_ate: r.ultimo_valido_ate,
      estudio_id: r.estudio_id,
    })
  }
  const mrr = mrrAtual(Array.from(maisRecentePorCliente.values()), hoje)
  const arr = mrr * 12
  const arpuGlobal = arpu(mrr, totalAtivos)

  const mrrPorEstudio = new Map<number, number>()
  for (const pag of maisRecentePorCliente.values()) {
    if (pag.valido_ate < hoje) continue
    mrrPorEstudio.set(pag.estudio_id, (mrrPorEstudio.get(pag.estudio_id) ?? 0) + pag.valor)
  }

  // Receita por mês (já somada na base de dados, ver v_receita_mensal) —
  // uma linha por estúdio no gráfico, e o total de cada ano em baixo.
  const receitaMensal = (receitaMensalData ?? [])
    .filter((r) => idsEstudios.has(r.estudio_id))
    .map((r) => ({ estudio_id: r.estudio_id, mes: String(r.mes).slice(0, 7), receita: Number(r.receita) }))
  const seriesReceita = estudios.map((e) => ({
    nome: e.nome,
    cor: corEstudio(e.slug).cor,
    valores: meses.map((m) =>
      receitaMensal.filter((r) => r.estudio_id === e.id && r.mes === m).reduce((s, r) => s + r.receita, 0)
    ),
  }))
  const anos = Array.from(new Set(receitaMensal.map((r) => r.mes.slice(0, 4)))).sort().reverse()
  const receitaPorAno = anos.map((ano) => {
    const doAno = receitaMensal.filter((r) => r.mes.startsWith(ano))
    const porEstudio = new Map(
      estudios.map((e) => [e.id, doAno.filter((r) => r.estudio_id === e.id).reduce((s, r) => s + r.receita, 0)])
    )
    const total = doAno.reduce((s, r) => s + r.receita, 0)
    const mesesComReceita = new Set(doAno.map((r) => r.mes)).size
    return { ano, porEstudio, total, mesesComReceita }
  })

  const pagamentosDoMes = pagamentosMesData
    .filter((p) => idsEstudios.has((p.clientes as unknown as { estudio_id: number }).estudio_id))
    .map((p) => ({ ...p, valor: Number(p.valor) }))
  const taxaAteDia8 = taxaPagamentoAteDia8(pagamentosDoMes)

  const clientesEmAtraso = clientes
    .filter((c) => c.estado === 'Ativo')
    .map((c) => {
      const pag = maisRecentePorCliente.get(c.id)
      if (!pag || pag.valido_ate >= hoje) return null
      const diasEmAtraso = Math.round(
        (new Date(`${hoje}T00:00:00`).getTime() - new Date(`${pag.valido_ate}T00:00:00`).getTime()) / 86_400_000
      )
      return { diasEmAtraso, ultimoValor: pag.valor }
    })
    .filter((c): c is { diasEmAtraso: number; ultimoValor: number } => c !== null)
  const aging = agingDivida(clientesEmAtraso)
  const valorTotalEmAtraso = clientesEmAtraso.reduce((soma, c) => soma + c.ultimoValor, 0)

  const custoHoraPt = parseValorConfig(configData?.valor) ?? 0
  const horasTotais = registos.reduce((soma, r) => soma + r.horas, 0)
  const receitaDoMes = pagamentosDoMes.reduce((soma, p) => soma + p.valor, 0)
  const margem = margemPorHora(receitaDoMes, horasTotais, custoHoraPt)

  const addonsDoMes = {
    inscricao: pagamentosDoMes.filter((p) => p.inclui_inscricao).length,
    seguro: pagamentosDoMes.filter((p) => p.inclui_seguro).length,
    reativacao: pagamentosDoMes.filter((p) => p.inclui_reativacao).length,
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Link
        href="/painel/admin"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Administração
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Financeiro</h1>
      <p className="mt-1 text-sm text-muted">
        {estudios.map((e) => e.nome).join(' + ')} · {totalAtivos} clientes ativos
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="MRR"
          valor={`€${Math.round(mrr)}`}
          aoVivo
          formula="Soma do pagamento mais recente de cada cliente ativo ainda dentro da validade (em dia)."
        />
        <StatCard label="ARR" valor={`€${Math.round(arr)}`} formula="MRR × 12." />
        <StatCard label="ARPU" valor={`€${arpuGlobal.toFixed(2)}`} formula="MRR ÷ clientes ativos." />
        <StatCard
          cor={taxaAteDia8 >= 0.8 ? PALETA.verde : PALETA.ambar}
          label="Pagamentos até ao dia 8"
          valor={Math.round(taxaAteDia8 * 100)}
          sufixo="%"
          formula="Pagamentos deste mês feitos até ao dia 8 ÷ total de pagamentos deste mês."
        />
      </div>

      <div className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Receita cobrada por mês · últimos {MESES_HISTORICO} meses
        </h2>
        <p className="mt-1 text-xs text-muted">
          Dinheiro efetivamente recebido em cada mês (não é MRR reconhecido por calendário de
          subscrição, que esta app ainda não modela).
        </p>
        <div className="mt-2 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
          <LineChart
            rotulosEixoX={meses.map((m) => `${m.slice(5)}/${m.slice(2, 4)}`)}
            series={seriesReceita}
          />
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Receita por ano</h2>
          <ExportarCsvButton
            colunas={[
              { chave: 'ano', label: 'Ano' },
              ...estudios.map((e) => ({ chave: `e${e.id}`, label: e.nome })),
              { chave: 'total', label: 'Total (€)' },
            ]}
            linhas={receitaPorAno.map((a) => ({
              ano: a.ano,
              total: Math.round(a.total * 100) / 100,
              ...Object.fromEntries(estudios.map((e) => [`e${e.id}`, Math.round((a.porEstudio.get(e.id) ?? 0) * 100) / 100])),
            }))}
            nomeFicheiro="receita-por-ano"
            className="text-xs text-muted underline hover:text-foreground"
          />
        </div>
        <div className="mt-2 overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-4 py-2 font-semibold">Ano</th>
                {estudios.map((e) => (
                  <th key={e.id} className="px-4 py-2 text-right font-semibold">{e.nome}</th>
                ))}
                <th className="px-4 py-2 text-right font-semibold">Total</th>
                <th className="px-4 py-2 text-right font-semibold">vs. ano anterior</th>
              </tr>
            </thead>
            <tbody>
              {receitaPorAno.map((a, i) => {
                const anterior = receitaPorAno[i + 1]
                const variacao = anterior && anterior.total > 0 ? (a.total - anterior.total) / anterior.total : null
                return (
                  <tr key={a.ano} className="border-t border-border-subtle">
                    <td className="px-4 py-2 font-semibold text-foreground">
                      {a.ano}
                      {a.mesesComReceita < 12 && (
                        <span className="ml-1.5 text-xs font-normal text-muted">({a.mesesComReceita} meses)</span>
                      )}
                    </td>
                    {estudios.map((e) => (
                      <td key={e.id} className="px-4 py-2 text-right tabular-nums">
                        €{Math.round(a.porEstudio.get(e.id) ?? 0).toLocaleString('pt-PT')}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-foreground">
                      €{Math.round(a.total).toLocaleString('pt-PT')}
                    </td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums ${
                        variacao == null ? 'text-muted' : variacao >= 0 ? 'text-teal-700 dark:text-teal-400' : 'text-red-600'
                      }`}
                    >
                      {variacao == null ? '—' : `${variacao >= 0 ? '+' : ''}${Math.round(variacao * 100)}%`}
                    </td>
                  </tr>
                )
              })}
              {receitaPorAno.length === 0 && (
                <tr>
                  <td colSpan={estudios.length + 3} className="px-4 py-6 text-center text-muted">
                    Sem pagamentos registados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          Inclui o histórico importado do Excel. Um ano incompleto (menos de 12 meses com receita) não é
          diretamente comparável com o anterior.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">MRR por estúdio</h2>
          <div className="mt-2 flex flex-col gap-2.5 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
            {estudios.map((e) => (
              <BarMeter
                key={e.id}
                label={e.nome}
                valor={Math.round(mrrPorEstudio.get(e.id) ?? 0)}
                total={Math.max(1, Math.round(mrr))}
                cor={corEstudio(e.slug).cor}
                mostrarPct={false}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            {estudios.map((e) => `${e.nome}: ${ativosPorEstudio.get(e.id) ?? 0} ativos`).join(' · ')}
          </p>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Margem por hora de PT</h2>
          <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
            <StatCard
              label="Receita / hora"
              valor={`€${margem.receitaPorHora.toFixed(2)}`}
              formula="Receita cobrada este mês ÷ horas de PT realizadas este mês."
            />
            <StatCard
              cor={margem.margemPorHora >= 0 ? PALETA.verde : PALETA.vermelho}
              label="Margem / hora"
              valor={`€${margem.margemPorHora.toFixed(2)}`}
              sufixo={`custo: €${margem.custoPorHora.toFixed(2)}`}
              formula="Receita por hora menos o custo por hora de PT (config.custo_hora_pt)."
            />
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Antiguidade da dívida</h2>
          <ExportarCsvButton
            colunas={[
              { chave: 'faixa', label: 'Faixa' },
              { chave: 'clientes', label: 'Clientes' },
              { chave: 'valorAproximado', label: 'Valor aproximado (€)' },
            ]}
            linhas={aging}
            nomeFicheiro="antiguidade-divida"
            className="text-xs text-muted underline hover:text-foreground"
          />
        </div>
        <div className="mt-2 flex flex-col gap-2.5 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
          {aging.map((f) => (
            <BarMeter
              key={f.faixa}
              label={f.faixa}
              valor={f.clientes}
              total={Math.max(1, clientesEmAtraso.length)}
              cor={PALETA.vermelho.tx}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Valor aproximado em atraso: €{Math.round(valorTotalEmAtraso)} (baseado no último pagamento
          conhecido de cada cliente, não numa fatura em dívida registada).
        </p>
      </div>

      <div className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Pagamentos deste mês com extras
        </h2>
        <div className="mt-2 flex flex-wrap gap-4 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card text-sm text-muted">
          <span>{addonsDoMes.inscricao} com inscrição</span>
          <span>{addonsDoMes.seguro} com seguro</span>
          <span>{addonsDoMes.reativacao} com reativação</span>
        </div>
        <p className="mt-2 text-xs text-muted">
          Não é possível decompor a receita por mensalidade/inscrição/seguro em €: cada pagamento
          guarda um valor total único, sem o detalhe por componente. CAC, LTV e rácio LTV/CAC ficam
          fora desta fase — dependem de custos de marketing que ainda não têm interface para serem
          registados.
        </p>
      </div>
    </div>
  )
}
