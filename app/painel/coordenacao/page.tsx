import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getEstudios } from '@/lib/data/estudios'
import { fmt } from '@/lib/data/presencas'
import { somarDias, inicioDaSemana } from '@/lib/data/horarios'
import { desbloquearCoordenacao } from './actions'
import { corEstudio, ESTADOS_LEAD } from '@/lib/data/constantes'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { metricasNoIntervalo, METRICAS_MARKETING, type LeadMarketing } from '@/lib/data/marketing'
import { segurosPorPagar } from '@/lib/data/clientes'
import { PALETA } from '@/lib/data/constantes'
import TituloSeccao from '@/components/TituloSeccao'
import PortaSenha from '@/components/PortaSenha'
import BarMeter from '@/components/BarMeter'
import RadialProgress from '@/components/RadialProgress'
import type {
  Cliente,
  ClienteSemTreino,
  EstadoPagamento,
  Estudio,
  Lead,
  LeadParada,
  ReavaliacaoPendente,
} from '@/lib/supabase/database.types'

type ChecklistHoje = { tipo: string; concluidos: number; total: number }
type ClienteSeguro = Pick<Cliente, 'id' | 'nome' | 'inicio_contrato'>
type LeadDoDia = Pick<Lead, 'id' | 'nome' | 'visita_hora' | 'estado'>
type RegistoSemana = { horas: number; pt: { nome: string } | null }
type SP = Record<string, string | undefined>

// Cada estúdio navega o seu próprio dia nesta página combinada, sem
// pisar o do outro — a chave de cada parâmetro leva o slug à frente
// ("fatima_dia", "leiria_dia", …) e comQuery preserva tudo o resto.
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

export default async function CoordenacaoPage({
  searchParams,
}: {
  searchParams: Promise<SP & { error?: string; erroSenha?: string }>
}) {
  const sp = await searchParams
  const { error, erroSenha } = sp

  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'coordenacao')
  const desbloqueada = protegida ? await areaDesbloqueada('coordenacao') : true
  if (protegida && !desbloqueada) {
    return (
      <PortaSenha
        titulo="Coordenação"
        destino="/painel/coordenacao"
        action={desbloquearCoordenacao}
        erro={erroSenha}
      />
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

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Coordenação</h1>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
        <span className="live-dot" aria-hidden />
        {estudios.map((e) => e.nome).join(' e ')} · o dia de hoje e pendências, ao vivo.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <Link
        href="/painel/coordenacao/horarios"
        className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface p-4 transition-colors hover:border-border-strong"
      >
        <span className="text-sm text-foreground">Planeamento da semana e instrutores</span>
        <span className="text-sm text-muted">→</span>
      </Link>

      <div className="mt-8 grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-2">
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
              <PainelCoordenacaoEstudio estudio={estudio} sp={sp} />
            </Suspense>
          </section>
        ))}
      </div>
    </div>
  )
}

// Mostra já a estrutura da secção (os títulos a cinzento, sem dados)
// enquanto as consultas deste estúdio correm — a página não fica em
// branco à espera do estúdio mais lento.
function EsqueletoEstudio() {
  return (
    <div className="mt-2 animate-pulse space-y-8">
      {[0, 1, 2].map((i) => (
        <div key={i}>
          <div className="h-3 w-24 rounded bg-border-subtle" />
          <div className="mt-2 h-16 rounded-xl border border-border-subtle bg-border-subtle" />
        </div>
      ))}
    </div>
  )
}

