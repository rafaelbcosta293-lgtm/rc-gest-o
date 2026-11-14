import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { todasAsLinhas } from '@/lib/supabase/todasAsLinhas'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { getEstudios, filtrarPorEstudio } from '@/lib/data/estudios'
import { parseValorConfig } from '@/lib/data/financeiro'
import { carregarPagamentosAnalise } from '@/lib/data/cargaFinanceira'
import { baseClientesMensal, mesesEntre, mrrNormalizado, receitaMensal, somarMeses } from '@/lib/data/analiseFinanceira'
import type { Racios } from '@/lib/data/simulador'
import { desbloquearAdmin } from '../actions'
import PortaSenha from '@/components/PortaSenha'
import SimuladorForm, { type BaseReal } from './SimuladorForm'
import type { CenarioSimulador } from '@/lib/supabase/database.types'

const MESES_JANELA = 12

export default async function SimuladorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; erroSenha?: string; estudio?: string }>
}) {
  const { error, erroSenha, estudio: estudioParam } = await searchParams

  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'admin')
  const desbloqueada = protegida ? await areaDesbloqueada('admin') : true
  if (protegida && !desbloqueada) {
    return (
      <PortaSenha titulo="Administração — Simulador" destino="/painel/admin/simulador" action={desbloquearAdmin} erro={erroSenha} />
    )
  }

  const estudios = filtrarPorEstudio(await getEstudios(supabase), estudioParam)
  const ids = new Set(estudios.map((e) => e.id))
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date())
  const mesAtual = hoje.slice(0, 7)
  // Janela: os últimos 12 meses já fechados.
  const primeiroMes = somarMeses(mesAtual, -MESES_JANELA)
  const ultimoMes = somarMeses(mesAtual, -1)
  const meses = mesesEntre(`${primeiroMes}-01`, `${ultimoMes}-01`)
  const desde = `${primeiroMes}-01`
  const ate = `${mesAtual}-01`

  const [pagamentos, { data: cenariosData, error: erroCenarios }, leadsRes, registosRes, mktRes, { data: configData }] =
    await Promise.all([
      carregarPagamentosAnalise(supabase, ids),
      supabase.from('cenarios_simulador').select('*').order('criado_em', { ascending: false }),
      todasAsLinhas<{ estudio_id: number; entrada: string | null; criado_em: string }>((de, a) =>
        supabase.from('leads').select('estudio_id, entrada, criado_em').gte('criado_em', desde).order('id').range(de, a)
      ),
      todasAsLinhas<{ estudio_id: number; pt_id: string; data: string; horas: number }>(
        (de, a) =>
          supabase
            .from('registos_pt')
            .select('estudio_id, pt_id, data, horas')
            .gte('data', desde)
            .lt('data', ate)
            .order('id')
            .range(de, a),
        { emParalelo: 2 }
      ),
      supabase.from('marketing_costs').select('estudio_id, ano, mes, custo'),
      supabase.from('config').select('valor').eq('chave', 'custo_hora_pt').maybeSingle(),
    ])
  if (erroCenarios) throw new Error(erroCenarios.message)

  // ── Base de clientes, churn e preço médio (pagamentos) ─────────────
  const base = baseClientesMensal(pagamentos, meses)
  const receita = receitaMensal(pagamentos, meses)
  const somaAtivos = base.reduce((s, b) => s + b.ativos, 0)
  const somaReceita = receita.total.reduce((s, v) => s + v, 0)
  const churns = base.filter((b) => b.churn != null).map((b) => b.churn!)
  const churn = churns.length ? churns.reduce((s, v) => s + v, 0) / churns.length : 0.05
  const novosMes = base.reduce((s, b) => s + b.novos + b.reativados, 0) / Math.max(1, base.length)
  const arpu = somaAtivos > 0 ? somaReceita / somaAtivos : 0
  const { cobertos: clientesAtuais, mrr } = mrrNormalizado(pagamentos, hoje)

  // ── Leads e taxa de fecho ─────────────────────────────────────────
  const leads = leadsRes.data.filter((l) => ids.has(l.estudio_id) && (l.entrada ?? l.criado_em).slice(0, 10) < ate)
  const mesesComLeads = leads.length
    ? mesesEntre(leads.reduce((m, l) => ((l.entrada ?? l.criado_em) < m ? (l.entrada ?? l.criado_em) : m), ate), `${ultimoMes}-01`)
    : []
  const leadsMes = mesesComLeads.length ? leads.length / mesesComLeads.length : null
  const novosNaJanelaLeads = base
    .filter((b) => mesesComLeads.includes(b.mes))
    .reduce((s, b) => s + b.novos + b.reativados, 0)
  const taxaFecho = leadsMes && leads.length ? Math.min(1, novosNaJanelaLeads / leads.length) : null

  // ── Horas de PT ──────────────────────────────────────────────────
  const registos = registosRes.data.filter((r) => ids.has(r.estudio_id))
  const horasTotais = registos.reduce((s, r) => s + Number(r.horas), 0)
  const ptsPorMes = new Map<string, Set<string>>()
  for (const r of registos) {
    const m = r.data.slice(0, 7)
    const set = ptsPorMes.get(m) ?? new Set<string>()
    set.add(r.pt_id)
    ptsPorMes.set(m, set)
  }
  const ptMeses = [...ptsPorMes.values()].reduce((s, set) => s + set.size, 0)
  const horasPorPt = ptMeses > 0 ? horasTotais / ptMeses : null
  const mesesComHoras = new Set(registos.map((r) => r.data.slice(0, 7)))
  const ativosNosMesesComHoras = base.filter((b) => mesesComHoras.has(b.mes)).reduce((s, b) => s + b.ativos, 0)
  const horasPtPorCliente = ativosNosMesesComHoras > 0 ? horasTotais / ativosNosMesesComHoras : null
  const ultimoMesPts = [...ptsPorMes.keys()].sort().pop()
  const ptsAtuais = ultimoMesPts ? ptsPorMes.get(ultimoMesPts)!.size : null

  // ── Marketing ────────────────────────────────────────────────────
  const custoMkt = (mktRes.data ?? [])
    .filter((m) => ids.has(m.estudio_id) && `${m.ano}-${String(m.mes).padStart(2, '0')}` >= primeiroMes && `${m.ano}-${String(m.mes).padStart(2, '0')}` <= ultimoMes)
    .reduce((s, m) => s + Number(m.custo), 0)
  const custoPorLead = custoMkt > 0 && leads.length > 0 ? custoMkt / leads.length : null

  const custoHoraPt = parseValorConfig(configData?.valor) ?? 0

  // Rácios reais (com valores de referência só onde ainda não há dados).
  const racios: Racios = {
    taxaFecho: taxaFecho ?? 0.15,
    churn,
    arpu: Math.round(arpu * 100) / 100,
    horasPtPorCliente: horasPtPorCliente != null ? Math.round(horasPtPorCliente * 10) / 10 : 4,
    horasPorPt: horasPorPt != null ? Math.round(horasPorPt) : 120,
    custoHoraPt,
    custoPorLead: custoPorLead != null ? Math.round(custoPorLead * 100) / 100 : 0,
    custosFixos: 0,
  }
  const baseReal: BaseReal = {
    racios,
    leadsMes: leadsMes ?? (racios.taxaFecho > 0 ? novosMes / racios.taxaFecho : 0),
    clientesAtuais,
    mrrAtual: mrr,
    novosMes,
    ptsAtuais,
    semDados: {
      taxaFecho: taxaFecho == null,
      horasPtPorCliente: horasPtPorCliente == null,
      horasPorPt: horasPorPt == null,
      custoPorLead: custoPorLead == null,
      custoHoraPt: custoHoraPt === 0,
    },
    janela: `${meses[0]} a ${meses[meses.length - 1]}`,
  }

  const cenarios = (cenariosData ?? []) as CenarioSimulador[]

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/painel/admin" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Administração
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Simulador &quot;E se…&quot;</h1>
      <p className="mt-1 text-sm text-muted">
        Parte dos rácios reais de {estudios.map((e) => e.nome).join(' + ')} (últimos 12 meses fechados). Muda um rácio ou
        uma meta — tudo o resto é recalculado com os rácios atuais do negócio.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>
      )}

      <SimuladorForm base={baseReal} cenarios={cenarios} />
    </div>
  )
}
