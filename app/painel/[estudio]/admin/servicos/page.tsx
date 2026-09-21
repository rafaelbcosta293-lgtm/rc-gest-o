import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { criarPlano, atualizarPlano, apagarPlano } from './actions'
import SubmitButton from '@/components/SubmitButton'
import type { Plano } from '@/lib/supabase/database.types'

const inputCls =
  'rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900 dark:focus:border-white/30'

export default async function ServicosPage({
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

  const { data: planosData, error: erroPlanos } = await supabase
    .from('planos')
    .select('*')
    .order('valor')

  if (erroPlanos) {
    throw new Error(erroPlanos.message)
  }

  const planos = (planosData ?? []) as Plano[]

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/painel/${slug}/admin`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← Administração
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Serviços / Produtos
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {estudio.nome} · valores dos planos e serviços vendidos.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {planos.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950"
          >
            <form action={atualizarPlano} className="flex flex-1 flex-wrap items-center gap-2">
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
            <form action={apagarPlano}>
              <input type="hidden" name="estudio_slug" value={slug} />
              <input type="hidden" name="id" value={p.id} />
              <SubmitButton
                pendingText="…"
                aria-label="Eliminar serviço"
                className="shrink-0 text-lg text-zinc-400 hover:text-red-600"
              >
                ×
              </SubmitButton>
            </form>
          </div>
        ))}
        {planos.length === 0 && (
          <div className="rounded-xl border border-dashed border-black/10 p-6 text-center text-sm text-zinc-500 dark:border-white/10">
            Ainda não há serviços registados.
          </div>
        )}
      </div>

      <form
        action={criarPlano}
        className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-black/20 p-3 dark:border-white/20"
      >
        <input type="hidden" name="estudio_slug" value={slug} />
        <input name="nome" required placeholder="Nome do serviço" className={`${inputCls} flex-1 basis-40`} />
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
          + Serviço
        </SubmitButton>
      </form>
      <p className="mt-2 text-xs text-zinc-500">
        Eliminar um serviço já usado em pagamentos antigos pode não ser possível — nesse caso,
        desmarca &quot;ativo&quot; em vez de eliminar.
      </p>
    </div>
  )
}
