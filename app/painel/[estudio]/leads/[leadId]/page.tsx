import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { ESTADOS_LEAD, TIPOS_CONTACTO } from '@/lib/data/constantes'
import { fmt } from '@/lib/data/presencas'
import { adicionarContacto, atualizarLead, converterEmCliente } from '../actions'
import LeadForm from '../LeadForm'
import SubmitButton from '@/components/SubmitButton'
import type { LeadContacto } from '@/lib/supabase/database.types'

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
  const [estudio, { data: lead }, { data: pts }, { data: contactosData, error: erroContactos }] =
    await Promise.all([
      getEstudioPorSlug(supabase, slug),
      supabase.from('leads').select('*').eq('id', leadId).maybeSingle(),
      supabase.from('perfis').select('id, nome').order('nome'),
      supabase
        .from('lead_contactos')
        .select('*, feito:perfis!feito_por(nome)')
        .eq('lead_id', leadId)
        .order('data', { ascending: false })
        .order('criado_em', { ascending: false }),
    ])

  if (!estudio || !lead || lead.estudio_id !== estudio.id) {
    notFound()
  }

  if (erroContactos) {
    throw new Error(erroContactos.message)
  }

  const contactos = (contactosData ?? []) as unknown as (LeadContacto & {
    feito: { nome: string } | null
  })[]
  const cor = ESTADOS_LEAD[lead.estado as keyof typeof ESTADOS_LEAD]

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/painel/${slug}/leads`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← Leads
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">{lead.nome}</h1>
        <span
          className="rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ background: cor.bg, color: cor.tx }}
        >
          {lead.estado}
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        entrada em {fmt(lead.entrada)}
        {lead.telefone && ` · ${lead.telefone}`}
        {lead.email && ` · ${lead.email}`}
      </p>

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
          ✓ Convertido — ver ficha de cliente
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
                className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900"
              />
              <input
                name="telefone"
                defaultValue={lead.telefone ?? ''}
                placeholder="Telefone"
                className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900"
              />
              <input
                name="email"
                defaultValue={lead.email ?? ''}
                placeholder="Email"
                className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900"
              />
              <input
                name="objetivo"
                defaultValue={lead.objetivo ?? ''}
                placeholder="Objetivo"
                className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900"
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

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Editar lead
      </h2>
      <LeadForm
        estudioSlug={slug}
        estudioId={estudio.id}
        pts={pts ?? []}
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
            className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Tipo</label>
          <select
            name="tipo"
            defaultValue="Telefone"
            className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900"
          >
            {TIPOS_CONTACTO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Resultado
          </label>
          <input
            name="resultado"
            required
            placeholder="ex.: não atendeu, marcou visita para sexta"
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900"
          />
        </div>
        <SubmitButton
          pendingText="A registar…"
          className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
        >
          Registar
        </SubmitButton>
      </form>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Histórico de contactos ({contactos.length})
      </h2>
      {contactos.length === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-black/10 p-6 text-center text-sm text-zinc-500 dark:border-white/10">
          Ainda não há contactos registados.
        </div>
      )}
      <div className="mt-3 flex flex-col gap-2">
        {contactos.map((c) => (
          <div
            key={c.id}
            className="rounded-lg border border-black/10 bg-white p-3 text-sm dark:border-white/10 dark:bg-zinc-950"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span>{fmt(c.data)}</span>
              <span>· {c.tipo}</span>
              {c.feito && <span>· {c.feito.nome}</span>}
            </div>
            <p className="mt-1 text-black dark:text-zinc-50">{c.resultado}</p>
            {c.nota && <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{c.nota}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