async function PainelCoordenacaoEstudio({
  estudio,
  sp,
}: {
  estudio: Pick<Estudio, 'id' | 'slug' | 'nome'>
  sp: SP
}) {
  const slug = estudio.slug
  const pk = (nome: string) => `${slug}_${nome}`
  const hoje = new Date().toISOString().slice(0, 10)

  const diaSessoes = sp[pk('dia')] || hoje
  const diaSessoesEhHoje = diaSessoes === hoje
  const diaSessoesAnterior = somarDias(diaSessoes, -1)
  const diaSessoesSeguinte = somarDias(diaSessoes, 1)

  const inicioSemana = inicioDaSemana(hoje)
  const fimSemanaExclusivo = somarDias(inicioSemana, 7)

  const supabase = await createClient()

  const [
    { data: checklistHojeData },
    { data: leadsParadasData },
    { data: reavaliacoesData },
    { data: pagamentosData },
    { data: leadsMarketingData, error: erroLeadsMarketing },
    { data: semTreinoData },
    { data: clientesAtivosData },
    { data: sessoesDoDiaData },
    { data: registosSemanaData },
  ] = await Promise.all([
    supabase
      .from('checklist_registos')
      .select('tipo, concluidos, total')
      .eq('estudio_id', estudio.id)
      .eq('data', hoje),
    supabase
      .from('v_leads_paradas')
      .select('*')
      .eq('estudio_id', estudio.id)
      .order('dias_sem_contacto', { ascending: false }),
    supabase
      .from('v_reavaliacoes_pendentes')
      .select('*')
      .eq('estudio_id', estudio.id)
      .eq('precisa_atencao', true),
    supabase.from('v_estado_pagamento').select('*').eq('estudio_id', estudio.id).eq('em_dia', false),
    supabase
      .from('leads')
      .select('estado, entrada, visita_data, visita_marcada_em, walk_in')
      .eq('estudio_id', estudio.id),
    supabase
      .from('v_clientes_sem_treino_recente')
      .select('*')
      .eq('estudio_id', estudio.id)
      .gt('dias_sem_treino', 7),
    supabase
      .from('clientes')
      .select('id, nome, inicio_contrato')
      .eq('estudio_id', estudio.id)
      .eq('estado', 'Ativo'),
    supabase
      .from('leads')
      .select('id, nome, visita_hora, estado')
      .eq('estudio_id', estudio.id)
      .eq('visita_data', diaSessoes)
      .order('visita_hora', { ascending: true, nullsFirst: false }),
    supabase
      .from('registos_pt')
      .select('horas, pt:perfis!pt_id(nome)')
      .eq('estudio_id', estudio.id)
      .gte('data', inicioSemana)
      .lt('data', fimSemanaExclusivo),
  ])

  if (erroLeadsMarketing) {
    throw new Error(erroLeadsMarketing.message)
  }

  const checklistHoje = (checklistHojeData ?? []) as ChecklistHoje[]
  const leadsParadas = (leadsParadasData ?? []) as LeadParada[]
  const reavaliacoes = (reavaliacoesData ?? []) as ReavaliacaoPendente[]
  const pagamentosAtrasados = (pagamentosData ?? []) as EstadoPagamento[]
  const leadsMarketing = (leadsMarketingData ?? []) as LeadMarketing[]
  const metricasHoje = metricasNoIntervalo(leadsMarketing, hoje, somarDias(hoje, 1))

  // "Sem treino há mais de 7 dias" é calculado agora; "sem evento no
  // Google Calendar" vem da cache que o job diário (app/api/cron/retencao)
  // escreveu — por isso é uma segunda consulta, dependente da primeira.
  const candidatosInativos = (semTreinoData ?? []) as ClienteSemTreino[]
  const idsCandidatos = candidatosInativos.map((c) => c.cliente_id)
  const { data: semAgendamentoData } = idsCandidatos.length
    ? await supabase.from('clientes_sem_agendamento').select('cliente_id').in('cliente_id', idsCandidatos)
    : { data: [] }
  const idsSemAgendamento = new Set((semAgendamentoData ?? []).map((d) => d.cliente_id))
  const clientesInativos = candidatosInativos.filter((c) => idsSemAgendamento.has(c.cliente_id))

  const agora = new Date()
  const clientesAtivos = (clientesAtivosData ?? []) as ClienteSeguro[]
  const idsClientesAtivos = clientesAtivos.map((c) => c.id)
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
  const segurosARenovar = segurosPorPagar(clientesAtivos, agora, segurosPagosData ?? [], reativacoesData ?? [])

  const sessoesDoDia = (sessoesDoDiaData ?? []) as LeadDoDia[]

  const registosSemana = (registosSemanaData ?? []) as unknown as RegistoSemana[]
  const horasPorPt = new Map<string, number>()
  for (const r of registosSemana) {
    const nome = r.pt?.nome ?? '—'
    horasPorPt.set(nome, (horasPorPt.get(nome) ?? 0) + r.horas)
  }
  const horasEquipa = [...horasPorPt.entries()]
    .map(([nome, horas]) => ({ nome, horas }))
    .sort((a, b) => b.horas - a.horas)

  return (
    <>
      <TituloSeccao cor="teal">Hoje</TituloSeccao>
      <div className="mt-2 flex items-center gap-4 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Checklist</h3>
          <Link
            href={`/painel/${slug}/checklist`}
            className="mt-1.5 inline-block text-xs text-muted underline hover:text-foreground"
          >
            abrir checklist
          </Link>
        </div>
        <div className="ml-auto flex items-center gap-4">
          {['Abertura', 'Fecho'].map((tipo) => {
            const r = checklistHoje.find((c) => c.tipo === tipo)
            const pct = r && r.total > 0 ? (r.concluidos / r.total) * 100 : 0
            const completa = r && r.concluidos >= r.total && r.total > 0
            return (
              <div key={tipo} className="flex flex-col items-center gap-1.5">
                <RadialProgress
                  valor={pct}
                  tamanho={56}
                  espessura={5}
                  cor={completa ? PALETA.teal.tx : 'var(--accent)'}
                />
                <span className="text-[10px] font-medium text-muted">
                  {tipo} · {r ? `${r.concluidos}/${r.total}` : '—'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <TituloSeccao cor="roxo">Marketing</TituloSeccao>
      <p className="mt-2 text-xs text-muted">
        Funil de hoje, relativo às leads de entrada — atualizado automaticamente.
      </p>
      <div className="mt-2 flex flex-col gap-2.5 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
        {METRICAS_MARKETING.map((metrica) => (
          <BarMeter
            key={metrica.chave}
            label={metrica.label}
            valor={metricasHoje[metrica.chave]}
            total={Math.max(metricasHoje.leads, 1)}
            mostrarPct={false}
            cor={metrica.chave === 'totalFechos' ? PALETA.teal.tx : 'var(--accent)'}
          />
        ))}
      </div>
      <Link
        href="/painel/coordenacao/marketing"
        className="mt-2 inline-block text-xs text-muted underline hover:text-foreground"
      >
        ver calendário diário/semanal/mensal/anual
      </Link>
      <Link
        href="/painel/coordenacao/timeline"
        className="mt-1 block text-xs text-muted underline hover:text-foreground"
      >
        ver timeline da empresa e marcos
      </Link>

      <TituloSeccao cor="roxo">Sessões experimentais</TituloSeccao>
      <div className="mt-2 flex items-center gap-3">
        <Link
          href={`/painel/coordenacao${comQuery(sp, { [pk('dia')]: diaSessoesAnterior })}`}
          className="rounded-md border border-border-subtle px-3 py-1.5 text-sm"
        >
          ←
        </Link>
        <span className="text-sm font-medium">{diaSessoesEhHoje ? 'Hoje' : fmt(diaSessoes)}</span>
        <Link
          href={`/painel/coordenacao${comQuery(sp, { [pk('dia')]: diaSessoesSeguinte })}`}
          className="rounded-md border border-border-subtle px-3 py-1.5 text-sm"
        >
          →
        </Link>
        {!diaSessoesEhHoje && (
          <Link
            href={`/painel/coordenacao${comQuery(sp, { [pk('dia')]: undefined })}`}
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

      <TituloSeccao cor="ambar">Pendências</TituloSeccao>
      <div className="mt-2 flex flex-col gap-2">
        {leadsParadas.map((l) => (
          <Link
            key={`lead-${l.id}`}
            href={`/painel/${slug}/leads/${l.id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm transition-colors hover:border-amber-300 dark:border-amber-900 dark:bg-amber-950"
          >
            <span className="text-foreground">{l.nome} · lead parada</span>
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
            <span className="text-foreground">{r.nome} · reavaliação</span>
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
            <span className="text-foreground">{p.nome} · pagamento</span>
            <span className="text-xs text-amber-700 dark:text-amber-300">
              {p.valido_ate ? `venceu em ${fmt(p.valido_ate)}` : 'sem pagamentos'}
            </span>
          </Link>
        ))}
        {clientesInativos.map((c) => (
          <Link
            key={`inativo-${c.cliente_id}`}
            href={`/painel/${slug}/clientes/${c.cliente_id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm transition-colors hover:border-amber-300 dark:border-amber-900 dark:bg-amber-950"
          >
            <span className="text-foreground">{c.nome} · Cliente Inativo / Sem Agendamento</span>
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
            <span className="text-foreground">{c.nome} · renovação de seguro</span>
            <span className="text-xs text-amber-700 dark:text-amber-300">
              em dívida desde {fmt(c.dataRenovacao)}
            </span>
          </Link>
        ))}
        {leadsParadas.length +
          reavaliacoes.length +
          pagamentosAtrasados.length +
          clientesInativos.length +
          segurosARenovar.length ===
          0 && <p className="text-sm text-muted">Nada pendente — tudo em dia.</p>}
      </div>
    </>
  )
}
