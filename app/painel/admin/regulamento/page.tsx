import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { guardarRegulamento } from './actions'
import SubmitButton from '@/components/SubmitButton'
import type { ConfigLinha } from '@/lib/supabase/database.types'

export default async function RegulamentoAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()

  const { data } = await supabase
    .from('config')
    .select('*')
    .eq('chave', 'regulamento')
    .maybeSingle()
  const config = data as ConfigLinha | null

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/painel/admin" className="text-sm text-zinc-600 underline dark:text-zinc-400">
        ← Administração
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Regulamento interno
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Este texto aparece tal e qual na app dos clientes (cada quebra de linha vira um parágrafo).
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <form action={guardarRegulamento} className="mt-6 flex flex-col gap-3">
        <input type="hidden" name="chave" value="regulamento" />
        <textarea
          name="valor"
          defaultValue={config?.valor ?? ''}
          rows={16}
          className="rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900 dark:focus:border-white/30"
        />
        <SubmitButton
          pendingText="A guardar…"
          className="self-start rounded-full bg-brand px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-brand-strong"
        >
          Guardar regulamento
        </SubmitButton>
      </form>
    </div>
  )
}
