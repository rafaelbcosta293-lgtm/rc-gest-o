import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { criarTarefa, removerTarefa, marcarFeita, desfazerFeita } from './actions'
import SubmitButton from '@/components/SubmitButton'
import type { TarefaDiaria, TarefaDiariaConcluida } from '@/lib/supabase/database.types'

type ConcluidaComNome = TarefaDiariaConcluida & { feito: { nome: string } | null }

export default async function TarefasPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { estudio: slug } = await params
  const { error } = await searchParams
  const hoje = new Date().toISOString().slice(0, 10)

  const supabase = await createClient()
  const [estudio, sessao] = await Promise.all([getEstudioPorSlug(supabase, slug), getSessaoAtual()])
  if (!estudio) {
    notFound()
  }
  const { ehGestao } = papeisDaSessao(sessao)

  const { data: tarefasData, error: erroTarefas } = await supabase
    .from('tarefas_diarias')
    .select('*')
    .eq('estudio_id', estudio.id)
    .eq('ativa', true)
    .order('ordem')
    .order('criado_em')

  if (erroTarefas) {
    throw new Error(erroTarefas.message)
  }
  const tarefas = (tarefasData ?? []) as TarefaDiaria[]

  const { data: feitasData, error: erroFeitas } =
    tarefas.length > 0
      ? await supabase
          .from('tarefas_diarias_concluidas')
          .select('*, feito:perfis!feito_por(nome)')
          .in(
            'tarefa_id',
            tarefas.map((t) => t.id)
          )
          .eq('data', hoje)
      : { data: [], error: null }

  if (erroFeitas) {
    throw new Error(erroFeitas.message)
  }
  const feitas = (feitasData ?? []) as unknown as ConcluidaComNome[]
  const feitaPorTarefa = new Map(feitas.map((f) => [f.tarefa_id, f]))
  const totalFeitas = feitas.length

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← Voltar
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            Tarefas diárias
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {estudio.nome} · {totalFeitas} de {tarefas.length} feitas hoje
          </p>
        </div>
      </div>

      {tarefas.length > 0 && (
        <>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-teal-600"
              style={{ width: `${Math.round((totalFeitas / tarefas.length) * 100)}%` }}
            />
          </div>
          {totalFeitas >= tarefas.length ? (
            <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800 dark:bg-teal-950 dark:text-teal-200">
              ✓ Todas as tarefas de hoje estão feitas.
            </p>
          ) : (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              Faltam {tarefas.length - totalFeitas} de {tarefas.length} tarefas hoje.
            </p>
          )}
        </>
      )}

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {ehGestao && (
        <form action={criarTarefa} className="mt-6 flex gap-2">
          <input type="hidden" name="estudio_slug" value={slug} />
          <input type="hidden" name="estudio_id" value={estudio.id} />
          <input
            name="titulo"
            required
            placeholder="Nova tarefa… ex.: repor gel de banho"
            className="flex-1 rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900"
          />
          <SubmitButton
            pendingText="…"
            className="shrink-0 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            + Adicionar
          </SubmitButton>
        </form>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {tarefas.map((t) => {
          const feita = feitaPorTarefa.get(t.id)
          return (
            <div
              key={t.id}
              className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                feita
                  ? 'border-teal-200 bg-teal-50 dark:border-teal-900 dark:bg-teal-950'
                  : 'border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950'
              }`}
            >
              {feita ? (
                <form action={desfazerFeita}>
                  <input type="hidden" name="estudio_slug" value={slug} />
                  <input type="hidden" name="id" value={feita.id} />
                  <SubmitButton
                    pendingText="…"
                    aria-label="Desmarcar"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-teal-600 text-sm text-white"
                  >
                    ✓
                  </SubmitButton>
                </form>
              ) : (
                <form action={marcarFeita}>
                  <input type="hidden" name="estudio_slug" value={slug} />
                  <input type="hidden" name="tarefa_id" value={t.id} />
                  <input type="hidden" name="data" value={hoje} />
                  <SubmitButton
                    pendingText="…"
                    aria-label="Marcar como feita"
                    className="h-6 w-6 shrink-0 rounded-md border-2 border-zinc-300 dark:border-zinc-700"
                  >
                    <span />
                  </SubmitButton>
                </form>
              )}

              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm ${feita ? 'text-teal-800 line-through dark:text-teal-300' : 'text-black dark:text-zinc-50'}`}
                >
                  {t.titulo}
                </p>
                {feita && (
                  <p className="text-xs text-teal-700 dark:text-teal-400">
                    feito por {feita.feito?.nome ?? '—'}
                  </p>
                )}
              </div>

              {ehGestao && (
                <form action={removerTarefa}>
                  <input type="hidden" name="estudio_slug" value={slug} />
                  <input type="hidden" name="id" value={t.id} />
                  <SubmitButton
                    pendingText="…"
                    aria-label="Remover tarefa"
                    className="shrink-0 text-lg text-zinc-400 hover:text-red-600"
                  >
                    ×
                  </SubmitButton>
                </form>
              )}
            </div>
          )
        })}
      </div>

      {tarefas.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-black/10 p-8 text-center text-sm text-zinc-500 dark:border-white/10">
          {ehGestao
            ? 'Ainda não há tarefas — acrescenta a primeira acima.'
            : 'Ainda não há tarefas diárias configuradas.'}
        </div>
      )}
    </div>
  )
}
