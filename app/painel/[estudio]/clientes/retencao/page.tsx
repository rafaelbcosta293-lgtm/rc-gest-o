import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { intervaloMes, treinosPrevistos, fmt } from '@/lib/data/presencas'
import { somarDias } from '@/lib/data/horarios'
import { PALETA } from '@/lib/data/constantes'
import {
  resumoMensalClientes,
  churnMensal,
  cancelamentoFimExperiencia,
  tempoMedioDeVidaMeses,
  mixFrequencia,
  matrizCoorte,
  scoreRisco,
  type ClienteParaRetencao,
} from '@/lib/data/retencao'
import StatCard from '@/components/StatCard'
import BarMeter from '@/components/BarMeter'

const JANELA_DESMARCACOES_DIAS = 60

export default async function RetencaoPage({
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

  const hoje = new Date().toISOString().slice(0, 10)
  const ano = Number(hoje.slice(0, 4))
  const mes = Number(hoje.slice(5, 7))
  const { inicio, fimExclusivo } = intervaloMes(ano, mes)
  const limiteDesmarcacoes = somarDias(hoje, -JANELA_DESMARCACOES_DIAS)

  const [
    { data: clientesData, error: erroClientes },
    { data: atividadesData, error: erroAtividades },
    { data: presencasData, error: erroPresencas },
    { data: eventosData, error: erroEventos },
    { data: avaliacoesData, error: erroAvaliacoes },
    { data: pagamentosData, error: erroPagamentos },
  ] = await Promise.all([
    supabase
      .from('clientes')
      .select('id, estado, frequencia_semanal, inicio_contrato, fim_experiencia, saiu_em')
      .eq('estudio_id', estudio.id),
    supabase
      .from('activities')
      .select('tipo, criado_em, cliente_id')
      .eq('estudio_id', estudio.id)
      .in('tipo', ['Cancelamento', 'Suspensão', 'Reativação']),
    supabase.from('presencas').select('cliente_id, data, estado'),
    supabase.from('agenda_eventos').select('cliente_id, data, estado, tipo').eq('tipo', 'Treino'),
    supabase.from('avaliacoes').select('cliente_id, data, proxima_reavaliacao').order('data', { ascending: false }),
    supabase.from('v_estado_pagamento').select('cliente_id, em_dia').eq('estudio_id', estudio.id),
  ])

  for (const erro of [erroClientes, erroAtividades, erroPresencas, erroEventos, erroAvaliacoes, erroPagamentos]) {
    if (erro) throw new Error(erro.message)
  }

  const clientes = (clientesData ?? []) as ClienteParaRetencao[]
  const atividades = atividadesData ?? []

  const resumoMes = resumoMensalClientes(clientes, atividades, inicio, fimExclusivo)
  const churn = churnMensal(resumoMes.ativos, resumoMes.cancelados)
  const fimExperiencia = cancelamentoFimExperiencia(clientes, hoje)
  const vidaMedia = tempoMedioDeVidaMeses(clientes)
  const mix = mixFrequencia(clientes)
  const coortes = matrizCoorte(clientes, hoje, 12)
  const colunasCoorteComDados = Math.max(1, ...coortes.map((l) => l.retencaoPorMes.filter((v) => v !== null).length))

  // --- Score de risco, só para clientes ativos ---
  const presencasPorCliente = new Map<string, { data: string; estado: string }[]>()
  for (const p of presencasData ?? []) {
    const lista = presencasPorCliente.get(p.cliente_id) ?? []
    lista.push(p)
    presencasPorCliente.set(p.cliente_id, lista)
  }
  const clientesComTreinoFuturo = new Set(
    (eventosData ?? [])
      .filter((e) => e.estado === 'Agendado' && e.data >= hoje && e.cliente_id)
      .map((e) => e.cliente_id as string)
  )
  const reavaliacaoPorCliente = new Map<string, string | null>()
  for (const a of avaliacoesData ?? []) {
    if (!reavaliacaoPorCliente.has(a.cliente_id)) reavaliacaoPorCliente.set(a.cliente_id, a.proxima_reavaliacao)
  }
  const emDiaPorCliente = new Map((pagamentosData ?? []).map((p) => [p.cliente_id, p.em_dia]))

  const risco = clientes
    .filter((c) => c.estado === 'Ativo')
    .map((c) => {
      const presencas = (presencasPorCliente.get(c.id) ?? []).filter((p) => p.data >= inicio && p.data < fimExclusivo)
      const realizados = presencas.filter((p) => p.estado === 'Presente').length
      const alvo = treinosPrevistos(c.frequencia_semanal, ano, mes)?.arredondado ?? null
      const quebraAssiduidade = alvo ? Math.max(0, 1 - realizados / alvo) : 0
      const desmarcacoesRecentes = (presencasPorCliente.get(c.id) ?? []).filter(
        (p) => p.data >= limiteDesmarcacoes && p.estado === 'Remarcado'
      ).length
      const reavaliacao = reavaliacaoPorCliente.get(c.id) ?? null
      const diasParaFimExperiencia = c.fim_experiencia
        ? Math.round(
            (new Date(`${c.fim_experiencia}T00:00:00`).getTime() - new Date(`${hoje}T00:00:00`).getTime()) /
              86_400_000
          )
        : null

      return {
        id: c.id,
        score: scoreRisco({
          quebraAssiduidade,
          desmarcacoesRecentes,
          temTreinoAgendado: clientesComTreinoFuturo.has(c.id),
          emDia: emDiaPorCliente.get(c.id) ?? true,
          reavaliacaoVencida: reavaliacao !== null && reavaliacao < hoje,
          diasParaFimExperiencia,
        }),
      }
    })
    .filter((r) => r.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)

  const { data: nomesData } = risco.length
    ? await supabase.from('clientes').select('id, nome').in('id', risco.map((r) => r.id))
    : { data: [] }
  const nomePorId = new Map((nomesData ?? []).map((c) => [c.id, c.nome]))

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link
        href={`/painel/${slug}/clientes`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-foreground">Clientes e retenção</h1>
      <p className="mt-1 text-sm text-muted">{estudio.nome}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Ativos" valor={resumoMes.ativos} aoVivo />
        <StatCard cor={PALETA.verde} label="Novos este mês" valor={resumoMes.novos} />
        <StatCard cor={PALETA.vermelho} label="Cancelados" valor={resumoMes.cancelados} />
        <StatCard cor={PALETA.ambar} label="Suspensos" valor={resumoMes.suspensos} />
        <StatCard cor={PALETA.teal} label="Reativados" valor={resumoMes.reativados} />
        <StatCard
          label="Vida média"
          valor={vidaMedia != null ? vidaMedia.toFixed(1) : '—'}
          sufixo="meses"
          formula="Média, em meses, de saiu_em − inicio_contrato, só de quem já saiu."
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          cor={churn > 0.05 ? PALETA.vermelho : PALETA.verde}
          label="Churn mensal (aproximado)"
          valor={Math.round(churn * 100)}
          sufixo="%"
          formula="Cancelados este mês ÷ (ativos agora + cancelados este mês) — aproximação, sem snapshot do início do mês."
        />
        <StatCard
          label="Cancelamento no fim da experiência"
          valor={Math.round(fimExperiencia.taxa * 100)}
          sufixo={`% (${fimExperiencia.cancelados}/${fimExperiencia.total})`}
          formula="Clientes cuja saída caiu a ±7 dias do fim da experiência ÷ clientes com experiência já terminada."
        />
      </div>

      <div className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Mix por frequência</h2>
        <div className="mt-2 flex flex-col gap-2.5 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
          {mix.map((m) => (
            <BarMeter key={m.frequencia} label={m.frequencia} valor={m.total} total={clientes.length} />
          ))}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Clientes em risco de saída
        </h2>
        <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-border-subtle bg-surface p-2 shadow-card">
          {risco.length === 0 && <p className="p-3 text-sm text-muted">Nenhum cliente com risco alto agora.</p>}
          {risco.map((r) => (
            <Link
              key={r.id}
              href={`/painel/${slug}/clientes/${r.id}`}
              className="flex items-center justify-between gap-3 rounded-xl p-3 text-sm hover:bg-brand/[.06]"
            >
              <span className="flex items-center gap-2 font-medium text-foreground">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                {nomePorId.get(r.id) ?? '—'}
              </span>
              <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: PALETA.vermelho.bg, color: PALETA.vermelho.tx }}>
                {r.score}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Coortes de retenção (mês de entrada × meses depois)
        </h2>
        <div className="mt-2 overflow-x-auto rounded-2xl border border-border-subtle bg-surface p-2 shadow-card">
          <table className="text-sm">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-xs text-muted">Entrada</th>
                <th className="px-2 py-1 text-left text-xs text-muted">Nº</th>
                {Array.from({ length: colunasCoorteComDados }, (_, i) => (
                  <th key={i} className="px-2 py-1 text-xs text-muted">
                    M{i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coortes.map((linha) => (
                <tr key={linha.cohort} className="border-t border-border-subtle">
                  <td className="px-2 py-1 font-medium text-foreground">{linha.cohort}</td>
                  <td className="px-2 py-1 text-muted">{linha.tamanho}</td>
                  {linha.retencaoPorMes.slice(0, colunasCoorteComDados).map((v, i) => (
                    <td key={i} className="px-2 py-1 text-center">
                      {v == null ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span
                          className="rounded px-1.5 py-0.5 text-xs font-medium"
                          style={{ background: PALETA.teal.bg, color: PALETA.teal.tx, opacity: 0.4 + 0.6 * v }}
                        >
                          {Math.round(v * 100)}%
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {coortes.length === 0 && (
                <tr>
                  <td colSpan={2 + colunasCoorteComDados} className="px-2 py-4 text-center text-muted">
                    Sem dados suficientes ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          Última atualização: {fmt(hoje)}. &quot;Mix por modalidade&quot; e a comparação face à mesma altura
          do ano anterior ficam para uma fase seguinte.
        </p>
      </div>
    </div>
  )
}
