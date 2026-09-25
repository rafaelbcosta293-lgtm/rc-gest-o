import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getEstudios } from '@/lib/data/estudios'
import { fmt } from '@/lib/data/presencas'
import { somarDias } from '@/lib/data/horarios'
import { desbloquearCoordenacao } from './actions'
import { corEstudio } from '@/lib/data/constantes'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { metricasNoIntervalo, METRICAS_MARKETING, type LeadMarketing } from '@/lib/data/marketing'
import TituloSeccao from '@/components/TituloSeccao'
import PortaSenha from '@/components/PortaSenha'
import type { EstadoPagamento, Estudio, LeadParada, ReavaliacaoPendente } from '@/lib/supabase/database.types'

type ChecklistHoje = { tipo: string; concluidos: number; total: number }

export default async function CoordenacaoPage({
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
      <Link href="/painel" className="text-sm text-zinc-600 underline dark:text-zinc-400">
        ← Voltar
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">Coordenação</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {estudios.map((e) => e.nome).join(' e ')} · o dia de hoje e pendências, lado a lado.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <Link
        href="/painel/coordenacao/horarios"
        className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-4 transition-colors hover:border-black/30 dark:border-white/10 dark:bg-zinc-950"
      >
        <span className="text-sm text-black dark:text-zinc-50">Planeamento da semana e instrutores</span>
        <span className="text-sm text-zinc-400">→</span>
      </Link>

      <div className="mt-8 grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-2">
        {estudios.map((estudio) => (
          <section key={estudio.id}>
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: corEstudio(estudio.slug).cor }}
              />
              <h2 className="text-lg font-semibold text-black dark:text-zinc-50">{estudio.nome}</h2>
            </div>
            <PainelCoordenacaoEstudio estudio={estudio} />
          </section>
        ))}
      </div>
    </div>
  )
}

async function PainelCoordenacaoEstudio({
  estudio,
}: {
  estudio: Pick<Estudio, 'id' | 'slug' | 'nome'>
}) {
  const slug = estudio.slug
  const hoje = new Date().toISOString().slice(0, 10)

  const supabase = await createClient()

  const [
    { data: checklistHojeData },
    { data: leadsParadasData },
    { data: reavaliacoesData },
    { data: pagamentosData },
    { data: leadsMarketingData, error: erroLeadsMarketing },
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

  return (
    <>
      <TituloSeccao cor="teal">Hoje</TituloSeccao>
      <div className="mt-2">
        <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
          <h3 className="text-xs font-semibold text-zinc-500">Checklist</h3>
          {['Abertura', 'Fecho'].map((tipo) => {
            const r = checklistHoje.find((c) => c.tipo === tipo)
            return (
              <p key={tipo} className="mt-1 text-sm text-black dark:text-zinc-50">
                {tipo}:{' '}
                {r ? (
                  <span className={r.concluidos >= r.total ? 'text-teal-700 dark:text-teal-400' : 'text-amber-600'}>
                    {r.concluidos} de {r.total}
                  </span>
                ) : (
                  <span className="text-zinc-400">não iniciada</span>
                )}
              </p>
            )
          })}
          <Link
            href={`/painel/${slug}/checklist`}
            className="mt-2 inline-block text-xs text-zinc-500 underline"
          >
            abrir checklist
          </Link>
        </div>
      </div>

      <TituloSeccao cor="roxo">Marketing</TituloSeccao>
      <p className="mt-2 text-xs text-zinc-500">Funil de hoje, atualizado automaticamente.</p>
      <div className="mt-2 flex flex-col overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
        {METRICAS_MARKETING.map((metrica, i) => (
          <div
            key={metrica.chave}
            className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${
              metrica.chave === 'totalFechos'
                ? 'bg-teal-50 dark:bg-teal-950'
                : 'bg-white dark:bg-zinc-950'
            } ${i > 0 ? 'border-t border-black/10 dark:border-white/10' : ''}`}
          >
            <span
              className={
                metrica.chave === 'totalFechos'
                  ? 'font-medium text-teal-800 dark:text-teal-200'
                  : 'text-zinc-600 dark:text-zinc-400'
              }
            >
              {metrica.label}
            </span>
            <strong
              className={metrica.chave === 'totalFechos' ? 'text-teal-800 dark:text-teal-200' : 'text-black dark:text-zinc-50'}
            >
              {metricasHoje[metrica.chave]}
            </strong>
          </div>
        ))}
      </div>
      <Link
        href="/painel/coordenacao/marketing"
        className="mt-2 inline-block text-xs text-zinc-500 underline"
      >
        ver calendário diário/semanal/mensal/anual
      </Link>

      <TituloSeccao cor="ambar">Pendências</TituloSeccao>
      <div className="mt-2 flex flex-col gap-2">
        {leadsParadas.map((l) => (
          <Link
            key={`lead-${l.id}`}
            href={`/painel/${slug}/leads/${l.id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm transition-colors hover:border-amber-300 dark:border-amber-900 dark:bg-amber-950"
          >
            <span className="text-black dark:text-zinc-50">{l.nome} · lead parada</span>
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
            <span className="text-black dark:text-zinc-50">{r.nome} · reavaliação</span>
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
            <span className="text-black dark:text-zinc-50">{p.nome} · pagamento</span>
            <span className="text-xs text-amber-700 dark:text-amber-300">
              {p.valido_ate ? `venceu em ${fmt(p.valido_ate)}` : 'sem pagamentos'}
            </span>
          </Link>
        ))}
        {leadsParadas.length + reavaliacoes.length + pagamentosAtrasados.length === 0 && (
          <p className="text-sm text-zinc-500">Nada pendente — tudo em dia.</p>
        )}
      </div>
    </>
  )
}
