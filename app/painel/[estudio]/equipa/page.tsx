import Link from '@/components/LinkRapido'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { idsContasPartilhadas } from '@/lib/data/contasPartilhadas'
import { alternarAcesso, eliminarDaEquipa, mudarPapel } from './actions'
import ConfirmarAcao from '@/components/ConfirmarAcao'
import SubmitButton from '@/components/SubmitButton'
import type { Papel } from '@/lib/supabase/database.types'

const PAPEIS: Papel[] = ['admin', 'studio_manager', 'master_trainer', 'comercial', 'pt']

export default async function EquipaPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ error?: string; ok?: string }>
}) {
  const { estudio: slug } = await params
  const { error, ok } = await searchParams
  const supabase = await createClient()

  const [estudio, { data: perfis }, sessao, partilhadas] = await Promise.all([
    getEstudioPorSlug(supabase, slug),
    supabase.from('perfis').select('id, nome, papel, ativo').is('eliminado_em', null).order('nome'),
    getSessaoAtual(),
    idsContasPartilhadas(),
  ])
  // Só a administração elimina — e nunca as contas do negócio nem a própria.
  const { ehAdmin } = papeisDaSessao(sessao)
  const podeEliminar = (id: string) => ehAdmin && id !== sessao.userId && !partilhadas.has(id)
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
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
        Equipa — {estudio.nome}
      </h1>
      <p className="mt-1 text-sm text-muted">
        Só quem tem acesso a este estúdio consegue ver e trabalhar com os clientes dele. Quem
        cria conta em <span className="font-medium">/registo</span> só aparece com acesso depois
        de aprovado aqui.
      </p>

      <Link
        href={`/painel/${slug}/equipa/operacional`}
        className="mt-3 inline-block rounded-full border border-border-strong px-4 py-2 text-sm font-bold hover:bg-foreground/[.08]"
      >
        Painel operacional
      </Link>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {ok === 'eliminado' && (
        <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Instrutor eliminado. O histórico dele (escalas, horas, férias e ausências) ficou guardado.</p>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {(perfis ?? []).map((p) => {
          const temAcesso = idsComAcesso.has(p.id)
          const porAprovar = !idsComAlgumAcesso.has(p.id)
          return (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface p-3"
            >
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {p.nome}
                  {porAprovar && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      Por aprovar
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted">{!p.ativo && 'inativo'}</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <form action={mudarPapel} className="flex items-center gap-1">
                  <input type="hidden" name="estudio_slug" value={slug} />
                  <input type="hidden" name="perfil_id" value={p.id} />
                  <select
                    name="papel"
                    defaultValue={p.papel}
                    className="rounded-lg border border-border-subtle bg-surface px-2 py-1.5 text-xs outline-none focus:border-brand"
                  >
                    {PAPEIS.map((papel) => (
                      <option key={papel} value={papel}>
                        {papel}
                      </option>
                    ))}
                  </select>
                  <SubmitButton
                    pendingText="…"
                    className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand/[.08]"
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
                        ? 'border border-border-subtle text-zinc-700 hover:bg-black/[.04] dark:text-zinc-300'
                        : 'bg-brand text-black'
                    }`}
                  >
                    {temAcesso ? 'Remover acesso' : 'Dar acesso'}
                  </SubmitButton>
                </form>
                {podeEliminar(p.id) && (
                  <ConfirmarAcao
                    action={eliminarDaEquipa}
                    confirmacao={`Eliminar ${p.nome} de vez? Não dá para desfazer.\n\nSai da equipa e a conta de acesso é apagada (deixa de poder entrar e o email fica livre). As escalas passadas, o registo de horas, as férias e as ausências ficam guardados no histórico.\n\nSe só queres que deixe de entrar neste estúdio, usa "Remover acesso".`}
                  >
                    <input type="hidden" name="estudio_slug" value={slug} />
                    <input type="hidden" name="perfil_id" value={p.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      Eliminar de vez
                    </button>
                  </ConfirmarAcao>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {(perfis ?? []).length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-border-subtle p-6 text-center text-sm text-muted">
          Ainda não há ninguém registado.
        </div>
      )}
    </div>
  )
}
