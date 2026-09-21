import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { fmt } from '@/lib/data/presencas'
import { guardarConfig, criarPlano, atualizarPlano } from './actions'
import SubmitButton from '@/components/SubmitButton'
import TituloSeccao from '@/components/TituloSeccao'
import type {
  ConfigLinha,
  LeadParada,
  Plano,
  ReavaliacaoPendente,
} from '@/lib/supabase/database.types'

const inputCls =
  'rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900 dark:focus:border-white/30'

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { estudio: slug } = await params
  const { error } = await searchParams

  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) {
    notFound()
  }

  const [
    { data: leadsParadasData, error: erroLeads },
    { data: reavaliacoesData, error: erroReavaliacoes },
    { data: planosData, error: erroPlanos },
    { data: configData, error: erroConfig },
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
    supabase.from('planos').select('*').order('valor'),
    supabase.from('config').select('*').order('chave'),
  ])

  if (erroLeads || erroReavaliacoes || erroPlanos || erroConfig) {
    throw new Error((erroLeads ?? erroReavaliacoes ?? erroPlanos ?? erroConfig)!.message)
  }

  const leadsParadas = (leadsParadasData ?? []) as LeadParada[]
  const reavaliacoes = (reavaliacoesData ?? []) as ReavaliacaoPendente[]
  const planos = (planosData ?? []) as Plano[]
  const config = (configData ?? []) as ConfigLinha[]

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← Voltar
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Administração
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {estudio.nome} · alertas de gestão, planos e definições do negócio.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <TituloSeccao cor="ambar">Leads paradas ({leadsParadas.length})</TituloSeccao>
      {leadsParadas.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">Nenhuma — todos os leads ativos em dia.</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {leadsParadas.map((l) => (
            <Link
              key={l.id}
              href={`/painel/${slug}/leads/${l.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm transition-colors hover:border-amber-300 dark:border-amber-900 dark:bg-amber-950"
            >
              <span className="font-medium text-black dark:text-zinc-50">
                {l.nome} <span className="text-xs text-zinc-500">· {l.estado}</span>
              </span>
              <span className="text-xs text-amber-700 dark:text-amber-300">
                {l.dias_sem_contacto} dias sem contacto
              </span>
            </Link>
          ))}
        </div>
      )}

      <TituloSeccao cor="ambar">Reavaliações pendentes ({reavaliacoes.length})</TituloSeccao>
      {reavaliacoes.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">Nenhuma — reavaliações todas em dia.</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {reavaliacoes.map((r) => (
            <Link
              key={r.cliente_id}
              href={`/painel/${slug}/avaliacoes/${r.cliente_id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm transition-colors hover:border-amber-300 dark:border-amber-900 dark:bg-amber-950"
            >
              <span className="font-medium text-black dark:text-zinc-50">{r.nome}</span>
              <span className="text-xs text-amber-700 dark:text-amber-300">
                {r.ultima_avaliacao ? `última em ${fmt(r.ultima_avaliacao)}` : 'nunca avaliado'}
                {r.dias_para_reavaliar !== null &&
                  ` · ${r.dias_para_reavaliar <= 0 ? 'vencida' : `${r.dias_para_reavaliar} dias`}`}
              </span>
            </Link>
          ))}
        </div>
      )}

      <TituloSeccao cor="verde">Planos</TituloSeccao>
      <div className="mt-2 flex flex-col gap-2">
        {planos.map((p) => (
          <form
            key={p.id}
            action={atualizarPlano}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950"
          >
            <input type="hidden" name="estudio_slug" value={slug} />
            <input type="hidden" name="id" value={p.id} />
            <input
              name="nome"
              defaultValue={p.nome}
              className={`${inputCls} flex-1 basis-40`}
            />
            <input
              name="valor"
              type="number"
              step="0.01"
              defaultValue={p.valor}
              className={`${inputCls} w-24`}
            />
            <input
              name="sessoes_por_semana"
              type="number"
              placeholder="sessões/sem"
              defaultValue={p.sessoes_por_semana ?? ''}
              className={`${inputCls} w-28`}
            />
            <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
              <input type="checkbox" name="ativo" defaultChecked={p.ativo} /> ativo
            </label>
            <SubmitButton
              pendingText="…"
              className="rounded-md border border-black/10 px-3 py-1.5 text-xs font-medium dark:border-white/10"
            >
              Guardar
            </SubmitButton>
          </form>
        ))}
      </div>

      <form
        action={criarPlano}
        className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-black/20 p-3 dark:border-white/20"
      >
        <input type="hidden" name="estudio_slug" value={slug} />
        <input name="nome" required placeholder="Nome do plano" className={`${inputCls} flex-1 basis-40`} />
        <input
          name="valor"
          type="number"
          step="0.01"
          required
          placeholder="Valor (€)"
          className={`${inputCls} w-24`}
        />
        <input
          name="sessoes_por_semana"
          type="number"
          placeholder="sessões/sem"
          className={`${inputCls} w-28`}
        />
        <SubmitButton
          pendingText="A criar…"
          className="rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background"
        >
          + Plano
        </SubmitButton>
      </form>

      <TituloSeccao cor="neutro">Definições do negócio</TituloSeccao>
      <div className="mt-2 flex flex-col gap-2">
        {config.map((c) => (
          <form
            key={c.chave}
            action={guardarConfig}
            className="flex flex-col gap-1.5 rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950"
          >
            <input type="hidden" name="estudio_slug" value={slug} />
            <input type="hidden" name="chave" value={c.chave} />
            <label className="text-xs font-medium text-zinc-500">{c.chave}</label>
            <div className="flex items-end gap-2">
              {c.chave.includes('msg') ? (
                <textarea name="valor" defaultValue={c.valor ?? ''} rows={2} className={`${inputCls} flex-1`} />
              ) : (
                <input name="valor" defaultValue={c.valor ?? ''} className={`${inputCls} flex-1`} />
              )}
              <SubmitButton
                pendingText="…"
                className="rounded-md border border-black/10 px-3 py-1.5 text-xs font-medium dark:border-white/10"
              >
                Guardar
              </SubmitButton>
            </div>
          </form>
        ))}
      </div>
    </div>
  )
}
