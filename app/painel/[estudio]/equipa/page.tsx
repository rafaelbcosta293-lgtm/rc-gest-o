import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { alternarAcesso } from './actions'
import SubmitButton from '@/components/SubmitButton'

export default async function EquipaPage({
  params,
}: {
  params: Promise<{ estudio: string }>
}) {
  const { estudio: slug } = await params
  const supabase = await createClient()

  const [estudio, { data: perfis }] = await Promise.all([
    getEstudioPorSlug(supabase, slug),
    supabase.from('perfis').select('id, nome, papel, ativo').order('nome'),
  ])
  if (!estudio) {
    notFound()
  }

  const { data: acessos } = await supabase
    .from('perfis_estudios')
    .select('perfil_id')
    .eq('estudio_id', estudio.id)

  const idsComAcesso = new Set((acessos ?? []).map((a) => a.perfil_id))

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
        Só quem tem acesso a este estúdio consegue ver e trabalhar com os clientes dele.
      </p>

      <div className="mt-6 flex flex-col gap-2">
        {(perfis ?? []).map((p) => {
          const temAcesso = idsComAcesso.has(p.id)
          return (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950"
            >
              <div>
                <p className="text-sm font-medium text-black dark:text-zinc-50">
                  {p.nome}
                </p>
                <p className="text-xs text-zinc-500">
                  {p.papel}
                  {!p.ativo && ' · inativo'}
                </p>
              </div>
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
