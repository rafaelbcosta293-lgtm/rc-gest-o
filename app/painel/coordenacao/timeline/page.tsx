import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEstudios } from '@/lib/data/estudios'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { desbloquearCoordenacao } from '../actions'
import { fmt } from '@/lib/data/presencas'
import { somarDias } from '@/lib/data/horarios'
import { PALETA } from '@/lib/data/constantes'
import { criarMarco, apagarMarco } from './actions'
import PortaSenha from '@/components/PortaSenha'
import SubmitButton from '@/components/SubmitButton'
import LineChart from '@/components/LineChart'
import type { MarcoEmpresa, TipoMarcoEmpresa, KpiSnapshotDiario } from '@/lib/supabase/database.types'

const TIPOS_MARCO: TipoMarcoEmpresa[] = ['Campanha', 'Preço', 'Equipa', 'Meta', 'Outro']
const DIAS_HISTORICO = 60

export default async function TimelineEmpresaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; erroSenha?: string }>
}) {
  const { error, erroSenha } = await searchParams

  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'coordenacao')
  const desbloqueada = protegida ? await areaDesbloqueada('coordenacao') : true
  if (protegida && !desbloqueada) {
    return (
      <PortaSenha
        titulo="Coordenação — Timeline"
        destino="/painel/coordenacao/timeline"
        action={desbloquearCoordenacao}
        erro={erroSenha}
      />
    )
  }

  const estudios = await getEstudios(supabase)
  const hoje = new Date().toISOString().slice(0, 10)
  const inicioHistorico = somarDias(hoje, -DIAS_HISTORICO)

  const [{ data: marcosData, error: erroMarcos }, { data: snapshotsData, error: erroSnapshots }] =
    await Promise.all([
      supabase.from('marcos_empresa').select('*').order('data', { ascending: false }),
      supabase.from('kpi_snapshots_daily').select('*').gte('data', inicioHistorico).order('data', { ascending: true }),
    ])

  if (erroMarcos) throw new Error(erroMarcos.message)
  if (erroSnapshots) throw new Error(erroSnapshots.message)

  const marcos = (marcosData ?? []) as MarcoEmpresa[]
  const snapshots = (snapshotsData ?? []) as KpiSnapshotDiario[]

  const diasComDados = Array.from(new Set(snapshots.map((s) => s.data))).sort()
  const leadsNovasPorDia = diasComDados.map((d) =>
    snapshots.filter((s) => s.data === d).reduce((soma, s) => soma + (Number(s.metricas.leads_novas) || 0), 0)
  )
  const vendasPorDia = diasComDados.map((d) =>
    snapshots.filter((s) => s.data === d).reduce((soma, s) => soma + (Number(s.metricas.vendas) || 0), 0)
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href="/painel/coordenacao"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Coordenação
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-foreground">Timeline da empresa</h1>
      <p className="mt-1 text-sm text-muted">Fátima + Leiria</p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Leads novas e vendas por dia · últimos {DIAS_HISTORICO} dias
        </h2>
        <div className="mt-2 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
          {diasComDados.length === 0 ? (
            <p className="text-sm text-muted">
              Ainda sem histórico — o snapshot diário (kpi_snapshots_daily) começa a acumular a
              partir de hoje. Os zoom de semana/mês/ano ficam para quando houver dados suficientes
              para fazer diferença.
            </p>
          ) : (
            <LineChart
              rotulosEixoX={diasComDados.map((d) => d.slice(8, 10))}
              series={[
                { nome: 'Leads novas', cor: PALETA.azul.tx, valores: leadsNovasPorDia },
                { nome: 'Vendas', cor: PALETA.verde.tx, valores: vendasPorDia },
              ]}
            />
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Adicionar marco</h2>
        <form action={criarMarco} className="mt-2 flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              name="titulo"
              required
              placeholder="ex.: Campanha Instagram outubro"
              className="rounded-md border border-border-subtle px-3 py-2 text-sm dark:bg-zinc-900"
            />
            <input
              type="date"
              name="data"
              required
              defaultValue={hoje}
              className="rounded-md border border-border-subtle px-3 py-2 text-sm dark:bg-zinc-900"
            />
            <select
              name="tipo"
              defaultValue="Outro"
              className="rounded-md border border-border-subtle px-3 py-2 text-sm dark:bg-zinc-900"
            >
              {TIPOS_MARCO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              name="estudio_id"
              defaultValue=""
              className="rounded-md border border-border-subtle px-3 py-2 text-sm dark:bg-zinc-900"
            >
              <option value="">Ambos os estúdios</option>
              {estudios.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <textarea
            name="descricao"
            rows={2}
            placeholder="Notas (opcional)"
            className="rounded-md border border-border-subtle px-3 py-2 text-sm dark:bg-zinc-900"
          />
          <SubmitButton
            pendingText="A guardar…"
            className="self-start rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black shadow-pop hover:bg-brand-strong"
          >
            Adicionar
          </SubmitButton>
        </form>
      </div>

      <div className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Marcos ({marcos.length})</h2>
        <div className="mt-2 flex flex-col gap-2">
          {marcos.length === 0 && (
            <div className="rounded-xl border border-dashed border-border-subtle p-6 text-center text-sm text-zinc-500">
              Ainda não há marcos registados.
            </div>
          )}
          {marcos.map((m) => {
            const estudio = estudios.find((e) => e.id === m.estudio_id)
            return (
              <div
                key={m.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border-subtle bg-surface p-3 text-sm"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>{fmt(m.data)}</span>
                    <span>· {m.tipo}</span>
                    <span>· {estudio ? estudio.nome : 'Ambos'}</span>
                  </div>
                  <p className="mt-1 font-medium text-foreground">{m.titulo}</p>
                  {m.descricao && <p className="mt-0.5 text-xs text-muted">{m.descricao}</p>}
                </div>
                <form action={apagarMarco}>
                  <input type="hidden" name="id" value={m.id} />
                  <button
                    type="submit"
                    aria-label="Apagar marco"
                    className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
