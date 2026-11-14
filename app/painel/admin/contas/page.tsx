import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEstudios, filtrarPorEstudio } from '@/lib/data/estudios'
import { EMAIL_GERAL, EMAIL_POR_ESTUDIO } from '@/lib/data/acessos'
import { resolverIdPorEmail } from './dados'
import { definirPasswordEstudio, corrigirAcessoEstudio } from './actions'
import SubmitButton from '@/components/SubmitButton'
import PasswordInput from '@/components/PasswordInput'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import GestaoEquipa from './GestaoEquipa'
import type { SupabaseClient } from '@supabase/supabase-js'

const MENSAGENS_OK: Record<string, string> = {
  'perfil-criado': 'Perfil de instrutor criado (sem acesso à app).',
  'conta-criada': 'Conta criada — o instrutor já pode entrar com o email e a palavra-passe indicados.',
  guardado: 'Alterações guardadas. As permissões novas aplicam-se no próximo login (ou dentro de uma hora).',
  'acesso-criado': 'Acesso criado — o instrutor já pode entrar na app.',
  'acesso-atualizado': 'Acesso atualizado.',
  'acesso-removido': 'Acesso retirado. O perfil mantém-se.',
  desativado: 'Instrutor desativado.',
  reativado: 'Instrutor reativado — escolhe os estúdios onde trabalha.',
  eliminado: 'Instrutor eliminado.',
  'desativado-com-historico': 'Este instrutor tem histórico na app, por isso não foi apagado: ficou desativado e sem acesso.',
}

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
  searchParams: Promise<{ error?: string; sucesso?: string; sucessoAcesso?: string; estudio?: string; ok?: string }>
}) {
  const { error, sucesso, sucessoAcesso, estudio: estudioParam, ok } = await searchParams
  const supabase = await createClient()
  const [todosEstudios, sessao] = await Promise.all([getEstudios(supabase), getSessaoAtual()])
  const estudios = filtrarPorEstudio(todosEstudios, estudioParam)
  const { ehAdmin } = papeisDaSessao(sessao)

  // A conta da Coordenação é a mesma para os estúdios todos, por isso
  // aparece sempre, com ou sem filtro de estúdio.
  const idsTodosEstudios = todosEstudios.map((e) => e.id)
  const coordenacao = await acessoAtual(supabase, EMAIL_GERAL)
  const coordenacaoCompleta =
    coordenacao.encontrada && idsTodosEstudios.every((id) => coordenacao.ligados.some((l) => l.id === id))

  const comAcesso = await Promise.all(
    estudios.map(async (estudio) => {
      const email = EMAIL_POR_ESTUDIO[estudio.slug]
      if (!email) return null
      const acesso = await acessoAtual(supabase, email)
      return { estudio, email, acesso }
    })
  )

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href="/painel/admin"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
        Contas
      </h1>
      <p className="mt-1 text-sm text-muted">
        Contas partilhadas do negócio (em cima) e instrutores e contas pessoais (em baixo).
      </p>
      <h2 className="mt-6 text-xl font-bold tracking-tight text-foreground">Contas partilhadas</h2>
      <p className="mt-1 text-sm text-muted">
        A Coordenação e cada estúdio têm uma conta de email própria, partilhada pela equipa. Quem define a palavra-passe
        és tu, aqui — escreve uma nova e dá-a a quem precisa de entrar.
      </p>

      {sucesso && (
        <p className="mt-4 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-700 dark:bg-teal-950 dark:text-teal-300">
          {sucesso === 'criada'
            ? 'Conta criada — já dá para entrar com esse email e a palavra-passe que escreveste.'
            : 'Palavra-passe atualizada — já dá para entrar com ela.'}
        </p>
      )}
      {sucessoAcesso && (
        <p className="mt-4 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-700 dark:bg-teal-950 dark:text-teal-300">
          Acesso corrigido.
        </p>
      )}
      {ok && MENSAGENS_OK[ok] && (
        <p className="mt-4 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-700 dark:bg-teal-950 dark:text-teal-300">
          {MENSAGENS_OK[ok]}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-6">
        <div className="rounded-xl border border-border-subtle bg-surface p-4">
          <h2 className="font-semibold text-foreground">Coordenação</h2>
          <p className="mt-0.5 font-mono text-xs text-zinc-500">{EMAIL_GERAL}</p>
          <div className="mt-2">
            {!coordenacao.encontrada ? (
              <p className="text-xs text-red-700 dark:text-red-400">
                Esta conta ainda não existe, por isso ninguém consegue entrar nem recuperar a palavra-passe com este email.
                Escreve uma palavra-passe aqui em baixo para a criar.
              </p>
            ) : coordenacaoCompleta ? (
              <p className="text-xs text-teal-700 dark:text-teal-400">
                ✓ Vê a área de Coordenação e os estúdios todos ({coordenacao.ligados.map((l) => l.nome).join(' + ')}).
              </p>
            ) : (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                A conta existe mas não está ligada a todos os estúdios — guarda a palavra-passe outra vez para corrigir.
              </p>
            )}
          </div>
          <form action={definirPasswordEstudio} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="email" value={EMAIL_GERAL} />
            <PasswordInput id="password-coordenacao" name="password" label="Nova palavra-passe" autoComplete="new-password" minLength={6} />
            <PasswordInput
              id="confirmPassword-coordenacao"
              name="confirmPassword"
              label="Confirmar palavra-passe"
              autoComplete="new-password"
              minLength={6}
            />
            <SubmitButton
              pendingText="A guardar…"
              className="self-start rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
            >
              {coordenacao.encontrada ? 'Guardar palavra-passe' : 'Criar conta da Coordenação'}
            </SubmitButton>
          </form>
        </div>

        {comAcesso.map((item) => {
          if (!item) return null
          const { estudio, email, acesso } = item
          const correto =
            acesso.encontrada && acesso.ligados.length === 1 && acesso.ligados[0].id === estudio.id

          return (
            <div
              key={estudio.id}
              className="rounded-xl border border-border-subtle bg-surface p-4"
            >
              <h2 className="font-semibold text-foreground">{estudio.nome}</h2>
              <p className="mt-0.5 font-mono text-xs text-zinc-500">{email}</p>

              <div className="mt-2">
                {!acesso.encontrada ? (
                  <p className="text-xs text-red-700 dark:text-red-400">
                    Esta conta ainda não existe. Escreve uma palavra-passe aqui em baixo para a criar.
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
                  className="self-start rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
                >
                  Guardar palavra-passe
                </SubmitButton>
              </form>
            </div>
          )
        })}
      </div>

      {ehAdmin && <GestaoEquipa estudios={todosEstudios.map((e) => ({ id: e.id, nome: e.nome }))} />}
    </div>
  )
}
