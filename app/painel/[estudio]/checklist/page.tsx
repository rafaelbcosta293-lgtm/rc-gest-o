import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { fmt } from '@/lib/data/presencas'
import { iniciarChecklist, criarItemModelo, atualizarItemModelo, removerItemModelo } from './actions'
import SubmitButton from '@/components/SubmitButton'
import type { ChecklistModelo, TipoOperacao } from '@/lib/supabase/database.types'

const TIPOS: TipoOperacao[] = ['Abertura', 'Fecho']

type RegistoResumo = {
  id: string
  tipo: TipoOperacao
  data: string
  hora: string
  concluidos: number
  total: number
}

export default async function ChecklistPage({
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

  const [
    { data: deHoje, error: erroHoje },
    { data: recentes, error: erroRecentes },
    { data: modeloData, error: erroModelo },
  ] = await Promise.all([
    supabase
      .from('checklist_registos')
      .select('id, tipo, data, hora, concluidos, total')
      .eq('estudio_id', estudio.id)
      .eq('data', hoje),
    supabase
      .from('checklist_registos')
      .select('id, tipo, data, hora, concluidos, total')
      .eq('estudio_id', estudio.id)
      .lt('data', hoje)
      .order('data', { ascending: false })
      .order('hora', { ascending: false })
      .limit(6),
    supabase.from('checklist_modelo').select('*').eq('ativo', true).order('ordem'),
  ])

  if (erroHoje || erroRecentes || erroModelo) {
    throw new Error((erroHoje ?? erroRecentes ?? erroModelo)!.message)
  }

  const registosHoje = (deHoje ?? []) as RegistoResumo[]
  const modelo = (modeloData ?? []) as ChecklistModelo[]
  const historico = (recentes ?? []) as RegistoResumo[]

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← Voltar
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Abertura / Fecho
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {estudio.nome} · checklist diária do estúdio.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TIPOS.map((tipo) => {
          const registo = registosHoje.find((r) => r.tipo === tipo)
          return (
            <div
              key={tipo}
              className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-950"
            >
              <h2 className="font-semibold text-black dark:text-zinc-50">{tipo}</h2>
              {registo ? (
                <>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {registo.concluidos} de {registo.total} feitos · {registo.hora.slice(0, 5)}
                  </p>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-teal-600"
                      style={{
                        width: `${registo.total ? Math.round((registo.concluidos / registo.total) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <Link
                    href={`/painel/${slug}/checklist/${registo.id}`}
                    className="mt-3 inline-block rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
                  >
                    {registo.concluidos >= registo.total ? 'Ver checklist' : 'Continuar'}
                  </Link>
                </>
              ) : (
                <form action={iniciarChecklist} className="mt-3">
                  <input type="hidden" name="estudio_slug" value={slug} />
                  <input type="hidden" name="estudio_id" value={estudio.id} />
                  <input type="hidden" name="tipo" value={tipo} />
                  <SubmitButton
                    pendingText="A iniciar…"
                    className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
                  >
                    Iniciar {tipo.toLowerCase()}
                  </SubmitButton>
                </form>
              )}
            </div>
          )
        })}
      </div>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Histórico recente
      </h2>
      {historico.length === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-black/10 p-6 text-center text-sm text-zinc-500 dark:border-white/10">
          Ainda não há checklists de dias anteriores.
        </div>
      )}
      <div className="mt-3 flex flex-col gap-2">
        {historico.map((r) => (
          <Link
            key={r.id}
            href={`/painel/${slug}/checklist/${r.id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-white p-3 text-sm dark:border-white/10 dark:bg-zinc-950"
          >
            <span>
              {fmt(r.data)} · {r.tipo}
            </span>
            <span className="text-xs text-zinc-500">
              {r.concluidos} de {r.total} feitos
            </span>
          </Link>
        ))}
      </div>

      {ehGestao && (
        <details className="mt-10 rounded-xl border border-black/10 dark:border-white/10">
          <summary className="flex cursor-pointer items-center gap-1.5 p-4 text-xs font-semibold uppercase tracking-wider text-[#5B3FA0]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#5B3FA0]" />
            Editar checklist
          </summary>
          <div className="flex flex-col gap-6 border-t border-black/10 p-4 dark:border-white/10">
            <p className="text-xs text-zinc-500">
              Alterar aqui não muda checklists já iniciadas — só as próximas.
            </p>
            {TIPOS.map((tipo) => {
              const itens = modelo.filter((m) => m.tipo === tipo)
              return (
                <div key={tipo}>
                  <h3 className="text-sm font-semibold text-black dark:text-zinc-50">{tipo}</h3>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {itens.map((m) => (
                      <form
                        key={m.id}
                        action={atualizarItemModelo}
                        className="flex flex-wrap items-center gap-1.5"
                      >
                        <input type="hidden" name="estudio_slug" value={slug} />
                        <input type="hidden" name="id" value={m.id} />
                        <input
                          name="secao"
                          defaultValue={m.secao}
                          placeholder="Secção"
                          className="w-28 rounded-md border border-black/10 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-zinc-900"
                        />
                        <input
                          name="item"
                          defaultValue={m.item}
                          className="min-w-[160px] flex-1 rounded-md border border-black/10 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-zinc-900"
                        />
                        <SubmitButton
                          pendingText="…"
                          className="rounded-md border border-black/10 px-2 py-1 text-xs dark:border-white/10"
                        >
                          Guardar
                        </SubmitButton>
                        <SubmitButton
                          formAction={removerItemModelo}
                          pendingText="…"
                          aria-label="Remover item"
                          className="text-lg text-zinc-400 hover:text-red-600"
                        >
                          ×
                        </SubmitButton>
                      </form>
                    ))}
                    {itens.length === 0 && (
                      <p className="text-xs text-zinc-500">Sem itens ainda.</p>
                    )}
                  </div>
                  <form
                    action={criarItemModelo}
                    className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md border border-dashed border-black/20 p-2 dark:border-white/20"
                  >
                    <input type="hidden" name="estudio_slug" value={slug} />
                    <input type="hidden" name="tipo" value={tipo} />
                    <input
                      name="secao"
                      placeholder="Secção"
                      defaultValue="Geral"
                      className="w-28 rounded-md border border-black/10 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-zinc-900"
                    />
                    <input
                      name="item"
                      required
                      placeholder="Novo item…"
                      className="min-w-[160px] flex-1 rounded-md border border-black/10 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-zinc-900"
                    />
                    <SubmitButton
                      pendingText="…"
                      className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background"
                    >
                      + Item
                    </SubmitButton>
                  </form>
                </div>
              )
            })}
          </div>
        </details>
      )}
    </div>
  )
}
