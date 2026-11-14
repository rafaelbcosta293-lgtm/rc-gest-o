import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { fmt } from '@/lib/data/presencas'
import { registarChecklist } from '../actions'
import ChecklistForm from './ChecklistForm'
import { AJUDA_OCORRENCIAS, TEXTO_CHECKLIST } from '@/lib/data/checklistPadrao'
import type { ChecklistResposta, TipoOperacao } from '@/lib/supabase/database.types'

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
        .select('id, estudio_id, tipo, data, hora, concluidos, total, ocorrencia, pt:perfis!pt_id(nome)')
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

  const responsavel = (registo.pt as unknown as { nome: string } | null)?.nome?.trim() ?? null
  const texto = TEXTO_CHECKLIST[registo.tipo as TipoOperacao]

  const secoes = [...porSecao.entries()].map(([secao, itens]) => ({
    secao,
    itens: itens.map((r) => ({ id: r.id, item: r.item, ok: r.ok })),
  }))

  return (
    <div className="mx-auto max-w-7xl px-4 py-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Link href={`/painel/${slug}/checklist`} className="text-sm text-muted underline">
          ← Abertura / Fecho
        </Link>
        <h1 className="text-xl font-semibold text-foreground">{registo.tipo}</h1>
        <p className="text-sm text-muted">
          {fmt(registo.data)} · {registo.hora.slice(0, 5)}
          {responsavel ? ` · Responsável: ${responsavel}` : ''}
        </p>
      </div>
      {texto && (
        <p className="mt-1.5 text-xs leading-snug text-muted">
          {texto.intro} <span className="font-medium text-foreground">⚠️ {texto.nota}</span>
        </p>
      )}

      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>
      )}

      {respostas.length === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-border-subtle p-6 text-center text-sm text-zinc-500">
          Esta checklist não tem itens.
        </div>
      )}

      <ChecklistForm
        slug={slug}
        registoId={registoId}
        tipo={registo.tipo}
        secoes={secoes}
        ocorrenciaInicial={registo.ocorrencia ?? ''}
        ajudaOcorrencias={AJUDA_OCORRENCIAS}
        action={registarChecklist}
      />
    </div>
  )
}
