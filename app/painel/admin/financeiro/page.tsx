import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEstudios } from '@/lib/data/estudios'
import { intervaloMes } from '@/lib/data/presencas'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { desbloquearAdmin } from '../actions'
import { PALETA, corEstudio } from '@/lib/data/constantes'
import {
  mrrAtual,
  receitaPorMes,
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

const MESES_HISTORICO = 6

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; erroSenha?: string }>
}) {
  const { erroSenha } = await searchParams

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

  const estudios = await getEstudios(supabase)
  const hoje = new Date().toISOString().slice(0, 10)
  const ano = Number(hoje.slice(0, 4))
  const mes = Number(hoje.slice(5, 7))
  const { inicio, fimExclusivo } = intervaloMes(ano, mes)
  const meses = ultimosMeses(hoje, MESES_HISTORICO)
  const inicioHistorico = `${meses[0]}-01`

  const [
    { data: clientesData, error: erroClientes },
    { data: pagamentosData, error: erroPagamentos },
    { data: registosData, error: erroRegistos },
    { data: configData, error: erroConfig },
  ] = await Promise.all([
    supabase.from('clientes').select('id, estudio_id, estado'),
    supabase
      .from('pagamentos')
      .select('cliente_id, valor, data_pagamento, valido_ate, inclui_inscricao, inclui_seguro, inclui_reativacao')
      .gte('data_pagamento', inicioHistorico)
      .order('data_pagamento', { ascending: false }),
    supabase.from('registos_pt').select('horas').gte('data', inicio).lt('data', fimExclusivo),
    supabase.from('config').select('valor').eq('chave', 'custo_hora_pt').maybeSingle(),
  ])

  for (const erro of [erroClientes, erroPagamentos, erroRegistos, erroConfig]) {
    if (erro) throw new Error(erro.message)
  }

  const clientes = clientesData ?? []
  const pagamentos = pagamentosData ?? []
  const estudioPorCliente = new Map(clientes.map((c) => [c.id, c.estudio_id]))
  const ativosPorEstudio = new Map<number, number>()
  for (const c of clientes) {
    if (c.estado === 'Ativo') ativosPorEstudio.set(c.estudio_id, (ativosPorEstudio.get(c.estudio_id) ?? 0) + 1)
  }
  const totalAtivos = clientes.filter((c) => c.estado === 'Ativo').length

  // Pagamento mais recente de cada cliente — base do MRR "reconhecido".
  const maisRecentePorCliente = new Map<string, { valor: number; valido_ate: string }>()
  for (const p of pagamentos) {
    if (!maisRecentePorCliente.has(p.cliente_id)) {
      maisRecentePorCliente.set(p.cliente_id, { valor: p.valor, valido_ate: p.valido_ate })
    }
  }
  const mrr = mrrAtual(Array.from(maisRecentePorCliente.values()), hoje)
  const arr = mrr * 12
  const arpuGlobal = arpu(mrr, totalAtivos)

  const mrrPorEstudio = new Map<number, number>()
  for (const [clienteId, pag] of maisRecentePorCliente) {
    if (pag.valido_ate < hoje) continue
    const estudioId = estudioPorCliente.get(clienteId)
    if (estudioId == null) continue
    mrrPorEstudio.set(estudioId, (mrrPorEstudio.get(estudioId) ?? 0) + pag.valor)
  }

  const receitaHistorico = receitaPorMes(pagamentos, meses)

  const pagamentosDoMes = pagamentos.filter((p) => p.data_pagamento >= inicio && p.data_pagamento < fimExclusivo)
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
  const horasTotais = (registosData ?? []).reduce((soma, r) => soma + r.horas, 0)
  const receitaDoMes = pagamentosDoMes.reduce((soma, p) => soma + p.valor, 0)
  const margem = margemPorHora(receitaDoMes, horasTotais, custoHoraPt)

  const addonsDoMes = {
    inscricao: pagamentosDoMes.filter((p) => p.inclui_inscricao).length,
    seguro: pagamentosDoMes.filter((p) => p.inclui_seguro).length,
    reativacao: pagamentosDoMes.filter((p) => p.inclui_reativacao).length,
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href="/painel/admin"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Administração
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">Financeiro</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Fátima + Leiria · {totalAtivos} clientes ativos
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="MRR" valor={`€${Math.round(mrr)}`} aoVivo />
        <StatCard label="ARR" valor={`€${Math.round(arr)}`} />
        <StatCard label="ARPU" valor={`€${arpuGlobal.toFixed(2)}`} />
        <StatCard
          cor={taxaAteDia8 >= 0.8 ? PALETA.verde : PALETA.ambar}
          label="Pagamentos até ao dia 8"
          valor={Math.round(taxaAteDia8 * 100)}
          sufixo="%"
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
            rotulosEixoX={meses.map((m) => m.slice(5))}
            series={[{ nome: 'Receita cobrada (€)', cor: PALETA.verde.tx, valores: receitaHistorico }]}
          />
        </div>
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
            <StatCard label="Receita / hora" valor={`€${margem.receitaPorHora.toFixed(2)}`} />
            <StatCard
              cor={margem.margemPorHora >= 0 ? PALETA.verde : PALETA.vermelho}
              label="Margem / hora"
              valor={`€${margem.margemPorHora.toFixed(2)}`}
              sufixo={`custo: €${margem.custoPorHora.toFixed(2)}`}
            />
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Antiguidade da dívida</h2>
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
