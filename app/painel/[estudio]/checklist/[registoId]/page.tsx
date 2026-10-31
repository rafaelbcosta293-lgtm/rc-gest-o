import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { fmt } from '@/lib/data/presencas'
import { alternarItem, guardarOcorrencia } from '../actions'
import SubmitButton from '@/components/SubmitButton'
import OcorrenciaForm from './OcorrenciaForm'
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
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href={`/painel/${slug}/checklist`}
        className="text-sm text-muted underline"
      >
        ← Abertura / Fecho
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-foreground">
        {registo.tipo}
      </h1>
      <p className="mt-1 text-sm text-muted">
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
                        : 'border-border-subtle bg-surface'
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
        <div className="mt-3 rounded-xl border border-dashed border-border-subtle p-6 text-center text-sm text-zinc-500">
          Esta checklist não tem itens.
        </div>
      )}

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Ocorrência (opcional)
      </h2>
      <OcorrenciaForm
        slug={slug}
        registoId={registoId}
        valorInicial={registo.ocorrencia ?? ''}
        action={guardarOcorrencia}
      />
    </div>
  )
}
