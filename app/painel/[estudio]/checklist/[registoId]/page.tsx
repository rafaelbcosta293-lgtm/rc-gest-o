import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { fmt } from '@/lib/data/presencas'
import { alternarItem, guardarOcorrencia } from '../actions'
import SubmitButton from '@/components/SubmitButton'
import type { ChecklistResposta } from '@/lib/supabase/database.types'

export default async function ChecklistRegistoPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string; registoId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { estudio: slug, registoId } = await params
  const { error } = await searchParams

  const supabase = await createClient()
  const [estudio, { data: registo }, { data: respostasData, error: erroRespostas }] =
    await Promise.all([
      getEstudioPorSlug(supabase, slug),
      supabase
        .from('checklist_registos')
        .select('id, estudio_id, tipo, data, hora, concluidos, total, ocorrencia')
        .eq('id', registoId)
        .maybeSingle(),
      supabase.from('checklist_respostas').select('*').eq('registo_id', registoId),
    ])

  if (!estudio || !registo || registo.estudio_id !== estudio.id) {
    notFound()
  }

  if (erroRespostas) {
    throw new Error(erroRespostas.message)
  }

  const { data: modelo } = await supabase
    .from('checklist_modelo')
    .select('secao, item, ordem')
    .eq('tipo', registo.tipo)
    .order('ordem')

  // As respostas guardam o texto do item tal como estava no modelo no
  // dia em que a checklist foi iniciada (não têm uma ligação direta ao
  // modelo, para não mudarem se o modelo for editado mais tarde). Por
  // isso, para as mostrar pela ordem certa, comparamos o texto com o
  // modelo atual em vez de usar uma chave estrangeira.
  const ordemMap = new Map((modelo ?? []).map((m) => [`${m.secao}\u0000${m.item}`, m.ordem]))
  const respostas = (respostasData ?? []) as ChecklistResposta[]
  const porSecao = new Map<string, ChecklistResposta[]>()
  for (const r of [...respostas].sort(
    (a, b) =>
      (ordemMap.get(`${a.secao}\u0000${a.item}`) ?? 0) -
      (ordemMap.get(`${b.secao}\u0000${b.item}`) ?? 0)
  )) {
    const lista = porSecao.get(r.secao) ?? []
    lista.push(r)
    porSecao.set(r.secao, lista)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/painel/${slug}/checklist`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← Abertura / Fecho
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        {registo.tipo}
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {fmt(registo.data)} · {registo.hora.slice(0, 5)} · {registo.concluidos} de {registo.total}{' '}
        feitos
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-6">
        {[...porSecao.entries()].map(([secao, itens]) => (
          <div key={secao}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {secao}
            </h2>
            <div className="mt-2 flex flex-col gap-1.5">
              {itens.map((r) => (
                <form key={r.id} action={alternarItem}>
                  <input type="hidden" name="estudio_slug" value={slug} />
                  <input type="hidden" name="registo_id" value={registoId} />
                  <input type="hidden" name="resposta_id" value={r.id} />
                  <input type="hidden" name="ok" value={(!r.ok).toString()} />
                  <SubmitButton
                    pendingText={r.item}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${
                      r.ok
                        ? 'border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-100'
                        : 'border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950'
                    }`}
                  >
                    <span className="text-base leading-none">{r.ok ? '☑' : '☐'}</span>
                    {r.item}
                  </SubmitButton>
                </form>
              ))}
            </div>
          </div>
        ))}
      </div>

      {respostas.length === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-black/10 p-6 text-center text-sm text-zinc-500 dark:border-white/10">
          Esta checklist não tem itens.
        </div>
      )}

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Ocorrência (opcional)
      </h2>
      <form action={guardarOcorrencia} className="mt-2 flex flex-col gap-2">
        <input type="hidden" name="estudio_slug" value={slug} />
        <input type="hidden" name="registo_id" value={registoId} />
        <textarea
          name="ocorrencia"
          rows={3}
          defaultValue={registo.ocorrencia ?? ''}
          placeholder="ex.: torneira da casa de banho a pingar, avisar manutenção"
          className="rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900 dark:focus:border-white/30"
        />
        <SubmitButton
          pendingText="A guardar…"
          className="self-start rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
        >
          Guardar ocorrência
        </SubmitButton>
      </form>
    </div>
  )
}
