import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { fmt } from '@/lib/data/presencas'
import { calcularFechoCaixa, somarNumerario } from '@/lib/data/fechoCaixa'
import { registarFechoCaixa, atualizarFundoTroco } from './actions'
import SubmitButton from '@/components/SubmitButton'

type FechoResumo = {
  id: string
  data: string
  valor_numerario_dia: number
  fundo_troco: number
  valor_contado: number
  nota: string | null
}

function corDiferenca(diferenca: number): string {
  if (diferenca === 0) return 'text-emerald-700 dark:text-emerald-400'
  return diferenca > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400'
}

function labelDiferenca(diferenca: number): string {
  if (diferenca === 0) return '0,00 €'
  const sinal = diferenca > 0 ? '+' : ''
  return `${sinal}${diferenca.toFixed(2)} €`
}

function FormularioFecho({
  slug,
  estudioId,
  valorEsperado,
  valorContadoDefault,
  notaDefault,
}: {
  slug: string
  estudioId: number
  valorEsperado: number
  valorContadoDefault?: number
  notaDefault?: string | null
}) {
  return (
    <form action={registarFechoCaixa} className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="estudio_slug" value={slug} />
      <input type="hidden" name="estudio_id" value={estudioId} />
      <div>
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Valor contado em caixa (€)
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          required
          name="valor_contado"
          defaultValue={valorContadoDefault ?? valorEsperado}
          className="mt-1 w-full rounded-md border border-border-subtle px-3 py-2 text-sm outline-none focus:border-black/30 dark:bg-zinc-900 dark:focus:border-white/30"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Nota (opcional)</label>
        <input
          name="nota"
          defaultValue={notaDefault ?? ''}
          placeholder="Ex.: faltam 5€, foram para a compra de material"
          className="mt-1 w-full rounded-md border border-border-subtle px-3 py-2 text-sm outline-none focus:border-black/30 dark:bg-zinc-900 dark:focus:border-white/30"
        />
      </div>
      <SubmitButton
        pendingText="A guardar…"
        className="self-start rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
      >
        Registar fecho
      </SubmitButton>
    </form>
  )
}

