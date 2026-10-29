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
import { fmt, MESES } from '@/lib/data/presencas'
import { inicioDaSemana, somarDias } from '@/lib/data/horarios'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { desbloquearAdmin } from './actions'
import { corEstudio, ESTADOS_LEAD, PALETA } from '@/lib/data/constantes'
import { segurosPorPagar } from '@/lib/data/clientes'
import PortaSenha from '@/components/PortaSenha'
import TituloSeccao from '@/components/TituloSeccao'
import StatCard from '@/components/StatCard'
import BarMeter from '@/components/BarMeter'
import type {
  Cliente,
  ClienteSemTreino,
  Estudio,
  Lead,
  LeadParada,
  EstadoPagamento,
  ReavaliacaoPendente,
} from '@/lib/supabase/database.types'

type ClienteResumo = Pick<Cliente, 'id' | 'nome' | 'estado' | 'inicio_contrato'>
type LeadResumo = Pick<Lead, 'estado' | 'entrada' | 'fecho_em' | 'visita_data'>
type LeadDoDia = Pick<Lead, 'id' | 'nome' | 'visita_hora' | 'estado'>
type RegistoSemana = { horas: number; pt: { nome: string } | null }
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

      <TituloSeccao cor="roxo">Serviços / Produtos</TituloSeccao>
      <Link
        href="/painel/admin/servicos"
        className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface p-4 transition-colors hover:border-border-strong"
      >
        <span className="text-sm text-foreground">Gerir valores, planos e serviços</span>
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
  const mesAtualParam = `${ano}-${String(mes).padStart(2, '0')}`
  const mesAnteriorAno = mes === 1 ? ano - 1 : ano
  const mesAnteriorMes = mes === 1 ? 12 : mes - 1
  const mesSeguinteAno = mes === 12 ? ano + 1 : ano
  const mesSeguinteMes = mes === 12 ? 1 : mes + 1
  const mesAnteriorParam = `${mesAnteriorAno}-${String(mesAnteriorMes).padStart(2, '0')}`
  const mesSeguinteParam = `${mesSeguinteAno}-${String(mesSeguinteMes).padStart(2, '0')}`

  const diaSessoes = diaParam || hoje
  const diaSessoesEhHoje = diaSessoes === hoje
  const diaSessoesAnterior = somarDias(diaSessoes, -1)
  const diaSessoesSeguinte = somarDias(diaSessoes, 1)

  const inicioSemana = inicioDaSemana(hoje)
  const fimSemanaExclusivo = somarDias(inicioSemana, 7)

  const supabase = await createClient()

  const [
    { data: leadsParadasData, error: erroLeadsParadas },
    { data: reavaliacoesData, error: erroReavaliacoes },
    { data: pagamentosAtrasadosData, error: erroPagamentos },
    { data: clientesData, error: erroClientes },
    { data: leadsData, error: erroLeadsTodas },
    { data: registosSemanaData, error: erroRegistosSemana },
    { data: sessoesDoDiaData, error: erroSessoesDoDia },
    { data: semTreinoData, error: erroSemTreino },
  ] = await Promise.all([
    supabase
      .from('v_leads_paradas')
      .select('*')
      .eq('estudio_id', estudio.id)
      .order('dias_sem_contacto', { ascending: false }),
    supabase
      .from('v_reavaliacoes_pendentes')
      .select('*')
      .eq('estudio_id', estudio.id)
      .eq('precisa_atencao', true)
      .order('dias_para_reavaliar', { ascending: true, nullsFirst: true }),
    supabase
      .from('v_estado_pagamento')
      .select('*')
      .eq('estudio_id', estudio.id)
      .eq('em_dia', false)
      .order('nome'),
    supabase.from('clientes').select('id, nome, estado, inicio_contrato').eq('estudio_id', estudio.id),
    supabase.from('leads').select('estado, entrada, fecho_em, visita_data').eq('estudio_id', estudio.id),
    supabase
      .from('registos_pt')
      .select('horas, pt:perfis!pt_id(nome)')
      .eq('estudio_id', estudio.id)
      .gte('data', inicioSemana)
      .lt('data', fimSemanaExclusivo),
    supabase
      .from('leads')
      .select('id, nome, visita_hora, estado')
      .eq('estudio_id', estudio.id)
      .eq('visita_data', diaSessoes)
      .order('visita_hora', { ascending: true, nullsFirst: false }),
    supabase
      .from('v_clientes_sem_treino_recente')
      .select('*')
      .eq('estudio_id', estudio.id)
      .gt('dias_sem_treino', 7),
  ])

  if (
    erroLeadsParadas ||
    erroReavaliacoes ||
    erroPagamentos ||
    erroClientes ||
    erroLeadsTodas ||
    erroRegistosSemana ||
    erroSessoesDoDia ||
    erroSemTreino
  ) {
    throw new Error(
      (erroLeadsParadas ??
        erroReavaliacoes ??
        erroPagamentos ??
        erroClientes ??
        erroLeadsTodas ??
        erroRegistosSemana ??
        erroSessoesDoDia ??
        erroSemTreino)!.message
    )
  }

  const sessoesDoDia = (sessoesDoDiaData ?? []) as LeadDoDia[]

  const leadsParadas = (leadsParadasData ?? []) as LeadParada[]
  const reavaliacoes = (reavaliacoesData ?? []) as ReavaliacaoPendente[]
  const pagamentosAtrasados = (pagamentosAtrasadosData ?? []) as EstadoPagamento[]

  // "Sem treino há mais de 7 dias" é calculado agora; "sem evento no
  // Google Calendar" vem da cache que o job diário (app/api/cron/retencao)
  // escreveu — por isso é uma segunda consulta, dependente da primeira.
  const candidatosSemTreino = (semTreinoData ?? []) as ClienteSemTreino[]
  const idsCandidatosSemTreino = candidatosSemTreino.map((c) => c.cliente_id)
  const { data: semAgendamentoData, error: erroSemAgendamento } = idsCandidatosSemTreino.length
    ? await supabase
        .from('clientes_sem_agendamento')
        .select('cliente_id')
        .in('cliente_id', idsCandidatosSemTreino)
    : { data: [], error: null }
  if (erroSemAgendamento) {
    throw new Error(erroSemAgendamento.message)
  }
  const idsSemAgendamento = new Set((semAgendamentoData ?? []).map((d) => d.cliente_id))
  const clientesSemAgendamento = candidatosSemTreino.filter((c) => idsSemAgendamento.has(c.cliente_id))

  const clientes = (clientesData ?? []) as ClienteResumo[]
  const clientesAtivos = clientes.filter((c) => c.estado === 'Ativo').length
  const clientesSuspensos = clientes.filter((c) => c.estado === 'Suspenso').length
  const clientesInativos = clientes.filter((c) => c.estado === 'Ex-cliente').length
  const novosClientes = clientes.filter(
    (c) => c.inicio_contrato && c.inicio_contrato >= inicioMes && c.inicio_contrato < fimMesExclusivo
  ).length
  const clientesAtivosComContrato = clientes.filter((c) => c.estado === 'Ativo')
  const idsClientesAtivos = clientesAtivosComContrato.map((c) => c.id)
  const { data: segurosPagosData, error: erroSegurosPagos } = idsClientesAtivos.length
    ? await supabase
        .from('pagamentos')
        .select('cliente_id, data_pagamento')
        .in('cliente_id', idsClientesAtivos)
        .eq('inclui_seguro', true)
    : { data: [], error: null }
  if (erroSegurosPagos) {
    throw new Error(erroSegurosPagos.message)
  }
  const { data: reativacoesData, error: erroReativacoesSeguro } = idsClientesAtivos.length
    ? await supabase
        .from('pagamentos')
        .select('cliente_id, data_pagamento')
        .in('cliente_id', idsClientesAtivos)
        .eq('inclui_reativacao', true)
    : { data: [], error: null }
  if (erroReativacoesSeguro) {
    throw new Error(erroReativacoesSeguro.message)
  }
  const segurosARenovar = segurosPorPagar(
    clientesAtivosComContrato,
    agora,
    segurosPagosData ?? [],
    reativacoesData ?? []
  )

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

  const registosSemana = (registosSemanaData ?? []) as unknown as RegistoSemana[]
  const horasPorPt = new Map<string, number>()
  for (const r of registosSemana) {
    const nome = r.pt?.nome ?? '—'
    horasPorPt.set(nome, (horasPorPt.get(nome) ?? 0) + r.horas)
  }
  const horasEquipa = [...horasPorPt.entries()]
    .map(([nome, horas]) => ({ nome, horas }))
    .sort((a, b) => b.horas - a.horas)

  const totalPendencias =
    leadsParadas.length +
    reavaliacoes.length +
    pagamentosAtrasados.length +
    clientesSemAgendamento.length +
    segurosARenovar.length

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

      <TituloSeccao cor="roxo">Sessões experimentais</TituloSeccao>
      <div className="mt-2 flex items-center gap-3">
        <Link
          href={`/painel/admin${comQuery(sp, { [pk('mes')]: mesAtualParam, [pk('dia')]: diaSessoesAnterior })}`}
          className="rounded-md border border-border-subtle px-3 py-1.5 text-sm"
        >
          ←
        </Link>
        <span className="text-sm font-medium">{diaSessoesEhHoje ? 'Hoje' : fmt(diaSessoes)}</span>
        <Link
          href={`/painel/admin${comQuery(sp, { [pk('mes')]: mesAtualParam, [pk('dia')]: diaSessoesSeguinte })}`}
          className="rounded-md border border-border-subtle px-3 py-1.5 text-sm"
        >
          →
        </Link>
        {!diaSessoesEhHoje && (
          <Link
            href={`/painel/admin${comQuery(sp, { [pk('mes')]: mesAtualParam, [pk('dia')]: undefined })}`}
            className="text-xs text-muted underline"
          >
            voltar a hoje
          </Link>
        )}
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {sessoesDoDia.map((l) => {
          const cor = ESTADOS_LEAD[l.estado as keyof typeof ESTADOS_LEAD]
          return (
            <Link
              key={l.id}
              href={`/painel/${slug}/leads/${l.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface p-3 text-sm transition-colors hover:border-border-strong"
            >
              <span className="flex items-center gap-2">
                {l.visita_hora && (
                  <span className="text-xs text-muted">{l.visita_hora.slice(0, 5)}</span>
                )}
                <span className="font-medium text-foreground">{l.nome}</span>
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: cor.bg, color: cor.tx }}
              >
                {l.estado}
              </span>
            </Link>
          )
        })}
        {sessoesDoDia.length === 0 && (
          <p className="text-sm text-muted">Nenhuma sessão experimental agendada para este dia.</p>
        )}
      </div>

      <TituloSeccao cor="verde">Horas da equipa esta semana</TituloSeccao>
      <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
        {horasEquipa.map((h) => (
          <BarMeter
            key={h.nome}
            label={h.nome}
            valor={h.horas}
            total={horasEquipa[0].horas}
            mostrarPct={false}
            cor={PALETA.verde.tx}
          />
        ))}
        {horasEquipa.length === 0 && (
          <p className="text-sm text-muted">Sem registos de horas esta semana.</p>
        )}
      </div>

      <TituloSeccao cor="ambar">Pendências ({totalPendencias})</TituloSeccao>
      <div className="mt-2 flex flex-col gap-2">
        {leadsParadas.map((l) => (
          <Link
            key={`lead-${l.id}`}
            href={`/painel/${slug}/leads/${l.id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm transition-colors hover:border-amber-300 dark:border-amber-900 dark:bg-amber-950"
          >
            <span className="font-medium text-foreground">
              {l.nome} <span className="text-xs text-muted">· lead parada</span>
            </span>
            <span className="text-xs text-amber-700 dark:text-amber-300">
              {l.dias_sem_contacto} dias sem contacto
            </span>
          </Link>
        ))}
        {reavaliacoes.map((r) => (
          <Link
            key={`reav-${r.cliente_id}`}
            href={`/painel/${slug}/avaliacoes/${r.cliente_id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm transition-colors hover:border-amber-300 dark:border-amber-900 dark:bg-amber-950"
          >
            <span className="font-medium text-foreground">
              {r.nome} <span className="text-xs text-muted">· reavaliação</span>
            </span>
            <span className="text-xs text-amber-700 dark:text-amber-300">
              {r.ultima_avaliacao ? `última em ${fmt(r.ultima_avaliacao)}` : 'nunca avaliado'}
            </span>
          </Link>
        ))}
        {pagamentosAtrasados.map((p) => (
          <Link
            key={`pag-${p.cliente_id}`}
            href={`/painel/${slug}/pagamentos/${p.cliente_id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm transition-colors hover:border-amber-300 dark:border-amber-900 dark:bg-amber-950"
          >
            <span className="font-medium text-foreground">
              {p.nome} <span className="text-xs text-muted">· pagamento</span>
            </span>
            <span className="text-xs text-amber-700 dark:text-amber-300">
              {p.valido_ate ? `venceu em ${fmt(p.valido_ate)}` : 'sem pagamentos'}
            </span>
          </Link>
        ))}
        {clientesSemAgendamento.map((c) => (
          <Link
            key={`inativo-${c.cliente_id}`}
            href={`/painel/${slug}/clientes/${c.cliente_id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm transition-colors hover:border-amber-300 dark:border-amber-900 dark:bg-amber-950"
          >
            <span className="font-medium text-foreground">
              {c.nome} <span className="text-xs text-muted">· Cliente Inativo / Sem Agendamento</span>
            </span>
            <span className="text-xs text-amber-700 dark:text-amber-300">
              {c.dias_sem_treino} dias sem treinar
            </span>
          </Link>
        ))}
        {segurosARenovar.map((c) => (
          <Link
            key={`seguro-${c.id}`}
            href={`/painel/${slug}/pagamentos/${c.id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm transition-colors hover:border-amber-300 dark:border-amber-900 dark:bg-amber-950"
          >
            <span className="font-medium text-foreground">
              {c.nome} <span className="text-xs text-muted">· renovação de seguro</span>
            </span>
            <span className="text-xs text-amber-700 dark:text-amber-300">
              em dívida desde {fmt(c.dataRenovacao)}
            </span>
          </Link>
        ))}
        {totalPendencias === 0 && <p className="text-sm text-muted">Nada pendente — tudo em dia.</p>}
      </div>
    </>
  )
}
