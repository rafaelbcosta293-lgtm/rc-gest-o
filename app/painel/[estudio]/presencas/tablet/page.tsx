import Link from '@/components/LinkRapido'
import { ArrowLeft, ExternalLink, Tablet } from 'lucide-react'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import CopiarTexto from '@/components/CopiarTexto'
import ConfirmarAcao from '@/components/ConfirmarAcao'
import { hojeEmLisboa } from '@/lib/data/hoje'
import { criarPostoCheckin, desativarPostoCheckin, guardarMeiosPagamento } from './actions'
import { CAMPOS_PAGAMENTO } from '@/lib/data/meiosPagamento'

type Posto = { id: string; nome: string; token: string; criado_em: string }

export default async function TabletCheckinPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ error?: string; guardado?: string }>
}) {
  const { estudio: slug } = await params
  const { error, guardado } = await searchParams
  const supabase = await createClient()
  const [estudio, sessao] = await Promise.all([getEstudioPorSlug(supabase, slug), getSessaoAtual()])
  if (!estudio) notFound()
  const { ehGestao } = papeisDaSessao(sessao)

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')
  const base = `${proto}://${host}`

  const hoje = hojeEmLisboa()
  const [{ data: postosData }, { data: checkinsHoje }, { data: pagamentoData }] = await Promise.all([
    ehGestao
      ? supabase.from('checkin_postos').select('id, nome, token, criado_em').eq('estudio_id', estudio.id).is('revogado_em', null).order('criado_em')
      : Promise.resolve({ data: [] as Posto[] }),
    supabase
      .from('presencas')
      .select('id, cliente:clientes!inner(estudio_id)')
      .eq('origem', 'checkin')
      .eq('data', hoje)
      .eq('cliente.estudio_id', estudio.id),
    ehGestao
      ? supabase
          .from('config')
          .select('chave, valor')
          .in('chave', CAMPOS_PAGAMENTO.map((c) => `pagamento_${c.campo}_${slug}`))
      : Promise.resolve({ data: [] }),
  ])
  const valorPagamento = (campo: string) =>
    ((pagamentoData ?? []) as { chave: string; valor: string | null }[]).find((c) => c.chave === `pagamento_${campo}_${slug}`)?.valor ?? ''

  const postos = (postosData ?? []) as Posto[]

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={`/painel/${slug}/presencas`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Presenças
      </Link>
      <h1 className="mt-3 flex items-center gap-2 text-3xl font-bold tracking-tight text-foreground">
        <Tablet className="h-7 w-7" /> Tablet de check-in
      </h1>
      <p className="mt-1 text-sm text-muted">
        {estudio.nome} · o cliente chega, escreve o seu nº de cliente e a presença no treino fica registada. Hoje:{' '}
        <strong className="text-foreground">{(checkinsHoje ?? []).length}</strong> check-in{(checkinsHoje ?? []).length === 1 ? '' : 's'}.
      </p>

      {guardado && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Meios de pagamento guardados.</p>
      )}
      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}

      {!ehGestao ? (
        <p className="mt-6 rounded-xl border border-border-subtle bg-surface p-4 text-sm text-muted">
          Só a gestão pode criar ou ver o link do tablet.
        </p>
      ) : (
        <>
          <section className="mt-6 space-y-3">
            {postos.length === 0 && (
              <p className="rounded-xl border border-dashed border-border-strong bg-surface p-4 text-sm text-muted">
                Ainda não há nenhum tablet configurado neste estúdio.
              </p>
            )}
            {postos.map((p) => {
              const url = `${base}/checkin/${p.token}`
              return (
                <div key={p.id} className="rounded-xl border border-border-subtle bg-surface p-4 shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">{p.nome}</p>
                    <ConfirmarAcao
                      action={desativarPostoCheckin}
                      confirmacao="Desativar este link? O tablet deixa de conseguir registar presenças até lhe pôr um link novo."
                    >
                      <input type="hidden" name="estudio_slug" value={slug} />
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="text-xs font-semibold text-red-600 hover:underline">
                        Desativar link
                      </button>
                    </ConfirmarAcao>
                  </div>
                  <p className="mt-2 break-all rounded-lg bg-background px-3 py-2 font-mono text-xs text-muted">{url}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    <CopiarTexto texto={url} rotulo="Copiar link" className="font-semibold text-brand hover:underline" />
                    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">
                      Abrir <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              )
            })}
            {postos.length === 0 && (
              <form action={criarPostoCheckin}>
                <input type="hidden" name="estudio_slug" value={slug} />
                <button type="submit" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                  Criar link do tablet
                </button>
              </form>
            )}
          </section>

          <section className="mt-8 rounded-xl border border-border-subtle bg-surface p-4 text-sm text-foreground shadow-card">
            <h2 className="font-semibold">Meios de pagamento mostrados no tablet</h2>
            <p className="mt-1 text-muted">
              Quando alguém faz check-in sem a mensalidade em dia, a presença não fica registada: o tablet diz, com simpatia, que a
              mensalidade expirou, mostra o valor e, no mesmo ecrã, estes meios de pagamento durante 30 segundos. O link de pagamento
              aparece como QR code, para pagar ali mesmo com o telemóvel. Deixe em branco o que não quiser mostrar.
            </p>
            <form action={guardarMeiosPagamento} className="mt-3 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="estudio_slug" value={slug} />
              {CAMPOS_PAGAMENTO.map((c) => (
                <label key={c.campo} className={`flex flex-col gap-1 ${c.campo === 'nota' || c.campo === 'link' ? 'sm:col-span-2' : ''}`}>
                  <span className="text-xs font-semibold text-muted">{c.rotulo}</span>
                  {c.campo === 'nota' ? (
                    <textarea name={c.campo} defaultValue={valorPagamento(c.campo)} rows={2} placeholder={c.exemplo} className="rounded-lg border border-border-strong bg-background px-3 py-2" />
                  ) : (
                    <input name={c.campo} defaultValue={valorPagamento(c.campo)} placeholder={c.exemplo} className="rounded-lg border border-border-strong bg-background px-3 py-2" />
                  )}
                </label>
              ))}
              <div className="sm:col-span-2">
                <button type="submit" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                  Guardar
                </button>
              </div>
            </form>
          </section>

          <section className="mt-8 rounded-xl border border-border-subtle bg-surface p-4 text-sm text-foreground shadow-card">
            <h2 className="font-semibold">Como pôr o tablet a funcionar</h2>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted">
              <li>
                No tablet, abra o link acima <strong className="text-foreground">num separador anónimo</strong> (Chrome: menu ⋮ → &quot;Novo
                separador anónimo&quot;) ou noutro browser onde a conta do estúdio <strong className="text-foreground">não</strong> tenha sessão
                iniciada. Assim os clientes nunca chegam à app da equipa.
              </li>
              <li>
                Prenda o ecrã nessa página:
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>
                    <strong className="text-foreground">Android</strong>: Definições → Segurança → &quot;Fixar app&quot; (ou &quot;Afixar
                    ecrã&quot;); depois, em Apps recentes, toque no ícone do browser → &quot;Fixar&quot;. Para sair, mantenha premidos Voltar
                    + Apps recentes (pede o PIN do tablet).
                  </li>
                  <li>
                    <strong className="text-foreground">iPad</strong>: Definições → Acessibilidade → &quot;Acesso guiado&quot; → ativar e
                    definir um código; na página, carregue 3 vezes no botão lateral/início → Iniciar.
                  </li>
                </ul>
              </li>
              <li>A página mostra só um teclado numérico — nunca nomes nem dados de clientes.</li>
              <li>
                Se a mensalidade não estiver em dia, a presença não fica registada; o tablet mostra uma mensagem simpática com o valor e os
                meios de pagamento acima, e aparece um aviso no topo da app do estúdio até o pagamento ser registado. Depois de registado o
                pagamento, o cliente volta a fazer o check-in e já fica registado.
              </li>
              <li>
                Aceita o número de quem tem um treino ou aula marcados <strong className="text-foreground">de 30 min antes do início até 30 min depois do fim</strong>
                . Escreve-se só a parte dos números (ex.: F26345 → 26345).
              </li>
              <li>Se o link for parar a quem não devia, carregue em &quot;Desativar link&quot; e crie um novo.</li>
            </ol>
          </section>
        </>
      )}
    </div>
  )
}
