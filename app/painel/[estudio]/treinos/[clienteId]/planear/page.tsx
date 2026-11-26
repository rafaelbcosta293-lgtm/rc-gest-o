import Link from '@/components/LinkRapido'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEquipaDoEstudio, getEstudioPorSlug } from '@/lib/data/estudios'
import { getSessaoAtual } from '@/lib/data/sessao'
import { hojeEmLisboa } from '@/lib/data/hoje'
import { rotuloTreinoMarcado, treinosMarcadosDoCliente } from '@/lib/data/controloInstrutoresDados'
import SubmitButton from '@/components/SubmitButton'
import { iniciarTreino } from '../treino/actions'

const inputCls =
  'w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-brand pointer-coarse:py-2.5 pointer-coarse:text-base'

// "Planear treino": antes de abrir o plano em branco, escolhe-se a que
// treino marcado na Agenda ele pertence e quem o faz. É por aqui que se
// consegue depois saber, por instrutor, que treinos tinham plano.
export default async function PlanearTreinoPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string; clienteId: string }>
  searchParams: Promise<{ evento?: string; error?: string }>
}) {
  const { estudio: slug, clienteId } = await params
  const { evento: eventoPedido, error } = await searchParams
  const hoje = hojeEmLisboa()

  const supabase = await createClient()
  const [estudio, { data: cliente }, sessao, treinos] = await Promise.all([
    getEstudioPorSlug(supabase, slug),
    supabase.from('clientes').select('id, nome, estudio_id').eq('id', clienteId).maybeSingle(),
    getSessaoAtual(),
    treinosMarcadosDoCliente(supabase, clienteId, hoje),
  ])
  if (!estudio || !cliente || cliente.estudio_id !== estudio.id) notFound()

  // Veio de um treino da Agenda que já tem plano: abre-se logo esse.
  if (eventoPedido) {
    const { data: jaExiste } = await supabase.from('sessoes').select('id').eq('agenda_evento_id', eventoPedido).maybeSingle()
    if (jaExiste) redirect(`/painel/${slug}/treinos/${clienteId}/treino/${jaExiste.id}`)
  }

  const pts = await getEquipaDoEstudio(supabase, estudio.id)
  const semPlano = treinos.filter((t) => !t.planoId)
  // Por omissão: o treino de onde se veio; senão, o próximo por planear.
  const escolhido =
    semPlano.find((t) => t.id === eventoPedido)?.id ?? semPlano.find((t) => t.data >= hoje)?.id ?? semPlano[semPlano.length - 1]?.id ?? ''
  // Quem está a planear: a própria pessoa, quando entrou com a conta dela.
  const autor = pts.some((p) => p.id === sessao.userId) ? (sessao.userId ?? '') : ''

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Link
        href={`/painel/${slug}/treinos/${clienteId}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {cliente.nome}
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Planear treino</h1>
      <p className="mt-1 text-sm text-muted">{cliente.nome}</p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{decodeURIComponent(error)}</p>
      )}

      <form action={iniciarTreino} className="mt-6 flex flex-col gap-6">
        <input type="hidden" name="estudio_slug" value={slug} />
        <input type="hidden" name="estudio_id" value={estudio.id} />
        <input type="hidden" name="cliente_id" value={clienteId} />

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold text-foreground">Para que treino é este plano?</legend>
          {semPlano.length === 0 && (
            <p className="rounded-lg border border-dashed border-border-subtle p-3 text-sm text-muted">
              {treinos.length === 0
                ? 'Este cliente não tem treinos marcados na Agenda nas próximas semanas.'
                : 'Todos os treinos marcados deste cliente já têm plano.'}
            </p>
          )}
          {semPlano.map((t) => (
            <label
              key={t.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-sm has-checked:border-brand has-checked:bg-brand/[.08]"
            >
              <input type="radio" name="agenda_evento_id" value={t.id} defaultChecked={t.id === escolhido} required className="h-4 w-4" />
              <span className="flex-1 font-medium text-foreground">{rotuloTreinoMarcado(t)}</span>
              <span className="text-xs text-muted">{t.data < hoje ? 'já aconteceu' : t.data === hoje ? 'hoje' : ''}</span>
            </label>
          ))}
          <label className="flex cursor-pointer flex-wrap items-center gap-3 rounded-lg border border-dashed border-border-subtle px-3 py-2.5 text-sm has-checked:border-amber-500 has-checked:bg-amber-50 dark:has-checked:bg-amber-950">
            <input type="radio" name="agenda_evento_id" value="" defaultChecked={escolhido === ''} required className="h-4 w-4" />
            <span className="flex-1 text-muted">
              Sem treino marcado na Agenda
              <span className="block text-xs">Fica assinalado no relatório como plano sem treino associado.</span>
            </span>
            <input type="date" name="data" defaultValue={hoje} aria-label="Data do plano sem treino marcado" className={`${inputCls} w-auto`} />
          </label>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pt_id" className="text-sm font-semibold text-foreground">
            Quem faz este plano?
          </label>
          <select id="pt_id" name="pt_id" defaultValue={autor} required className={inputCls}>
            <option value="">— Escolher instrutor —</option>
            {pts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>

        <SubmitButton
          pendingText="A abrir…"
          className="self-start rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
        >
          Começar o plano
        </SubmitButton>
      </form>
    </div>
  )
}
