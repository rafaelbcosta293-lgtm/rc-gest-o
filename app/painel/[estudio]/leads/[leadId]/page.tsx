import Link from 'next/link'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudios, getEstudioPorSlug, getEquipaDoEstudio } from '@/lib/data/estudios'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { ESTADOS_LEAD, TIPOS_CONTACTO } from '@/lib/data/constantes'
import { fmt } from '@/lib/data/presencas'
import {
  adicionarContacto,
  agendarExperimental,
  apagarLead,
  atualizarLead,
  converterEmCliente,
  moverLeadEstudio,
} from '../actions'
import LeadForm from '../LeadForm'
import ContactoRapido from '../ContactoRapido'
import SubmitButton from '@/components/SubmitButton'
import ApagarComConfirmacao from '@/components/ApagarComConfirmacao'
import ConfirmarAcao from '@/components/ConfirmarAcao'
import type { Activity, LeadContacto } from '@/lib/supabase/database.types'

export default async function LeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string; leadId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { estudio: slug, leadId } = await params
  const { error } = await searchParams

  const supabase = await createClient()
  const [
    estudio,
    { data: lead },
    { data: contactosData, error: erroContactos },
    { data: atividadesData, error: erroAtividades },
    todosEstudios,
    sessao,
  ] = await Promise.all([
    getEstudioPorSlug(supabase, slug),
    supabase.from('leads').select('*').eq('id', leadId).maybeSingle(),
    supabase
      .from('lead_contactos')
      .select('*, feito:perfis!feito_por(nome)')
      .eq('lead_id', leadId)
      .order('data', { ascending: false })
      .order('criado_em', { ascending: false }),
    supabase
      .from('activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('criado_em', { ascending: false }),
    getEstudios(supabase),
    getSessaoAtual(),
  ])

  if (!estudio || !lead || lead.estudio_id !== estudio.id) {
    notFound()
  }

  if (erroContactos) {
    throw new Error(erroContactos.message)
  }
  if (erroAtividades) {
    throw new Error(erroAtividades.message)
  }

  const { ehGestao } = papeisDaSessao(sessao)
  const outrosEstudios = todosEstudios.filter((e) => e.slug !== slug)
  const pts = await getEquipaDoEstudio(supabase, estudio.id)

  const contactos = (contactosData ?? []) as unknown as (LeadContacto & {
    feito: { nome: string } | null
  })[]
  const atividades = (atividadesData ?? []) as Activity[]
  const cor = ESTADOS_LEAD[lead.estado as keyof typeof ESTADOS_LEAD]

  // Linha do tempo unificada: cada contacto manual e cada transição
  // automática (registada em "activities" pelo trigger da lead) entram
  // juntos, ordenados por data, sem duplicar o que já existe em
  // "lead_contactos".
  type ItemTimeline = { id: string; criadoEm: string; node: ReactNode }
  const timeline: ItemTimeline[] = [
    ...contactos.map((c) => ({
      id: `contacto-${c.id}`,
      criadoEm: c.criado_em,
      node: (
        <div
          key={`contacto-${c.id}`}
          className="rounded-lg border border-border-subtle bg-surface p-3 text-sm"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span>{fmt(c.data)}</span>
            <span>· {c.tipo}</span>
            {c.feito && <span>· {c.feito.nome}</span>}
          </div>
          <p className="mt-1 text-foreground">{c.resultado}</p>
          {c.nota && <p className="mt-1 text-xs text-muted">{c.nota}</p>}
        </div>
      ),
    })),
    ...atividades.map((a) => ({
      id: `atividade-${a.id}`,
      criadoEm: a.criado_em,
      node: (
        <div
          key={`atividade-${a.id}`}
          className="rounded-lg border border-dashed border-border-subtle bg-foreground/[0.02] p-3 text-sm"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span>{fmt(a.criado_em.slice(0, 10))}</span>
            <span>· {a.tipo}</span>
          </div>
          {a.descricao && <p className="mt-1 text-foreground">{a.descricao}</p>}
        </div>
      ),
    })),
  ].sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href={`/painel/${slug}/leads`}
        className="text-sm text-muted underline"
      >
        ← Leads
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-foreground">{lead.nome}</h1>
        <span
          className="rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ background: cor.bg, color: cor.tx }}
        >
          {lead.estado}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        entrada em {fmt(lead.entrada)}
        {lead.telefone && ` · ${lead.telefone}`}
        {lead.email && ` · ${lead.email}`}
      </p>

      <ContactoRapido nome={lead.nome} telefone={lead.telefone} estudioSlug={slug} />

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {lead.cliente_id ? (
        <Link
          href={`/painel/${slug}/treinos/${lead.cliente_id}`}
          className="mt-4 inline-block rounded-full bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
        >
          ✓ Ganha — ver ficha de cliente
        </Link>
      ) : (
        <details className="mt-4 rounded-xl border border-teal-300 bg-teal-50 p-4 dark:bg-teal-950">
          <summary className="cursor-pointer text-sm font-semibold text-teal-800 dark:text-teal-200">
            Converter em cliente
          </summary>
          <form action={converterEmCliente} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="estudio_slug" value={slug} />
            <input type="hidden" name="estudio_id" value={estudio.id} />
            <input type="hidden" name="lead_id" value={lead.id} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                name="nome"
                required
                defaultValue={lead.nome}
                placeholder="Nome"
                className="rounded-md border border-border-subtle px-3 py-2 text-sm dark:bg-zinc-900"
              />
              <input
                name="telefone"
                defaultValue={lead.telefone ?? ''}
                placeholder="Telefone"
                className="rounded-md border border-border-subtle px-3 py-2 text-sm dark:bg-zinc-900"
              />
              <input
                name="email"
                defaultValue={lead.email ?? ''}
                placeholder="Email"
                className="rounded-md border border-border-subtle px-3 py-2 text-sm dark:bg-zinc-900"
              />
              <input
                name="objetivo"
                defaultValue={lead.objetivo ?? ''}
                placeholder="Objetivo"
                className="rounded-md border border-border-subtle px-3 py-2 text-sm dark:bg-zinc-900"
              />
            </div>
            <SubmitButton
              pendingText="A criar cliente…"
              className="self-start rounded-full bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
            >
              Criar cliente a partir deste lead
            </SubmitButton>
          </form>
        </details>
      )}

      {!lead.cliente_id && lead.estado !== 'Perdida' && (
        <details className="mt-3 rounded-xl border border-[#5B3FA0]/30 bg-[#EBE6F8] p-4 dark:bg-[#2A2240]">
          <summary className="cursor-pointer text-sm font-semibold text-[#5B3FA0] dark:text-[#C9B8F0]">
            Agendar experimental
          </summary>
          <form action={agendarExperimental} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="estudio_slug" value={slug} />
            <input type="hidden" name="estudio_id" value={estudio.id} />
            <input type="hidden" name="lead_id" value={lead.id} />
            <input type="hidden" name="nome_lead" value={lead.nome} />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Dia</label>
              <input
                type="date"
                name="data"
                required
                defaultValue={lead.visita_data ?? ''}
                className="rounded-md border border-border-subtle px-3 py-2 text-sm dark:bg-zinc-900"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Hora</label>
              <input
                type="time"
                name="hora_inicio"
                required
                defaultValue={lead.visita_hora ?? ''}
                className="rounded-md border border-border-subtle px-3 py-2 text-sm dark:bg-zinc-900"
              />
            </div>
            <SubmitButton
              pendingText="A agendar…"
              className="rounded-full bg-[#5B3FA0] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4A3283]"
            >
              Agendar e marcar na Agenda
            </SubmitButton>
          </form>
        </details>
      )}

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Editar lead
      </h2>
      <LeadForm
        estudioSlug={slug}
        estudioId={estudio.id}
        pts={pts}
        lead={lead}
        action={atualizarLead}
      />

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Registar contacto
      </h2>
      <form action={adicionarContacto} className="mt-2 flex flex-wrap items-end gap-3">
        <input type="hidden" name="estudio_slug" value={slug} />
        <input type="hidden" name="lead_id" value={lead.id} />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Dia</label>
          <input
            type="date"
            name="data"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="rounded-md border border-border-subtle px-3 py-2 text-sm dark:bg-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Tipo</label>
          <select
            name="tipo"
            defaultValue="Telefone"
            className="rounded-md border border-border-subtle px-3 py-2 text-sm dark:bg-zinc-900"
          >
            {TIPOS_CONTACTO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col justify-end gap-1.5 pb-2.5">
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" name="sucesso" defaultChecked />
            Conseguiu falar com a lead
          </label>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Resultado
          </label>
          <input
            name="resultado"
            required
            placeholder="ex.: não atendeu, marcou visita para sexta"
            className="w-full rounded-md border border-border-subtle px-3 py-2 text-sm dark:bg-zinc-900"
          />
        </div>
        <SubmitButton
          pendingText="A registar…"
          className="rounded-full border border-border-strong px-4 py-2 text-sm font-bold hover:bg-foreground/[.08]"
        >
          Registar
        </SubmitButton>
      </form>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Linha do tempo ({timeline.length})
      </h2>
      {timeline.length === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-border-subtle p-6 text-center text-sm text-zinc-500">
          Ainda não há atividade registada.
        </div>
      )}
      <div className="mt-3 flex flex-col gap-2">{timeline.map((item) => item.node)}</div>

      {ehGestao && !lead.cliente_id && outrosEstudios.length > 0 && (
        <div className="mt-8 border-t border-border-subtle pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Corrigir estúdio
          </h2>
          <p className="mt-1 text-xs text-muted">
            Útil para leads da Meta Ads que caem sempre no mesmo estúdio por omissão — move esta
            lead para o estúdio certo sem perder o estado no funil nem o histórico.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {outrosEstudios.map((e) => (
              <ConfirmarAcao
                key={e.id}
                action={moverLeadEstudio}
                confirmacao={`Mover "${lead.nome}" para ${e.nome}? Mantém o estado atual ("${lead.estado}") e o histórico — só muda o estúdio.`}
              >
                <input type="hidden" name="estudio_slug_atual" value={slug} />
                <input type="hidden" name="estudio_slug_destino" value={e.slug} />
                <input type="hidden" name="lead_id" value={lead.id} />
                <SubmitButton
                  pendingText="A mover…"
                  className="rounded-full border border-border-strong px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/[.08]"
                >
                  Mover para {e.nome}
                </SubmitButton>
              </ConfirmarAcao>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 border-t border-border-subtle pt-6">
        <ApagarComConfirmacao
          action={apagarLead}
          confirmacao={`Apagar o lead "${lead.nome}"? Apaga também os contactos e a linha do tempo registados. Não é possível desfazer.`}
          campos={{ estudio_slug: slug, id: lead.id }}
          className="rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
        >
          Apagar lead
        </ApagarComConfirmacao>
      </div>
    </div>
  )
}
