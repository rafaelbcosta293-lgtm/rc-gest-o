import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEquipaDoEstudio } from '@/lib/data/estudios'
import { intervaloMes, diasDoMes } from '@/lib/data/presencas'
import { PALETA } from '@/lib/data/constantes'
import {
  ocupacaoPorPt,
  retencaoEAssiduidadePorPt,
  resumoReavaliacoes,
  coberturaChecklist,
} from '@/lib/data/operacional'
import StatCard from '@/components/StatCard'
import BarMeter from '@/components/BarMeter'
import RadialProgress from '@/components/RadialProgress'

export default async function OperacionalPage({
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
  const diaDoMes = Number(hoje.slice(8, 10))
  const diasDoMesAteHoje = diasDoMes(ano, mes).slice(0, diaDoMes)

  const pts = await getEquipaDoEstudio(supabase, estudio.id)

  const [
    { data: registosData, error: erroRegistos },
    { data: escalasData, error: erroEscalas },
    { data: clientesData, error: erroClientes },
    { data: avaliacoesData, error: erroAvaliacoes },
    { data: checklistData, error: erroChecklist },
  ] = await Promise.all([
    supabase
      .from('registos_pt')
      .select('pt_id, horas, treinos_40, treinos_60')
      .eq('estudio_id', estudio.id)
      .gte('data', inicio)
      .lt('data', fimExclusivo),
    supabase
      .from('escalas')
      .select('pt_id')
      .eq('estudio_id', estudio.id)
      .gte('data', inicio)
      .lt('data', fimExclusivo),
    supabase
      .from('clientes')
      .select('id, pt_principal_id, estado, frequencia_semanal')
      .eq('estudio_id', estudio.id),
    supabase.from('avaliacoes').select('cliente_id, data, proxima_reavaliacao').order('data', { ascending: false }),
    supabase.from('checklist_registos').select('tipo, data').eq('estudio_id', estudio.id),
  ])

  for (const erro of [erroRegistos, erroEscalas, erroClientes, erroAvaliacoes, erroChecklist]) {
    if (erro) throw new Error(erro.message)
  }

  const clientes = clientesData ?? []
  const clienteIds = new Set(clientes.map((c) => c.id))

  const { data: presencasData, error: erroPresencas } =
    clienteIds.size > 0
      ? await supabase
          .from('presencas')
          .select('cliente_id, data, estado')
          .in('cliente_id', Array.from(clienteIds))
          .gte('data', inicio)
          .lt('data', fimExclusivo)
      : { data: [], error: null }
  if (erroPresencas) throw new Error(erroPresencas.message)

  const presencasPorCliente = new Map<string, { data: string; estado: string }[]>()
  for (const p of presencasData ?? []) {
    const lista = presencasPorCliente.get(p.cliente_id) ?? []
    lista.push(p)
    presencasPorCliente.set(p.cliente_id, lista)
  }

  const ocupacao = ocupacaoPorPt(registosData ?? [], escalasData ?? [], pts)
  const produtividade = retencaoEAssiduidadePorPt(clientes, presencasPorCliente, ano, mes, pts)
  const registosPorPt = new Map((registosData ?? []).map((r) => [r.pt_id, r]))

  const avaliacoesDoMes = (avaliacoesData ?? []).filter((a) => a.data >= inicio && a.data < fimExclusivo).length
  const reavaliacaoPorCliente = new Map<string, string | null>()
  for (const a of avaliacoesData ?? []) {
    if (clienteIds.has(a.cliente_id) && !reavaliacaoPorCliente.has(a.cliente_id)) {
      reavaliacaoPorCliente.set(a.cliente_id, a.proxima_reavaliacao)
    }
  }
  const reavaliacoes = resumoReavaliacoes(avaliacoesDoMes, Array.from(reavaliacaoPorCliente.values()), hoje)

  const abertura = coberturaChecklist(checklistData ?? [], 'Abertura', diasDoMesAteHoje)
  const fecho = coberturaChecklist(checklistData ?? [], 'Fecho', diasDoMesAteHoje)

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link
        href={`/painel/${slug}/equipa`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Equipa
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">Painel operacional</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{estudio.nome} · este mês</p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Avaliações feitas" valor={reavaliacoes.feitas} />
        <StatCard cor={PALETA.ambar} label="Reavaliações a vencer" valor={reavaliacoes.aVencer} />
        <StatCard cor={PALETA.vermelho} label="Reavaliações atrasadas" valor={reavaliacoes.atrasadas} />
        <StatCard
          cor={abertura.submetidos === abertura.esperados ? PALETA.verde : PALETA.ambar}
          label="Aberturas em falta"
          valor={abertura.esperados - abertura.submetidos}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
          <RadialProgress
            valor={(abertura.submetidos / Math.max(1, abertura.esperados)) * 100}
            tamanho={52}
            espessura={5}
            cor={PALETA.teal.tx}
          />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Aberturas submetidas</p>
            <p className="mt-1 font-mono text-xs tabular-nums text-muted">
              {abertura.submetidos} de {abertura.esperados} dias
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
          <RadialProgress
            valor={(fecho.submetidos / Math.max(1, fecho.esperados)) * 100}
            tamanho={52}
            espessura={5}
            cor={PALETA.laranja.tx}
          />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Fechos submetidos</p>
            <p className="mt-1 font-mono text-xs tabular-nums text-muted">
              {fecho.submetidos} de {fecho.esperados} dias
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Ocupação por PT</h2>
        <div className="mt-2 flex flex-col gap-2.5 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
          {ocupacao.map((o) => (
            <div key={o.ptId}>
              <BarMeter
                label={o.nome}
                valor={Math.round(o.horasRealizadas)}
                total={Math.max(1, Math.round(o.horasDisponiveis))}
                mostrarPct={false}
              />
              <p className="mt-0.5 text-right text-[11px] text-muted">
                {o.ocupacao != null ? `${Math.round(o.ocupacao * 100)}% de ocupação` : 'sem escala este mês'}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Produtividade por PT (sem valores)
        </h2>
        <div className="mt-2 overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-3 py-2">PT</th>
                <th className="px-3 py-2">Horas</th>
                <th className="px-3 py-2">Treinos 40&apos;</th>
                <th className="px-3 py-2">Treinos 60&apos;</th>
                <th className="px-3 py-2">Retenção</th>
                <th className="px-3 py-2">Assiduidade média</th>
              </tr>
            </thead>
            <tbody>
              {produtividade.map((p) => {
                const r = registosPorPt.get(p.ptId)
                return (
                  <tr key={p.ptId} className="border-t border-border-subtle">
                    <td className="px-3 py-2 font-medium text-foreground">{p.nome}</td>
                    <td className="px-3 py-2 text-muted">{r?.horas ?? 0}</td>
                    <td className="px-3 py-2 text-muted">{r?.treinos_40 ?? 0}</td>
                    <td className="px-3 py-2 text-muted">{r?.treinos_60 ?? 0}</td>
                    <td className="px-3 py-2 text-muted">
                      {p.retencao != null ? `${Math.round(p.retencao * 100)}%` : '—'}
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {p.assiduidadeMedia != null ? `${Math.round(p.assiduidadeMedia * 100)}%` : '—'}
                    </td>
                  </tr>
                )
              })}
              {produtividade.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-muted">
                    Sem clientes atribuídos a um PT principal.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          Ocupação dos Blocos Exclusivos e manutenção de máquinas ficam de fora: nenhum dos dois
          módulos existe ainda nesta app.
        </p>
      </div>
    </div>
  )
}
