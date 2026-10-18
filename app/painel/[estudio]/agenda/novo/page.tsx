import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEquipaDoEstudio } from '@/lib/data/estudios'
import { TIPOS_EVENTO_AGENDA } from '@/lib/data/agenda'
import { criarEvento } from '../actions'
import SubmitButton from '@/components/SubmitButton'

const inputCls =
  'rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-brand'

export default async function NovoEventoPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ data?: string; error?: string }>
}) {
  const { estudio: slug } = await params
  const { data: dataParam, error } = await searchParams
  const hoje = new Date().toISOString().slice(0, 10)
  const dataInicial = dataParam ?? hoje

  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) {
    notFound()
  }

  const [pts, { data: clientesData, error: erroClientes }] = await Promise.all([
    getEquipaDoEstudio(supabase, estudio.id),
    supabase
      .from('clientes')
      .select('id, nome')
      .eq('estudio_id', estudio.id)
      .neq('estado', 'Ex-cliente')
      .order('nome'),
  ])
  if (erroClientes) {
    throw new Error(erroClientes.message)
  }
  const clientes = (clientesData ?? []) as { id: string; nome: string }[]

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/painel/${slug}/agenda`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar à agenda
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Novo evento</h1>
      <p className="mt-1 text-sm text-muted">{estudio.nome}</p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {decodeURIComponent(error)}
        </p>
      )}

      <form action={criarEvento} className="mt-6 flex flex-col gap-5">
        <input type="hidden" name="estudio_slug" value={slug} />
        <input type="hidden" name="estudio_id" value={estudio.id} />

        <div>
          <label className="text-xs font-semibold text-muted">Tipo</label>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5 rounded-full bg-border-subtle p-1">
            {TIPOS_EVENTO_AGENDA.map((t) => (
              <label key={t} className="relative">
                <input
                  type="radio"
                  name="tipo"
                  value={t}
                  defaultChecked={t === 'Treino'}
                  className="peer sr-only"
                />
                <span className="block cursor-pointer rounded-full px-1.5 py-1.5 text-center text-[11px] font-semibold text-muted transition-all peer-checked:bg-surface peer-checked:text-foreground peer-checked:shadow-pop">
                  {t}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted">Cliente (opcional)</label>
            <select name="cliente_id" defaultValue="" className={inputCls}>
              <option value="">— Reunião / outro (sem cliente) —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted">Instrutor (opcional)</label>
            <select name="pt_id" defaultValue="" className={inputCls}>
              <option value="">— Sem instrutor —</option>
              {pts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted">
            Título (só se não houver cliente — ex: &quot;Briefing de equipa&quot;)
          </label>
          <input name="titulo" className={inputCls} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted">Data</label>
            <input type="date" name="data" defaultValue={dataInicial} required className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted">Hora</label>
            <input type="time" name="hora_inicio" defaultValue="09:00" required className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted">Duração</label>
            <select name="duracao_min" defaultValue="40" className={inputCls}>
              {[30, 40, 45, 60, 90, 120].map((min) => (
                <option key={min} value={min}>
                  {min} min
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-border-subtle bg-surface p-4 shadow-card">
          <label className="text-xs font-semibold text-muted">Repetição</label>
          <select name="repeticao" defaultValue="nao" className={`${inputCls} mt-1.5 w-full`}>
            <option value="nao">Não repete</option>
            <option value="semanal">Semanal</option>
            <option value="quinzenal">Quinzenal</option>
          </select>
          <p className="mt-2 text-xs text-muted">
            Se repetir, preenche um dos dois campos abaixo (se deixares os dois em branco, repete 8 vezes).
          </p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted">Repetir até</label>
              <input type="date" name="repete_ate" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted">Número de vezes</label>
              <input type="number" name="repete_vezes" min={1} max={52} className={inputCls} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted">Nota (opcional)</label>
          <textarea name="nota" rows={3} className={inputCls} />
        </div>

        <SubmitButton
          pendingText="A criar…"
          className="self-start rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black shadow-pop hover:bg-brand-strong"
        >
          Criar evento
        </SubmitButton>
      </form>
    </div>
  )
}
