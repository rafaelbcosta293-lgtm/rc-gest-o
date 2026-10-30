import Link from 'next/link'
import {
  ArrowLeft,
  Megaphone,
  TrendingUp,
  UserPlus,
  Euro,
  UserCheck,
  PauseCircle,
  UserMinus,
  CalendarCheck2,
} from 'lucide-react'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getEstudios } from '@/lib/data/estudios'
import { MESES } from '@/lib/data/presencas'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { desbloquearAdmin } from './actions'
import { corEstudio, PALETA } from '@/lib/data/constantes'
import PortaSenha from '@/components/PortaSenha'
import TituloSeccao from '@/components/TituloSeccao'
import StatCard from '@/components/StatCard'
import type { Cliente, Estudio, Lead } from '@/lib/supabase/database.types'

type ClienteResumo = Pick<Cliente, 'id' | 'nome' | 'estado' | 'inicio_contrato'>
type LeadResumo = Pick<Lead, 'estado' | 'entrada' | 'fecho_em' | 'visita_data'>
type SP = Record<string, string | undefined>

// Cada estúdio navega o seu próprio mês/dia nesta página combinada, sem
// mexer no do outro — os parâmetros vêm prefixados com o slug
// ("fatima_mes", "leiria_dia", …) e comQuery preserva tudo o resto.
function comQuery(sp: SP, overrides: Record<string, string | undefined>) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (v !== undefined) params.set(k, v)
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) params.delete(k)
    else params.set(k, v)
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<SP>
}) {
  const sp = await searchParams
  const { error, erroSenha } = sp

  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'admin')
  const desbloqueada = protegida ? await areaDesbloqueada('admin') : true
  if (protegida && !desbloqueada) {
    return (
      <PortaSenha titulo="Administração" destino="/painel/admin" action={desbloquearAdmin} erro={erroSenha} />
    )
  }

  const estudios = await getEstudios(supabase)

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href="/painel"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Administração</h1>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
        <span className="live-dot" aria-hidden />
        {estudios.map((e) => e.nome).join(' e ')} · dados do negócio e pendências, ao vivo.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-2">
        {estudios.map((estudio) => (
          <section key={estudio.id}>
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: corEstudio(estudio.slug).cor }}
              />
              <h2 className="text-lg font-semibold text-foreground">{estudio.nome}</h2>
            </div>
            <Suspense fallback={<EsqueletoEstudio />}>
              <PainelAdminEstudio estudio={estudio} sp={sp} />
            </Suspense>
          </section>
        ))}
      </div>

      <TituloSeccao cor="azul">Relatórios</TituloSeccao>
      <Link
        href="/painel/admin/relatorio"
        className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface p-4 transition-colors hover:border-border-strong"
      >
        <span className="text-sm text-foreground">Relatório mensal consolidado (para imprimir/PDF)</span>
        <span className="text-sm text-muted">→</span>
      </Link>

      <TituloSeccao cor="verde">Financeiro</TituloSeccao>
      <Link
        href="/painel/admin/financeiro"
        className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface p-4 transition-colors hover:border-border-strong"
      >
        <span className="text-sm text-foreground">MRR, ARPU, margem e antiguidade da dívida</span>
        <span className="text-sm text-muted">→</span>
      </Link>

      <Link
        href="/painel/admin/simulador"
        className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface p-4 transition-colors hover:border-border-strong"
      >
        <span className="text-sm text-foreground">Simulador &quot;E se…&quot; (cenários hipotéticos)</span>
        <span className="text-sm text-muted">→</span>
      </Link>

      <TituloSeccao cor="roxo">Serviços / Produtos</TituloSeccao>
      <Link
        href="/painel/admin/servicos"
        className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface p-4 transition-colors hover:border-border-strong"
      >
        <span className="text-sm text-foreground">Gerir valores, planos e serviços</span>
        <span className="text-sm text-muted">→</span>
      </Link>

      <TituloSeccao cor="neutro">Auditoria</TituloSeccao>
      <Link
        href="/painel/admin/auditoria"
        className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface p-4 transition-colors hover:border-border-strong"
      >
        <span className="text-sm text-foreground">Quem alterou pagamentos, planos e preços</span>
        <span className="text-sm text-muted">→</span>
      </Link>

      <TituloSeccao cor="neutro">Contas</TituloSeccao>
      <Link
        href="/painel/admin/contas"
        className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface p-4 transition-colors hover:border-border-strong"
      >
        <span className="text-sm text-foreground">Palavra-passe das contas de login dos estúdios</span>
        <span className="text-sm text-muted">→</span>
      </Link>
    </div>
  )
}

// Mostra já a estrutura da secção (os títulos a cinzento, sem dados)
// enquanto as consultas deste estúdio correm — a página não fica em
// branco à espera do estúdio mais lento.
function EsqueletoEstudio() {
  return (
    <div className="mt-2 animate-pulse space-y-8">
      {[0, 1, 2, 3].map((i) => (
        <div key={i}>
          <div className="h-3 w-24 rounded bg-border-subtle" />
          <div className="mt-2 h-16 rounded-xl border border-border-subtle bg-border-subtle" />
        </div>
      ))}
    </div>
  )
}

