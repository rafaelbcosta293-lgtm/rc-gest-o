import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEquipaDoEstudio } from '@/lib/data/estudios'
import { ehContaFixa } from '@/lib/data/acessos'
import { TEXTO_CHECKLIST, itensEmFalta } from '@/lib/data/checklistPadrao'
import ConfirmarAcao from '@/components/ConfirmarAcao'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { fmt } from '@/lib/data/presencas'
import { iniciarChecklist, criarItemModelo, atualizarItemModelo, removerItemModelo, aplicarChecklistPadrao } from './actions'
import SubmitButton from '@/components/SubmitButton'
import ItemModeloForm from './ItemModeloForm'
import type { ChecklistModelo, TipoOperacao } from '@/lib/supabase/database.types'

const TIPOS: TipoOperacao[] = ['Abertura', 'Fecho']

type RegistoResumo = {
  id: string
  tipo: TipoOperacao
  data: string
  hora: string
  concluidos: number
  total: number
  pt: { nome: string } | null
}

export default async function ChecklistPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ error?: string; ok?: string; registado?: string }>
}) {
  const { estudio: slug } = await params
  const { error, ok, registado } = await searchParams
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
    { data: fechoCaixaHoje, error: erroFechoCaixaHoje },
  ] = await Promise.all([
    supabase
      .from('checklist_registos')
      .select('id, tipo, data, hora, concluidos, total, pt:perfis!pt_id(nome)')
      .eq('estudio_id', estudio.id)
      .eq('data', hoje),
    supabase
      .from('checklist_registos')
      .select('id, tipo, data, hora, concluidos, total, pt:perfis!pt_id(nome)')
      .eq('estudio_id', estudio.id)
      .lt('data', hoje)
      .order('data', { ascending: false })
      .order('hora', { ascending: false })
      .limit(6),
    supabase.from('checklist_modelo').select('*').eq('ativo', true).order('ordem'),
    supabase.from('fechos_caixa').select('id').eq('estudio_id', estudio.id).eq('data', hoje).maybeSingle(),
  ])
  const equipa = await getEquipaDoEstudio(supabase, estudio.id)
  // Numa conta pessoal o responsável já vem escolhido (é a própria pessoa).
  const responsavelOmissao = !ehContaFixa(sessao.email) && equipa.some((p) => p.id === sessao.userId) ? sessao.userId! : ''

  if (erroHoje || erroRecentes || erroModelo || erroFechoCaixaHoje) {
    throw new Error((erroHoje ?? erroRecentes ?? erroModelo ?? erroFechoCaixaHoje)!.message)
  }

  const registosHoje = (deHoje ?? []) as unknown as RegistoResumo[]
  const modelo = (modeloData ?? []) as ChecklistModelo[]
  const historico = (recentes ?? []) as unknown as RegistoResumo[]
  const emFalta = TIPOS.reduce((s, t) => s + itensEmFalta(t, modelo.filter((m) => m.tipo === t)).length, 0)
  const fechoCaixaFeitoHoje = fechoCaixaHoje != null

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-foreground">
        Abertura / Fecho
      </h1>
      <p className="mt-1 text-sm text-muted">
        {estudio.nome} · checklist diária do estúdio. {TEXTO_CHECKLIST.Abertura.nota.split('.')[0]}.
      </p>

      {registado && (
        <p className="mt-4 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-700 dark:bg-teal-950 dark:text-teal-300">
          {registado} registad{registado === 'Abertura' ? 'a' : 'o'}. Obrigado!
        </p>
      )}
      {ok !== undefined && (
        <p className="mt-4 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-700 dark:bg-teal-950 dark:text-teal-300">
          {ok === '0' ? 'A checklist já tinha todos os itens do formulário.' : `Checklist atualizada: ${ok} itens acrescentados.`}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {TIPOS.map((tipo) => {
          const registo = registosHoje.find((r) => r.tipo === tipo)
          return (
            <div
              key={tipo}
              className="rounded-xl border border-border-subtle bg-surface p-5"
            >
              <h2 className="font-semibold text-foreground">{tipo}</h2>
              {registo ? (
                <>
                  <p className="mt-1 text-sm text-muted">
                    {registo.concluidos} de {registo.total} feitos · {registo.hora.slice(0, 5)}
                    {registo.pt?.nome ? ` · ${registo.pt.nome.trim()}` : ''}
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
                    className="mt-3 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
                  >
                    {registo.concluidos >= registo.total ? 'Ver checklist' : 'Continuar'}
                  </Link>
                </>
              ) : (
                <form action={iniciarChecklist} className="mt-3">
                  <input type="hidden" name="estudio_slug" value={slug} />
                  <input type="hidden" name="estudio_id" value={estudio.id} />
                  <input type="hidden" name="tipo" value={tipo} />
                  <label className="mb-3 block text-xs font-medium text-muted">
                    Responsável
                    <select
                      name="responsavel_id"
                      required
                      defaultValue={responsavelOmissao}
                      className="mt-1 block w-full rounded-md border border-border-subtle bg-background px-2 py-1.5 text-sm text-foreground"
                    >
                      <option value="" disabled>
                        Quem está a fazer?
                      </option>
                      {equipa.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome.trim()}
                        </option>
                      ))}
                    </select>
                  </label>
                  <SubmitButton
                    pendingText="A iniciar…"
                    className="rounded-full border border-border-strong px-4 py-2 text-sm font-bold hover:bg-foreground/[.08]"
                  >
                    Iniciar {tipo.toLowerCase()}
                  </SubmitButton>
                </form>
              )}
            </div>
          )
        })}

        <div className="rounded-xl border border-border-subtle bg-surface p-5">
          <h2 className="font-semibold text-foreground">Fecho de Caixa</h2>
          <p className="mt-1 text-sm text-muted">
            {fechoCaixaFeitoHoje ? 'Já registado hoje' : 'Ainda não registado hoje'}
          </p>
          <Link
            href={`/painel/${slug}/fecho-caixa`}
            className="mt-3 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
          >
            {fechoCaixaFeitoHoje ? 'Ver fecho' : 'Registar fecho'}
          </Link>
        </div>
      </div>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Histórico recente
      </h2>
      {historico.length === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-border-subtle p-6 text-center text-sm text-zinc-500">
          Ainda não há checklists de dias anteriores.
        </div>
      )}
      <div className="mt-3 flex flex-col gap-2">
        {historico.map((r) => (
          <Link
            key={r.id}
            href={`/painel/${slug}/checklist/${r.id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface p-3 text-sm"
          >
            <span>
              {fmt(r.data)} · {r.tipo}
              {r.pt?.nome ? <span className="text-zinc-500"> · {r.pt.nome.trim()}</span> : null}
            </span>
            <span className="text-xs text-zinc-500">
              {r.concluidos} de {r.total} feitos
            </span>
          </Link>
        ))}
      </div>

      {ehGestao && (
        <details className="mt-10 rounded-xl border border-border-subtle">
          <summary className="flex cursor-pointer items-center gap-1.5 p-4 text-xs font-semibold uppercase tracking-wider text-[#5B3FA0]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#5B3FA0]" />
            Editar checklist
          </summary>
          <div className="flex flex-col gap-6 border-t border-border-subtle p-4">
            <p className="text-xs text-zinc-500">
              Alterar aqui não muda checklists já iniciadas — só as próximas.
            </p>
            <div className="rounded-lg border border-border-subtle p-3">
              <p className="text-sm font-semibold text-foreground">Checklist oficial (formulário de Abertura/Fecho)</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {emFalta > 0
                  ? `Faltam ${emFalta} itens do formulário nesta checklist.`
                  : 'Esta checklist já tem todos os itens do formulário.'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {emFalta > 0 && (
                  <form action={aplicarChecklistPadrao}>
                    <input type="hidden" name="estudio_slug" value={slug} />
                    <input type="hidden" name="modo" value="acrescentar" />
                    <SubmitButton pendingText="A acrescentar…" className="rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-black hover:bg-brand-strong">
                      Acrescentar os {emFalta} itens em falta
                    </SubmitButton>
                  </form>
                )}
                <ConfirmarAcao
                  action={aplicarChecklistPadrao}
                  confirmacao="Substituir a checklist atual pela do formulário? Os itens atuais que não estão no formulário deixam de aparecer nas próximas checklists."
                >
                  <input type="hidden" name="estudio_slug" value={slug} />
                  <input type="hidden" name="modo" value="substituir" />
                  <button type="submit" className="rounded-full border border-border-strong px-4 py-1.5 text-xs font-semibold hover:bg-foreground/[.08]">
                    Usar só a checklist do formulário
                  </button>
                </ConfirmarAcao>
              </div>
            </div>
            {TIPOS.map((tipo) => {
              const itens = modelo.filter((m) => m.tipo === tipo)
              return (
                <div key={tipo}>
                  <h3 className="text-sm font-semibold text-foreground">{tipo}</h3>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {itens.map((m) => (
                      <ItemModeloForm
                        key={m.id}
                        estudioSlug={slug}
                        item={m}
                        atualizar={atualizarItemModelo}
                        remover={removerItemModelo}
                      />
                    ))}
                    {itens.length === 0 && (
                      <p className="text-xs text-zinc-500">Sem itens ainda.</p>
                    )}
                  </div>
                  <form
                    action={criarItemModelo}
                    className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md border border-dashed border-border-strong p-2"
                  >
                    <input type="hidden" name="estudio_slug" value={slug} />
                    <input type="hidden" name="tipo" value={tipo} />
                    <input
                      name="secao"
                      placeholder="Secção"
                      defaultValue="Geral"
                      className="w-28 rounded-md border border-border-subtle px-2 py-1.5 text-xs dark:bg-zinc-900"
                    />
                    <input
                      name="item"
                      required
                      placeholder="Novo item…"
                      className="min-w-[160px] flex-1 rounded-md border border-border-subtle px-2 py-1.5 text-xs dark:bg-zinc-900"
                    />
                    <SubmitButton
                      pendingText="…"
                      className="rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-black hover:bg-brand-strong"
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
