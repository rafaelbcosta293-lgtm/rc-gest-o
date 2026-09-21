import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { alternarAcesso, mudarPapel } from './actions'
import SubmitButton from '@/components/SubmitButton'
import type { Papel } from '@/lib/supabase/database.types'

const PAPEIS: Papel[] = ['admin', 'studio_manager', 'master_trainer', 'pt']

export default async function EquipaPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { estudio: slug } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const [estudio, { data: perfis }] = await Promise.all([
    getEstudioPorSlug(supabase, slug),
    supabase.from('perfis').select('id, nome, papel, ativo').order('nome'),
  ])
  if (!estudio) {
    notFound()
  }

  const [{ data: acessos }, { data: todosAcessos }] = await Promise.all([
    supabase.from('perfis_estudios').select('perfil_id').eq('estudio_id', estudio.id),
    supabase.from('perfis_estudios').select('perfil_id'),
  ])

  const idsComAcesso = new Set((acessos ?? []).map((a) => a.perfil_id))
  const idsComAlgumAcesso = new Set((todosAcessos ?? []).map((a) => a.perfil_id))

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← Voltar
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Equipa — {estudio.nome}
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Só quem tem acesso a este estúdio consegue ver e trabalhar com os clientes dele. Quem
        cria conta em <span className="font-medium">/registo</span> só aparece com acesso depois
        de aprovado aqui.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {(perfis ?? []).map((p) => {
          const temAcesso = idsComAcesso.has(p.id)
          const porAprovar = !idsComAlgumAcesso.has(p.id)
          return (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950"
            >
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-black dark:text-zinc-50">
                  {p.nome}
                  {porAprovar && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      Por aprovar
                    </span>
                  )}
                </p>
                <p className="text-xs text-zinc-500">{!p.ativo && 'inativo'}</p>
              </div>
              <div className="flex items-center gap-2">
                <form action={mudarPapel} className="flex items-center gap-1">
                  <input type="hidden" name="estudio_slug" value={slug} />
                  <input type="hidden" name="perfil_id" value={p.id} />
                  <select
                    name="papel"
                    defaultValue={p.papel}
                    className="rounded-md border border-black/10 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-zinc-900"
                  >
                    {PAPEIS.map((papel) => (
                      <option key={papel} value={papel}>
                        {papel}
                      </option>
                    ))}
                  </select>
                  <SubmitButton
                    pendingText="…"
                    className="rounded-md border border-black/10 px-2 py-1.5 text-xs dark:border-white/10"
                  >
                    Guardar
                  </SubmitButton>
                </form>
                <form action={alternarAcesso}>
                  <input type="hidden" name="estudio_slug" value={slug} />
                  <input type="hidden" name="estudio_id" value={estudio.id} />
                  <input type="hidden" name="perfil_id" value={p.id} />
                  <input type="hidden" name="tem_acesso" value={temAcesso ? '1' : '0'} />
                  <SubmitButton
                    pendingText="A atualizar…"
                    className={`rounded-full px-4 py-1.5 text-xs font-medium ${
                      temAcesso
                        ? 'border border-black/10 text-zinc-700 hover:bg-black/[.04] dark:border-white/10 dark:text-zinc-300'
                        : 'bg-foreground text-background'
                    }`}
                  >
                    {temAcesso ? 'Remover acesso' : 'Dar acesso'}
                  </SubmitButton>
                </form>
              </div>
            </div>
          )
        })}
      </div>

      {(perfis ?? []).length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-black/10 p-6 text-center text-sm text-zinc-500 dark:border-white/10">
          Ainda não há ninguém registado.
        </div>
      )}
    </div>
  )
}