async function PainelAdminEstudio({
  estudio,
  sp,
}: {
  estudio: Pick<Estudio, 'id' | 'slug' | 'nome'>
  sp: SP
}) {
  const slug = estudio.slug
  const pk = (nome: string) => `${slug}_${nome}`

  const agora = new Date()
  const hoje = agora.toISOString().slice(0, 10)
  const mesParam = sp[pk('mes')]
  const diaParam = sp[pk('dia')]
  const ano = mesParam ? Number(mesParam.slice(0, 4)) : agora.getFullYear()
  const mes = mesParam ? Number(mesParam.slice(5, 7)) : agora.getMonth() + 1
  const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`
  const fimMesExclusivo = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, '0')}-01`
  const mesAnteriorAno = mes === 1 ? ano - 1 : ano
  const mesAnteriorMes = mes === 1 ? 12 : mes - 1
  const mesSeguinteAno = mes === 12 ? ano + 1 : ano
  const mesSeguinteMes = mes === 12 ? 1 : mes + 1
  const mesAnteriorParam = `${mesAnteriorAno}-${String(mesAnteriorMes).padStart(2, '0')}`
  const mesSeguinteParam = `${mesSeguinteAno}-${String(mesSeguinteMes).padStart(2, '0')}`

  // Preservado só para o paginador de "Este mês" manter o dia na URL
  // ao trocar de mês — a secção que o usava (Sessões experimentais)
  // passou para a Coordenação.
  const diaSessoes = diaParam || hoje

  const supabase = await createClient()

  const [{ data: clientesData, error: erroClientes }, { data: leadsData, error: erroLeadsTodas }] =
    await Promise.all([
      supabase.from('clientes').select('id, nome, estado, inicio_contrato').eq('estudio_id', estudio.id),
      supabase.from('leads').select('estado, entrada, fecho_em, visita_data').eq('estudio_id', estudio.id),
    ])

  if (erroClientes || erroLeadsTodas) {
    throw new Error((erroClientes ?? erroLeadsTodas)!.message)
  }

  const clientes = (clientesData ?? []) as ClienteResumo[]
  const clientesAtivos = clientes.filter((c) => c.estado === 'Ativo').length
  const clientesSuspensos = clientes.filter((c) => c.estado === 'Suspenso').length
  const clientesInativos = clientes.filter((c) => c.estado === 'Ex-cliente').length
  const novosClientes = clientes.filter(
    (c) => c.inicio_contrato && c.inicio_contrato >= inicioMes && c.inicio_contrato < fimMesExclusivo
  ).length
  const leads = (leadsData ?? []) as LeadResumo[]
  const leadsNovas = leads.filter((l) => l.entrada >= inicioMes && l.entrada < fimMesExclusivo).length
  const leadsConvertidas = leads.filter(
    (l) => l.estado === 'Ganha' && l.fecho_em && l.fecho_em >= inicioMes && l.fecho_em < fimMesExclusivo
  ).length
  const sessoesAgendadas = leads.filter(
    (l) => l.visita_data && l.visita_data >= hoje && l.estado !== 'Perdida' && l.estado !== 'Ganha'
  ).length

  const idsClientes = clientes.map((c) => c.id)
  const { data: pagamentosMesData, error: erroPagamentosMes } = idsClientes.length
    ? await supabase
        .from('pagamentos')
        .select('valor')
        .in('cliente_id', idsClientes)
        .gte('data_pagamento', inicioMes)
        .lt('data_pagamento', fimMesExclusivo)
    : { data: [], error: null }
  if (erroPagamentosMes) {
    throw new Error(erroPagamentosMes.message)
  }
  const receitaMes = (pagamentosMesData ?? []).reduce((soma, p) => soma + Number(p.valor), 0)

  return (
    <>
      <TituloSeccao cor="azul">Este mês</TituloSeccao>
      <div className="mt-2 flex items-center gap-3">
        <Link
          href={`/painel/admin${comQuery(sp, { [pk('mes')]: mesAnteriorParam, [pk('dia')]: diaSessoes })}`}
          className="rounded-md border border-border-subtle px-3 py-1.5 text-sm"
        >
          ←
        </Link>
        <span className="text-sm font-medium">
          {MESES[mes - 1]} {ano}
        </span>
        <Link
          href={`/painel/admin${comQuery(sp, { [pk('mes')]: mesSeguinteParam, [pk('dia')]: diaSessoes })}`}
          className="rounded-md border border-border-subtle px-3 py-1.5 text-sm"
        >
          →
        </Link>
      </div>
      <div className="bg-tech-grid mt-3 grid grid-cols-2 gap-3 rounded-2xl p-1">
        <StatCard icone={Megaphone} cor={PALETA.laranja} label="Leads novas" valor={leadsNovas} />
        <StatCard
          icone={TrendingUp}
          cor={PALETA.teal}
          label="Convertidas"
          valor={leadsConvertidas}
        />
        <StatCard icone={UserPlus} cor={PALETA.azul} label="Novos clientes" valor={novosClientes} />
        <StatCard
          icone={Euro}
          cor={PALETA.ambar}
          label="Receita"
          valor={`€${receitaMes.toFixed(0)}`}
        />
      </div>

      <TituloSeccao cor="teal">Agora</TituloSeccao>
      <div className="bg-tech-grid mt-2 grid grid-cols-2 gap-3 rounded-2xl p-1">
        <StatCard icone={UserCheck} cor={PALETA.teal} label="Clientes ativos" valor={clientesAtivos} aoVivo />
        <StatCard icone={PauseCircle} cor={PALETA.ambar} label="Suspensos" valor={clientesSuspensos} />
        <StatCard icone={UserMinus} cor={PALETA.neutro} label="Inativos" valor={clientesInativos} />
        <StatCard
          icone={CalendarCheck2}
          cor={PALETA.roxo}
          label="Sessões agendadas"
          valor={sessoesAgendadas}
        />
      </div>
    </>
  )
}