export default async function FechoCaixaPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { estudio: slug } = await params
  const { error } = await searchParams
  const hoje = new Date().toISOString().slice(0, 10)

  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) {
    notFound()
  }

  const [
    { data: clientes, error: erroClientes },
    { data: fechoHojeData, error: erroFechoHoje },
    { data: recentesData, error: erroRecentes },
  ] = await Promise.all([
    supabase.from('clientes').select('id').eq('estudio_id', estudio.id),
    supabase.from('fechos_caixa').select('*').eq('estudio_id', estudio.id).eq('data', hoje).maybeSingle(),
    supabase
      .from('fechos_caixa')
      .select('id, data, valor_numerario_dia, fundo_troco, valor_contado, nota')
      .eq('estudio_id', estudio.id)
      .lt('data', hoje)
      .order('data', { ascending: false })
      .limit(6),
  ])

  if (erroClientes || erroFechoHoje || erroRecentes) {
    throw new Error((erroClientes ?? erroFechoHoje ?? erroRecentes)!.message)
  }

  const idsClientes = (clientes ?? []).map((c) => c.id)
  const { data: pagamentosHojeData, error: erroPagamentos } = idsClientes.length
    ? await supabase
        .from('pagamentos')
        .select('valor, metodo')
        .in('cliente_id', idsClientes)
        .eq('data_pagamento', hoje)
    : { data: [], error: null }

  if (erroPagamentos) {
    throw new Error(erroPagamentos.message)
  }

  const valorNumerarioDia = somarNumerario(
    (pagamentosHojeData ?? []).map((p) => ({ valor: Number(p.valor), metodo: p.metodo }))
  )
  const { valorEsperado } = calcularFechoCaixa({
    fundoTroco: estudio.fundo_troco_caixa,
    valorNumerarioDia,
    valorContado: 0,
  })

  const fechoHoje = fechoHojeData
    ? {
        ...fechoHojeData,
        valor_numerario_dia: Number(fechoHojeData.valor_numerario_dia),
        fundo_troco: Number(fechoHojeData.fundo_troco),
        valor_contado: Number(fechoHojeData.valor_contado),
      }
    : null

  const recentes: FechoResumo[] = (recentesData ?? []).map((f) => ({
    ...f,
    valor_numerario_dia: Number(f.valor_numerario_dia),
    fundo_troco: Number(f.fundo_troco),
    valor_contado: Number(f.valor_contado),
  }))

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/painel/${slug}/checklist`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-foreground">Fecho de Caixa</h1>
      <p className="mt-1 text-sm text-muted">
        {estudio.nome} · dinheiro físico em caixa, hoje {fmt(hoje)}.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 rounded-xl border border-border-subtle bg-surface p-5">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted">Fundo de troco</dt>
            <dd className="font-semibold text-foreground">{estudio.fundo_troco_caixa.toFixed(2)} €</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Numerário recebido hoje</dt>
            <dd className="font-semibold text-foreground">{valorNumerarioDia.toFixed(2)} €</dd>
          </div>
          <div className="col-span-2 border-t border-border-subtle pt-3">
            <dt className="text-xs text-muted">Valor esperado em caixa</dt>
            <dd className="text-lg font-bold text-foreground">{valorEsperado.toFixed(2)} €</dd>
          </div>
        </dl>

        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
            Alterar fundo de troco
          </summary>
          <form action={atualizarFundoTroco} className="mt-2 flex items-center gap-2">
            <input type="hidden" name="estudio_slug" value={slug} />
            <input type="hidden" name="estudio_id" value={estudio.id} />
            <input
              type="number"
              step="0.01"
              min="0"
              required
              name="fundo_troco_caixa"
              defaultValue={estudio.fundo_troco_caixa}
              className="w-28 rounded-md border border-border-subtle px-2 py-1.5 text-sm dark:bg-zinc-900"
            />
            <SubmitButton
              pendingText="…"
              className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-semibold hover:bg-foreground/[.08]"
            >
              Guardar
            </SubmitButton>
          </form>
        </details>
      </div>

      <div className="mt-6 rounded-xl border border-border-subtle bg-surface p-5">
        {fechoHoje ? (
          <>
            <h2 className="font-semibold text-foreground">Fecho de hoje já registado</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted">Valor contado</dt>
                <dd className="font-semibold text-foreground">{fechoHoje.valor_contado.toFixed(2)} €</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Diferença</dt>
                <dd className={`font-semibold ${corDiferenca(fechoHoje.valor_contado - (fechoHoje.fundo_troco + fechoHoje.valor_numerario_dia))}`}>
                  {labelDiferenca(fechoHoje.valor_contado - (fechoHoje.fundo_troco + fechoHoje.valor_numerario_dia))}
                </dd>
              </div>
            </dl>
            {fechoHoje.nota && <p className="mt-2 text-xs text-muted">Nota: {fechoHoje.nota}</p>}
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
                Corrigir valor contado
              </summary>
              <FormularioFecho
                slug={slug}
                estudioId={estudio.id}
                valorEsperado={valorEsperado}
                valorContadoDefault={fechoHoje.valor_contado}
                notaDefault={fechoHoje.nota}
              />
            </details>
          </>
        ) : (
          <>
            <h2 className="font-semibold text-foreground">Registar fecho de hoje</h2>
            <FormularioFecho slug={slug} estudioId={estudio.id} valorEsperado={valorEsperado} />
          </>
        )}
      </div>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Histórico recente
      </h2>
      {recentes.length === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-border-subtle p-6 text-center text-sm text-zinc-500">
          Ainda não há fechos de dias anteriores.
        </div>
      )}
      <div className="mt-3 flex flex-col gap-2">
        {recentes.map((f) => {
          const diferenca = f.valor_contado - (f.fundo_troco + f.valor_numerario_dia)
          return (
            <div
              key={f.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface p-3 text-sm"
            >
              <span>{fmt(f.data)}</span>
              <span className="flex items-center gap-3 text-xs">
                <span className="text-zinc-500">contado {f.valor_contado.toFixed(2)} €</span>
                <span className={`font-semibold ${corDiferenca(diferenca)}`}>{labelDiferenca(diferenca)}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
