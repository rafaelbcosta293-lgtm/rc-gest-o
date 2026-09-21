import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { fmt } from '@/lib/data/presencas'
import { somarDias } from '@/lib/data/horarios'
import { RECORRENCIAS } from '@/lib/data/constantes'
import { criarTarefa, removerTarefa, marcarFeita, desfazerFeita } from './actions'
import SubmitButton from '@/components/SubmitButton'
import type { TarefaDiaria, TarefaDiariaConcluida } from '@/lib/supabase/database.types'

type ConcluidaComNome = TarefaDiariaConcluida & { feito: { nome: string } | null }

export default async function TarefasPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ error?: string; dia?: string }>
}) {
  const { estudio: slug } = await params
  const { error, dia: diaParam } = await searchParams
  const hoje = new Date().toISOString().slice(0, 10)
  const dia = diaParam || hoje
  const diaEhHoje = dia === hoje
  const diaEhPassado = dia < hoje
  const diaAnterior = somarDias(dia, -1)
  const diaSeguinte = somarDias(dia, 1)

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
          .eq('data', dia)
      : { data: [], error: null }

  if (erroFeitas) {
    throw new Error(erroFeitas.message)
  }
  const feitasNoDia = (feitasData ?? []) as unknown as ConcluidaComNome[]
  const feitaPorTarefa = new Map(feitasNoDia.map((f) => [f.tarefa_id, f]))

  // Um dia passado é só histórico (o que foi mesmo feito nesse dia) — não
  // faz sentido mostrar "pendente" para trás no tempo. Hoje e dias
  // futuros mostram o que está por fazer, consoante "proxima_data".
  const pendentes = diaEhPassado
    ? []
    : tarefas.filter((t) => t.proxima_data <= dia && !feitaPorTarefa.has(t.id))
  const idsNoDia = new Set([...pendentes.map((t) => t.id), ...feitaPorTarefa.keys()])
  const listaDia = tarefas.filter((t) => idsNoDia.has(t.id))
  const futuras = tarefas
    .filter((t) => t.proxima_data > dia && !feitaPorTarefa.has(t.id))
    .sort((a, b) => a.proxima_data.localeCompare(b.proxima_data))

  const totalDia = listaDia.length
  const totalFeitas = feitasNoDia.length

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
            {estudio.nome}
            {diaEhHoje ? ` · ${totalFeitas} de ${totalDia} feitas hoje` : ` · a ver ${fmt(dia)}`}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <Link
          href={`/painel/${slug}/tarefas?dia=${diaAnterior}`}
          className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
        >
          ←
        </Link>
        <span className="text-sm font-medium text-black dark:text-zinc-50">
          {diaEhHoje ? 'Hoje' : fmt(dia)}
        </span>
        <Link
          href={`/painel/${slug}/tarefas?dia=${diaSeguinte}`}
          className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
        >
          →
        </Link>
        {!diaEhHoje && (
          <Link
            href={`/painel/${slug}/tarefas`}
            className="text-xs text-zinc-500 underline"
          >
            voltar a hoje
          </Link>
        )}
      </div>

      {diaEhHoje && totalDia > 0 && (
        <>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-teal-600"
              style={{ width: `${Math.round((totalFeitas / totalDia) * 100)}%` }}
            />
          </div>
          {totalFeitas >= totalDia ? (
            <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800 dark:bg-teal-950 dark:text-teal-200">
              ✓ Todas as tarefas de hoje estão feitas.
            </p>
          ) : (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              Faltam {totalDia - totalFeitas} de {totalDia} tarefas hoje.
            </p>
          )}
        </>
      )}

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {ehGestao && diaEhHoje && (
        <form action={criarTarefa} className="mt-6 flex flex-wrap gap-2">
          <input type="hidden" name="estudio_slug" value={slug} />
          <input type="hidden" name="estudio_id" value={estudio.id} />
          <input
            name="titulo"
            required
            placeholder="Nova tarefa… ex.: repor gel de banho"
            className="min-w-[180px] flex-1 rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900"
          />
          <select
            name="recorrencia"
            defaultValue="Diária"
            className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900"
          >
            {RECORRENCIAS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <SubmitButton
            pendingText="…"
            className="shrink-0 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            + Adicionar
          </SubmitButton>
        </form>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {listaDia.map((t) => {
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
              {diaEhHoje ? (
                feita ? (
                  <form action={desfazerFeita}>
                    <input type="hidden" name="estudio_slug" value={slug} />
                    <input type="hidden" name="id" value={feita.id} />
                    <input type="hidden" name="tarefa_id" value={t.id} />
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
                    <input type="hidden" name="recorrencia" value={t.recorrencia} />
                    <SubmitButton
                      pendingText="…"
                      aria-label="Marcar como feita"
                      className="h-6 w-6 shrink-0 rounded-md border-2 border-zinc-300 dark:border-zinc-700"
                    >
                      <span />
                    </SubmitButton>
                  </form>
                )
              ) : (
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm text-white ${
                    feita ? 'bg-teal-600' : 'border-2 border-zinc-300 dark:border-zinc-700'
                  }`}
                >
                  {feita ? '✓' : ''}
                </span>
              )}

              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm ${feita ? 'text-teal-800 line-through dark:text-teal-300' : 'text-black dark:text-zinc-50'}`}
                >
                  {t.titulo}
                  {t.recorrencia !== 'Diária' && (
                    <span className="ml-1.5 text-xs font-normal text-zinc-400">
                      · {t.recorrencia.toLowerCase()}
                    </span>
                  )}
                </p>
                {feita && (
                  <p className="text-xs text-teal-700 dark:text-teal-400">
                    feito por {feita.feito?.nome ?? '—'}
                  </p>
                )}
              </div>

              {ehGestao && diaEhHoje && (
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

      {listaDia.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-black/10 p-8 text-center text-sm text-zinc-500 dark:border-white/10">
          {tarefas.length === 0
            ? ehGestao
              ? 'Ainda não há tarefas — acrescenta a primeira acima.'
              : 'Ainda não há tarefas diárias configuradas.'
            : diaEhPassado
              ? 'Nenhuma tarefa concluída neste dia.'
              : 'Nada para fazer neste dia.'}
        </div>
      )}

      {diaEhHoje && futuras.length > 0 && (
        <>
          <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Próximas tarefas
          </h2>
          <div className="mt-2 flex flex-col gap-1.5">
            {futuras.map((t) => (
              <Link
                key={t.id}
                href={`/painel/${slug}/tarefas?dia=${t.proxima_data}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-black/10 px-3 py-2 text-sm text-zinc-500 transition-colors hover:border-black/30 dark:border-white/10"
              >
                <span>{t.titulo}</span>
                <span className="shrink-0 text-xs">
                  {t.recorrencia} · {fmt(t.proxima_data)}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
