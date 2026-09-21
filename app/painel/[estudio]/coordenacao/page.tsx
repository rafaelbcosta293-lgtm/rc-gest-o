import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEquipaDoEstudio } from '@/lib/data/estudios'
import { fmt } from '@/lib/data/presencas'
import { diasDaSemana, inicioDaSemana, somarDias } from '@/lib/data/horarios'
import { registarHoras, atualizarHoras, guardarSlot } from './actions'
import SubmitButton from '@/components/SubmitButton'
import GrelhaHorarios, { chaveSlot, type SlotPt } from '@/components/GrelhaHorarios'
import type {
  EstadoPagamento,
  LeadParada,
  ReavaliacaoPendente,
  RegistoPt,
} from '@/lib/supabase/database.types'

const inputCls =
  'rounded-md border border-black/10 px-2 py-1.5 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900 dark:focus:border-white/30'

type TurnoSemana = { data: string; hora: number; minuto: number; pt: { id: string; nome: string } | null }
type ChecklistHoje = { tipo: string; concluidos: number; total: number }
type RegistoPtComPt = RegistoPt & { pt: { nome: string } | null }

export default async function CoordenacaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ semana?: string; editar?: string; error?: string }>
}) {
  const { estudio: slug } = await params
  const { semana: semanaParam, editar, error } = await searchParams
  const hoje = new Date().toISOString().slice(0, 10)
  const inicioSemana = inicioDaSemana(semanaParam ?? hoje)
  const diasSemana = diasDaSemana(inicioSemana)
  const fimSemanaExclusivo = somarDias(inicioSemana, 7)
  const semanaAnterior = somarDias(inicioSemana, -7)
  const semanaSeguinte = somarDias(inicioSemana, 7)

  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) {
    notFound()
  }

  const { data: userData } = await supabase.auth.getUser()
  const { data: perfilAtual } = userData.user
    ? await supabase.from('perfis').select('papel').eq('id', userData.user.id).maybeSingle()
    : { data: null }
  const ehGestao = perfilAtual?.papel === 'admin' || perfilAtual?.papel === 'studio_manager'

  const [
    { data: escalaSemanaData, error: erroEscala },
    listaPts,
    { data: checklistHojeData },
    { data: leadsParadasData },
    { data: reavaliacoesData },
    { data: pagamentosData },
    { data: registosData, error: erroRegistos },
  ] = await Promise.all([
    supabase
      .from('escalas')
      .select('data, hora, minuto, pt:perfis!pt_id(id, nome)')
      .eq('estudio_id', estudio.id)
      .gte('data', inicioSemana)
      .lt('data', fimSemanaExclusivo)
      .order('criado_em'),
    getEquipaDoEstudio(supabase, estudio.id),
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
      .from('registos_pt')
      .select('*, pt:perfis!pt_id(nome)')
      .eq('estudio_id', estudio.id)
      .order('data', { ascending: false })
      .limit(30),
  ])

  if (erroEscala || erroRegistos) {
    throw new Error((erroEscala ?? erroRegistos)!.message)
  }

  const escalaSemana = (escalaSemanaData ?? []) as unknown as TurnoSemana[]
  const escalaHoje = escalaSemana.filter((t) => t.data === hoje).sort((a, b) => a.hora - b.hora)
  const checklistHoje = (checklistHojeData ?? []) as ChecklistHoje[]
  const leadsParadas = (leadsParadasData ?? []) as LeadParada[]
  const reavaliacoes = (reavaliacoesData ?? []) as ReavaliacaoPendente[]
  const pagamentosAtrasados = (pagamentosData ?? []) as EstadoPagamento[]
  const registos = (registosData ?? []) as unknown as RegistoPtComPt[]

  const slots = new Map<string, SlotPt[]>()
  for (const t of escalaSemana) {
    if (!t.pt) continue
    const chave = chaveSlot(t.data, t.hora, t.minuto)
    const lista = slots.get(chave) ?? []
    lista.push({ pt_id: t.pt.id, nome: t.pt.nome })
    slots.set(chave, lista)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← Voltar
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Coordenação
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {estudio.nome} · o dia de hoje, pendências e horas da equipa.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Hoje
      </h2>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
          <h3 className="text-xs font-semibold text-zinc-500">Escala</h3>
          {escalaHoje.length === 0 ? (
            <p className="mt-1 text-sm text-zinc-400">Sem turnos marcados.</p>
          ) : (
            <ul className="mt-1 flex flex-col gap-0.5 text-sm text-black dark:text-zinc-50">
              {escalaHoje.map((e, i) => (
                <li key={i}>
                  {String(e.hora).padStart(2, '0')}:{String(e.minuto).padStart(2, '0')} —{' '}
                  {e.pt?.nome ?? '—'}
                </li>
              ))}
            </ul>
          )}
          <Link
            href="#planeamento"
            className="mt-2 inline-block text-xs text-zinc-500 underline"
          >
            planear semana
          </Link>
        </div>

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

      <h2
        id="planeamento"
        className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500"
      >
        Planeamento da semana
      </h2>
      <div className="mt-2 flex items-center gap-3">
        <Link
          href={`/painel/${slug}/coordenacao?semana=${semanaAnterior}`}
          className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
        >
          ←
        </Link>
        <span className="text-sm font-medium">
          {fmt(diasSemana[0])} – {fmt(diasSemana[6])}
        </span>
        <Link
          href={`/painel/${slug}/coordenacao?semana=${semanaSeguinte}`}
          className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
        >
          →
        </Link>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Clica num horário para marcar ou mudar quem trabalha (até 3 pessoas em simultâneo). A
        equipa vê esta escala em &quot;Horários&quot;, só para consulta.
      </p>
      <div className="mt-4">
        <GrelhaHorarios
          editavel
          dias={diasSemana}
          slots={slots}
          pts={listaPts}
          estudioSlug={slug}
          estudioId={estudio.id}
          semana={inicioSemana}
          editar={editar}
          action={guardarSlot}
        />
      </div>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-amber-600">
        Pendências
      </h2>
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

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Registar horas
      </h2>
      <form action={registarHoras} className="mt-2 flex flex-wrap items-end gap-2">
        <input type="hidden" name="estudio_slug" value={slug} />
        <input type="hidden" name="estudio_id" value={estudio.id} />
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Dia</label>
          <input type="date" name="data" defaultValue={hoje} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Horas</label>
          <input type="number" step="0.5" name="horas" defaultValue={0} className={`${inputCls} w-20`} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Treinos 40 min</label>
          <input type="number" name="treinos_40" defaultValue={0} className={`${inputCls} w-20`} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Treinos 60 min</label>
          <input type="number" name="treinos_60" defaultValue={0} className={`${inputCls} w-20`} />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs text-zinc-500">Nota</label>
          <input name="nota" className={`${inputCls} w-full`} />
        </div>
        <SubmitButton
          pendingText="A guardar…"
          className="rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background"
        >
          Registar
        </SubmitButton>
      </form>

      <div className="mt-3 flex flex-col gap-2">
        {registos.map((r) => {
          const podeEditar = ehGestao || r.pt_id === userData.user?.id
          return (
            <form
              key={r.id}
              action={atualizarHoras}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-black/10 bg-white p-2.5 text-sm dark:border-white/10 dark:bg-zinc-950"
            >
              <input type="hidden" name="estudio_slug" value={slug} />
              <input type="hidden" name="id" value={r.id} />
              <span className="w-20 text-xs text-zinc-500">{fmt(r.data)}</span>
              <span className="w-28 font-medium text-black dark:text-zinc-50">
                {r.pt?.nome ?? '—'}
              </span>
              {podeEditar ? (
                <>
                  <input
                    type="number"
                    step="0.5"
                    name="horas"
                    defaultValue={r.horas}
                    className={`${inputCls} w-16`}
                  />
                  <input
                    type="number"
                    name="treinos_40"
                    defaultValue={r.treinos_40}
                    title="Treinos 40 min"
                    className={`${inputCls} w-14`}
                  />
                  <input
                    type="number"
                    name="treinos_60"
                    defaultValue={r.treinos_60}
                    title="Treinos 60 min"
                    className={`${inputCls} w-14`}
                  />
                  <input
                    name="nota"
                    defaultValue={r.nota ?? ''}
                    className={`${inputCls} flex-1`}
                  />
                  <SubmitButton
                    pendingText="…"
                    className="rounded-md border border-black/10 px-2 py-1 text-xs dark:border-white/10"
                  >
                    Guardar
                  </SubmitButton>
                </>
              ) : (
                <span className="text-xs text-zinc-500">
                  {r.horas}h · {r.treinos_40}×40min · {r.treinos_60}×60min
                  {r.nota && ` · ${r.nota}`}
                </span>
              )}
            </form>
          )
        })}
      </div>
      {registos.length === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-black/10 p-6 text-center text-sm text-zinc-500 dark:border-white/10">
          Ainda não há registos de horas.
        </div>
      )}
    </div>
  )
}
