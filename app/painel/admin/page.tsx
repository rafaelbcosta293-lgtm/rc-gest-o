import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getEstudios } from '@/lib/data/estudios'
import { fmt, MESES } from '@/lib/data/presencas'
import { inicioDaSemana, somarDias } from '@/lib/data/horarios'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { desbloquearAdmin } from './actions'
import { corEstudio, ESTADOS_LEAD } from '@/lib/data/constantes'
import PortaSenha from '@/components/PortaSenha'
import TituloSeccao from '@/components/TituloSeccao'
import type { Cliente, Estudio, Lead, LeadParada, EstadoPagamento, ReavaliacaoPendente } from '@/lib/supabase/database.types'

type ClienteResumo = Pick<Cliente, 'id' | 'estado' | 'inicio_contrato'>
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
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/painel" className="text-sm text-zinc-600 underline dark:text-zinc-400">
        ← Voltar
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">Administração</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {estudios.map((e) => e.nome).join(' e ')} · dados do negócio e pendências, lado a lado.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {estudios.map((estudio) => (
        <section key={estudio.id} className="mt-10 first:mt-6">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: corEstudio(estudio.slug).cor }}
            />
            <h2 className="text-lg font-semibold text-black dark:text-zinc-50">{estudio.nome}</h2>
          </div>
          <PainelAdminEstudio estudio={estudio} sp={sp} />
        </section>
      ))}

      <TituloSeccao cor="roxo">Serviços / Produtos</TituloSeccao>
      <Link
        href="/painel/admin/servicos"
        className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-4 transition-colors hover:border-black/30 dark:border-white/10 dark:bg-zinc-950"
      >
        <span className="text-sm text-black dark:text-zinc-50">Gerir valores, planos e serviços</span>
        <span className="text-sm text-zinc-400">→</span>
      </Link>
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
    supabase.from('clientes').select('id, estado, inicio_contrato').eq('estudio_id', estudio.id),
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
  ])

  if (
    erroLeadsParadas ||
    erroReavaliacoes ||
    erroPagamentos ||
    erroClientes ||
    erroLeadsTodas ||
    erroRegistosSemana ||
    erroSessoesDoDia
  ) {
    throw new Error(
      (erroLeadsParadas ??
        erroReavaliacoes ??
        erroPagamentos ??
        erroClientes ??
        erroLeadsTodas ??
        erroRegistosSemana ??
        erroSessoesDoDia)!.message
    )
  }

  const sessoesDoDia = (sessoesDoDiaData ?? []) as LeadDoDia[]

  const leadsParadas = (leadsParadasData ?? []) as LeadParada[]
  const reavaliacoes = (reavaliacoesData ?? []) as ReavaliacaoPendente[]
  const pagamentosAtrasados = (pagamentosAtrasadosData ?? []) as EstadoPagamento[]

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
    (l) => l.estado === 'Convertido' && l.fecho_em && l.fecho_em >= inicioMes && l.fecho_em < fimMesExclusivo
  ).length
  const sessoesAgendadas = leads.filter(
    (l) => l.visita_data && l.visita_data >= hoje && l.estado !== 'Perdido' && l.estado !== 'Convertido'
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

  const totalPendencias = leadsParadas.length + reavaliacoes.length + pagamentosAtrasados.length

  return (
    <>
      <TituloSeccao cor="azul">Este mês</TituloSeccao>
      <div className="mt-2 flex items-center gap-3">
        <Link
          href={`/painel/admin${comQuery(sp, { [pk('mes')]: mesAnteriorParam, [pk('dia')]: diaSessoes })}`}
          className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
        >
          ←
        </Link>
        <span className="text-sm font-medium">
          {MESES[mes - 1]} {ano}
        </span>
        <Link
          href={`/painel/admin${comQuery(sp, { [pk('mes')]: mesSeguinteParam, [pk('dia')]: diaSessoes })}`}
          className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
        >
          →
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
          <strong className="block text-2xl text-black dark:text-zinc-50">{leadsNovas}</strong>
          <span className="text-xs text-zinc-500">leads novas</span>
        </div>
        <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
          <strong className="block text-2xl text-teal-700 dark:text-teal-400">
            {leadsConvertidas}
          </strong>
          <span className="text-xs text-zinc-500">convertidas</span>
        </div>
        <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
          <strong className="block text-2xl text-black dark:text-zinc-50">{novosClientes}</strong>
          <span className="text-xs text-zinc-500">novos clientes</span>
        </div>
        <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
          <strong className="block text-2xl text-black dark:text-zinc-50">
            €{receitaMes.toFixed(0)}
          </strong>
          <span className="text-xs text-zinc-500">receita</span>
        </div>
      </div>

      <TituloSeccao cor="teal">Agora</TituloSeccao>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
          <strong className="block text-2xl text-teal-700 dark:text-teal-400">
            {clientesAtivos}
          </strong>
          <span className="text-xs text-zinc-500">clientes ativos</span>
        </div>
        <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
          <strong className="block text-2xl text-amber-700 dark:text-amber-400">
            {clientesSuspensos}
          </strong>
          <span className="text-xs text-zinc-500">suspensos</span>
        </div>
        <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
          <strong className="block text-2xl text-zinc-500">{clientesInativos}</strong>
          <span className="text-xs text-zinc-500">inativos</span>
        </div>
        <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
          <strong className="block text-2xl text-[#5B3FA0]">{sessoesAgendadas}</strong>
          <span className="text-xs text-zinc-500">sessões experimentais agendadas</span>
        </div>
      </div>

      <TituloSeccao cor="roxo">Sessões experimentais</TituloSeccao>
      <div className="mt-2 flex items-center gap-3">
        <Link
          href={`/painel/admin${comQuery(sp, { [pk('mes')]: mesAtualParam, [pk('dia')]: diaSessoesAnterior })}`}
          className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
        >
          ←
        </Link>
        <span className="text-sm font-medium">{diaSessoesEhHoje ? 'Hoje' : fmt(diaSessoes)}</span>
        <Link
          href={`/painel/admin${comQuery(sp, { [pk('mes')]: mesAtualParam, [pk('dia')]: diaSessoesSeguinte })}`}
          className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
        >
          →
        </Link>
        {!diaSessoesEhHoje && (
          <Link
            href={`/painel/admin${comQuery(sp, { [pk('mes')]: mesAtualParam, [pk('dia')]: undefined })}`}
            className="text-xs text-zinc-500 underline"
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
              className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-white p-3 text-sm transition-colors hover:border-black/30 dark:border-white/10 dark:bg-zinc-950"
            >
              <span className="flex items-center gap-2">
                {l.visita_hora && (
                  <span className="text-xs text-zinc-400">{l.visita_hora.slice(0, 5)}</span>
                )}
                <span className="font-medium text-black dark:text-zinc-50">{l.nome}</span>
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
          <p className="text-sm text-zinc-500">Nenhuma sessão experimental agendada para este dia.</p>
        )}
      </div>

      <TituloSeccao cor="verde">Horas da equipa esta semana</TituloSeccao>
      <div className="mt-2 flex flex-wrap gap-2">
        {horasEquipa.map((h) => (
          <div
            key={h.nome}
            className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs dark:border-white/10 dark:bg-zinc-950"
          >
            <span className="font-medium text-black dark:text-zinc-50">{h.nome}</span>
            <span className="text-zinc-500">{h.horas}h</span>
          </div>
        ))}
        {horasEquipa.length === 0 && (
          <p className="text-sm text-zinc-500">Sem registos de horas esta semana.</p>
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
            <span className="font-medium text-black dark:text-zinc-50">
              {l.nome} <span className="text-xs text-zinc-500">· lead parada</span>
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
            <span className="font-medium text-black dark:text-zinc-50">
              {r.nome} <span className="text-xs text-zinc-500">· reavaliação</span>
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
            <span className="font-medium text-black dark:text-zinc-50">
              {p.nome} <span className="text-xs text-zinc-500">· pagamento</span>
            </span>
            <span className="text-xs text-amber-700 dark:text-amber-300">
              {p.valido_ate ? `venceu em ${fmt(p.valido_ate)}` : 'sem pagamentos'}
            </span>
          </Link>
        ))}
        {totalPendencias === 0 && <p className="text-sm text-zinc-500">Nada pendente — tudo em dia.</p>}
      </div>
    </>
  )
}
