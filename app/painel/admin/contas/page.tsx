import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getEstudios } from '@/lib/data/estudios'
import { EMAIL_POR_ESTUDIO } from '@/lib/data/acessos'
import { resolverIdPorEmail } from './dados'
import { definirPasswordEstudio, corrigirAcessoEstudio } from './actions'
import SubmitButton from '@/components/SubmitButton'
import PasswordInput from '@/components/PasswordInput'
import type { SupabaseClient } from '@supabase/supabase-js'

type LigacaoEstudio = { estudio_id: number; estudio: { nome: string } | null }

async function acessoAtual(supabase: SupabaseClient, email: string) {
  const idUtilizador = await resolverIdPorEmail(email)
  if (!idUtilizador) {
    return { encontrada: false as const, ligados: [] as { id: number; nome: string }[] }
  }
  const { data, error } = await supabase
    .from('perfis_estudios')
    .select('estudio_id, estudio:estudios!estudio_id(nome)')
    .eq('perfil_id', idUtilizador)
  if (error) {
    throw new Error(error.message)
  }
  const ligados = ((data ?? []) as unknown as LigacaoEstudio[]).map((l) => ({
    id: l.estudio_id,
    nome: l.estudio?.nome ?? '?',
  }))
  return { encontrada: true as const, ligados }
}

export default async function ContasEstudiosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sucesso?: string; sucessoAcesso?: string }>
}) {
  const { error, sucesso, sucessoAcesso } = await searchParams
  const supabase = await createClient()
  const estudios = await getEstudios(supabase)

  const comAcesso = await Promise.all(
    estudios.map(async (estudio) => {
      const email = EMAIL_POR_ESTUDIO[estudio.slug]
      if (!email) return null
      const acesso = await acessoAtual(supabase, email)
      return { estudio, email, acesso }
    })
  )

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/painel/admin" className="text-sm text-zinc-600 underline dark:text-zinc-400">
        ← Voltar
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Contas de login dos estúdios
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Cada estúdio tem uma conta de email própria, partilhada pela equipa — separada das fichas
        dos instrutores. Aqui vês a que estúdio cada conta está ligada, e podes corrigir ou definir
        uma nova palavra-passe.
      </p>

      {sucesso && (
        <p className="mt-4 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-700 dark:bg-teal-950 dark:text-teal-300">
          Palavra-passe atualizada.
        </p>
      )}
      {sucessoAcesso && (
        <p className="mt-4 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-700 dark:bg-teal-950 dark:text-teal-300">
          Acesso corrigido.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-6">
        {comAcesso.map((item) => {
          if (!item) return null
          const { estudio, email, acesso } = item
          const correto =
            acesso.encontrada && acesso.ligados.length === 1 && acesso.ligados[0].id === estudio.id

          return (
            <div
              key={estudio.id}
              className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950"
            >
              <h2 className="font-semibold text-black dark:text-zinc-50">{estudio.nome}</h2>
              <p className="mt-0.5 font-mono text-xs text-zinc-500">{email}</p>

              <div className="mt-2">
                {!acesso.encontrada ? (
                  <p className="text-xs text-red-700 dark:text-red-400">
                    Não encontrei nenhuma conta com este email.
                  </p>
                ) : correto ? (
                  <p className="text-xs text-teal-700 dark:text-teal-400">
                    ✓ Ligada só a {estudio.nome}.
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      {acesso.ligados.length === 0
                        ? 'Não está ligada a nenhum estúdio.'
                        : `Ligada a: ${acesso.ligados.map((l) => l.nome).join(', ')} (devia ser só ${estudio.nome}).`}
                    </p>
                    <form action={corrigirAcessoEstudio}>
                      <input type="hidden" name="email" value={email} />
                      <input type="hidden" name="estudio_id" value={estudio.id} />
                      <SubmitButton
                        pendingText="A corrigir…"
                        className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      >
                        Corrigir — ligar só a {estudio.nome}
                      </SubmitButton>
                    </form>
                  </div>
                )}
              </div>

              <form action={definirPasswordEstudio} className="mt-4 flex flex-col gap-3">
                <input type="hidden" name="email" value={email} />
                <PasswordInput
                  id={`password-${estudio.slug}`}
                  name="password"
                  label="Nova palavra-passe"
                  autoComplete="new-password"
                  minLength={6}
                />
                <PasswordInput
                  id={`confirmPassword-${estudio.slug}`}
                  name="confirmPassword"
                  label="Confirmar palavra-passe"
                  autoComplete="new-password"
                  minLength={6}
                />
                <SubmitButton
                  pendingText="A guardar…"
                  className="self-start rounded-full bg-brand px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-brand-strong"
                >
                  Guardar palavra-passe
                </SubmitButton>
              </form>
            </div>
          )
        })}
      </div>
    </div>
  )
}
