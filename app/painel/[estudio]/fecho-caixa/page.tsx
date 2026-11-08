import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { fmt } from '@/lib/data/presencas'
import {
  calcularFechoCaixa,
  descricaoPagamento,
  grupoMetodo,
  somarNumerario,
  somarPorGrupoMetodo,
  somarSaidas,
  type GrupoMetodo,
} from '@/lib/data/fechoCaixa'
import {
  registarFechoCaixa,
  registarSaidaCaixa,
  anularSaidaCaixa,
  registarOutroCaixa,
  anularOutroCaixa,
} from './actions'
import SubmitButton from '@/components/SubmitButton'
import ConfirmarAcao from '@/components/ConfirmarAcao'
import type { TipoSaidaCaixa, TipoMovimentoOutros } from '@/lib/supabase/database.types'

const TIPOS_SAIDA: TipoSaidaCaixa[] = ['Sangria', 'Compra']
const TIPOS_OUTROS: TipoMovimentoOutros[] = ['Entrada', 'Saída']
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

type FechoResumo = {
  id: string
  data: string
  valor_numerario_dia: number
  saldo_anterior: number
  saidas_caixa_dia: number
  outros_entrada_dia: number
  outros_saida_dia: number
  valor_contado: number
}

type LinhaVenda = {
  nome: string
  descricao: string
  valor: number
}

type MovimentoLista = {
  id: string
  valor: number
  descricao: string | null
  anulado_em: string | null
  motivo_anulacao: string | null
  anulado: { nome: string } | null
}

type SaidaLista = MovimentoLista & { tipo: TipoSaidaCaixa }
type OutroLista = MovimentoLista & { tipo: TipoMovimentoOutros; documento: string | null }

function corDiferenca(diferenca: number): string {
  if (diferenca === 0) return 'text-emerald-700 dark:text-emerald-400'
  return diferenca > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400'
}

function labelDiferenca(diferenca: number): string {
  if (diferenca === 0) return '0,00 €'
  const sinal = diferenca > 0 ? '+' : ''
  return `${sinal}${diferenca.toFixed(2)} €`
}

function LinhaResumo({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${destaque ? 'border-t border-border-subtle pt-3' : ''}`}
    >
      <span className={destaque ? 'font-semibold text-foreground' : 'text-muted'}>{label}</span>
      <span className={destaque ? 'text-lg font-bold text-foreground' : 'font-semibold text-foreground'}>
        {valor}
      </span>
    </div>
  )
}

function TabelaVendas({ linhas }: { linhas: LinhaVenda[] }) {
  if (linhas.length === 0) {
    return <p className="mt-2 px-3 text-xs text-zinc-500">Sem entradas hoje.</p>
  }
  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-border-subtle">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border-subtle bg-border-subtle/40 text-left uppercase tracking-wide text-muted">
            <th className="px-3 py-1.5">Sócio</th>
            <th className="px-3 py-1.5">Descrição</th>
            <th className="px-3 py-1.5 text-right">Entradas</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className={`bg-surface ${i === 0 ? '' : 'border-t border-border-subtle'}`}>
              <td className="px-3 py-1.5 font-medium text-foreground">{l.nome}</td>
              <td className="px-3 py-1.5 text-muted">{l.descricao}</td>
              <td className="px-3 py-1.5 text-right font-semibold text-foreground">{l.valor.toFixed(2)} €</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
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
  const diaSemana = DIAS_SEMANA[new Date(`${hoje}T00:00:00`).getDay()]

  const supabase = await createClient()
  const [estudio, sessao] = await Promise.all([getEstudioPorSlug(supabase, slug), getSessaoAtual()])
  if (!estudio) {
    notFound()
  }
  const { ehGestao } = papeisDaSessao(sessao)

  const [
    { data: clientes, error: erroClientes },
    { data: fechoHojeData, error: erroFechoHoje },
    { data: recentesData, error: erroRecentes },
    { data: saidasHojeData, error: erroSaidasHoje },
    { data: outrosHojeData, error: erroOutrosHoje },
  ] = await Promise.all([
    supabase.from('clientes').select('id').eq('estudio_id', estudio.id),
    supabase.from('fechos_caixa').select('*').eq('estudio_id', estudio.id).eq('data', hoje).maybeSingle(),
    // A consulta já vem ordenada por data decrescente, por isso o
    // primeiro destes é precisamente o fecho anterior a hoje — reaproveitado
    // como "saldo anterior" quando ainda não há fecho de hoje, em vez de
    // repetir a mesma consulta.
    supabase
      .from('fechos_caixa')
      .select(
        'id, data, valor_numerario_dia, saldo_anterior, saidas_caixa_dia, outros_entrada_dia, outros_saida_dia, valor_contado'
      )
      .eq('estudio_id', estudio.id)
      .lt('data', hoje)
      .order('data', { ascending: false })
      .limit(6),
    // Todas as saídas/outros de hoje, incluindo anulados — para mostrar
    // na lista riscados, tal como o histórico de pagamentos.
    supabase
      .from('saidas_caixa')
      .select('id, tipo, valor, descricao, anulado_em, motivo_anulacao, anulado:perfis!anulado_por(nome)')
      .eq('estudio_id', estudio.id)
      .eq('data', hoje)
      .order('criado_em', { ascending: false }),
    supabase
      .from('outros_caixa')
      .select(
        'id, tipo, documento, descricao, valor, anulado_em, motivo_anulacao, anulado:perfis!anulado_por(nome)'
      )
      .eq('estudio_id', estudio.id)
      .eq('data', hoje)
      .order('criado_em', { ascending: false }),
  ])

  if (erroClientes || erroFechoHoje || erroRecentes || erroSaidasHoje || erroOutrosHoje) {
    throw new Error(
      (erroClientes ?? erroFechoHoje ?? erroRecentes ?? erroSaidasHoje ?? erroOutrosHoje)!.message
    )
  }

  const idsClientes = (clientes ?? []).map((c) => c.id)
  const { data: pagamentosHojeData, error: erroPagamentos } = idsClientes.length
    ? await supabase
        .from('pagamentos_ativos')
        .select('valor, metodo, inclui_inscricao, inclui_seguro, inclui_reativacao, cliente:clientes(nome), plano:planos(nome)')
        .in('cliente_id', idsClientes)
        .eq('data_pagamento', hoje)
    : { data: [], error: null }

  if (erroPagamentos) {
    throw new Error(erroPagamentos.message)
  }

  type PagamentoHoje = {
    valor: number
    metodo: string | null
    inclui_inscricao: boolean
    inclui_seguro: boolean
    inclui_reativacao: boolean
    cliente: { nome: string } | { nome: string }[] | null
    plano: { nome: string } | { nome: string }[] | null
  }
  const pagamentosHoje = ((pagamentosHojeData ?? []) as unknown as PagamentoHoje[]).map((p) => ({
    ...p,
    valor: Number(p.valor),
    cliente: Array.isArray(p.cliente) ? (p.cliente[0] ?? null) : p.cliente,
    plano: Array.isArray(p.plano) ? (p.plano[0] ?? null) : p.plano,
  }))

  const valorNumerarioDia = somarNumerario(pagamentosHoje.map((p) => ({ valor: p.valor, metodo: p.metodo })))
  const totaisPorGrupo = somarPorGrupoMetodo(pagamentosHoje.map((p) => ({ valor: p.valor, metodo: p.metodo })))

  const linhasPorGrupo: Record<GrupoMetodo, LinhaVenda[]> = {
    'Numerário': [],
    'MB Way': [],
    'TPA / Transferências': [],
  }
  for (const p of pagamentosHoje) {
    linhasPorGrupo[grupoMetodo(p.metodo)].push({
      nome: p.cliente?.nome ?? '—',
      descricao: descricaoPagamento(p),
      valor: p.valor,
    })
  }

  const saidasHoje: SaidaLista[] = ((saidasHojeData ?? []) as unknown as SaidaLista[]).map((s) => ({
    ...s,
    valor: Number(s.valor),
  }))
  const outrosHoje: OutroLista[] = ((outrosHojeData ?? []) as unknown as OutroLista[]).map((o) => ({
    ...o,
    valor: Number(o.valor),
  }))

  const saidasCaixaDia = somarSaidas(saidasHoje.filter((s) => !s.anulado_em))
  const outrosEntradaDia = somarSaidas(
    outrosHoje.filter((o) => !o.anulado_em && o.tipo === 'Entrada')
  )
  const outrosSaidaDia = somarSaidas(outrosHoje.filter((o) => !o.anulado_em && o.tipo === 'Saída'))

  const recentes: FechoResumo[] = (recentesData ?? []).map((f) => ({
    ...f,
    valor_numerario_dia: Number(f.valor_numerario_dia),
    saldo_anterior: Number(f.saldo_anterior),
    saidas_caixa_dia: Number(f.saidas_caixa_dia),
    outros_entrada_dia: Number(f.outros_entrada_dia),
    outros_saida_dia: Number(f.outros_saida_dia),
    valor_contado: Number(f.valor_contado),
  }))

  const fechoHoje = fechoHojeData
    ? {
        ...fechoHojeData,
        valor_numerario_dia: Number(fechoHojeData.valor_numerario_dia),
        saldo_anterior: Number(fechoHojeData.saldo_anterior),
        saidas_caixa_dia: Number(fechoHojeData.saidas_caixa_dia),
        outros_entrada_dia: Number(fechoHojeData.outros_entrada_dia),
        outros_saida_dia: Number(fechoHojeData.outros_saida_dia),
        valor_contado: Number(fechoHojeData.valor_contado),
      }
    : null

  // Antes de o fecho de hoje existir, o saldo anterior é o valor contado
  // no último fecho registado (normalmente ontem); depois de existir, é
  // o valor já guardado nesse fecho, que não muda retroativamente.
  const saldoAnterior = fechoHoje ? fechoHoje.saldo_anterior : recentes[0]?.valor_contado ?? 0

  const { valorEsperado } = calcularFechoCaixa({
    saldoAnterior,
    valorNumerarioDia,
    saidasCaixaDia,
    outrosEntradaDia,
    outrosSaidaDia,
    valorContado: 0,
  })
  const entradasTotal =
    valorNumerarioDia + totaisPorGrupo['MB Way'] + totaisPorGrupo['TPA / Transferências'] + outrosEntradaDia
  const saidasTotal = saidasCaixaDia + outrosSaidaDia

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
        {estudio.nome} · {diaSemana}, {fmt(hoje)}.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface">
        <LinhaResumo label="Saldo anterior" valor={`${saldoAnterior.toFixed(2)} €`} />
        <LinhaResumo label="Entradas" valor={`${entradasTotal.toFixed(2)} €`} />
        <LinhaResumo label="Saídas" valor={`-${saidasTotal.toFixed(2)} €`} />
        <LinhaResumo
          label="Outros (entrada / saída)"
          valor={`+${outrosEntradaDia.toFixed(2)} € / -${outrosSaidaDia.toFixed(2)} €`}
        />
        <LinhaResumo label="Valor esperado em caixa" valor={`${valorEsperado.toFixed(2)} €`} destaque />
      </div>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Entradas Numerário
      </h2>
      <TabelaVendas linhas={linhasPorGrupo['Numerário']} />

      <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Entradas MB Way
      </h2>
      <TabelaVendas linhas={linhasPorGrupo['MB Way']} />

      <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Entradas TPA / Transferências
      </h2>
      <TabelaVendas linhas={linhasPorGrupo['TPA / Transferências']} />

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Saídas de caixa (sangria ou compras)
      </h2>
      <form action={registarSaidaCaixa} className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="estudio_slug" value={slug} />
        <input type="hidden" name="estudio_id" value={estudio.id} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Tipo</label>
          <select
            name="tipo"
            className="rounded-md border border-border-subtle px-3 py-2 text-sm outline-none dark:bg-zinc-900"
          >
            {TIPOS_SAIDA.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Valor (€)</label>
          <input
            name="valor"
            type="number"
            step="0.01"
            min="0.01"
            required
            className="rounded-md border border-border-subtle px-3 py-2 text-sm outline-none focus:border-black/30 dark:bg-zinc-900 dark:focus:border-white/30"
          />
        </div>
        <div className="flex flex-1 basis-40 flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Descrição</label>
          <input
            name="descricao"
            placeholder="Ex.: material de limpeza"
            className="w-full rounded-md border border-border-subtle px-3 py-2 text-sm outline-none focus:border-black/30 dark:bg-zinc-900 dark:focus:border-white/30"
          />
        </div>
        <SubmitButton
          pendingText="A guardar…"
          className="rounded-full border border-border-strong px-4 py-2 text-sm font-bold hover:bg-foreground/[.08]"
        >
          Registar saída
        </SubmitButton>
      </form>

      {saidasHoje.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {saidasHoje.map((s) => (
            <div
              key={s.id}
              className={`flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-surface p-3 text-sm ${s.anulado_em ? 'opacity-50' : ''}`}
            >
              <span className={`font-medium text-foreground ${s.anulado_em ? 'line-through' : ''}`}>
                {s.valor.toFixed(2)}€
              </span>
              <span className="text-xs text-zinc-500">{s.tipo}</span>
              {s.descricao && <span className="text-xs text-zinc-500">{s.descricao}</span>}
              {s.anulado_em ? (
                <span className="w-full text-xs font-medium text-red-600">
                  Anulado{s.anulado ? ` por ${s.anulado.nome}` : ''}
                  {s.motivo_anulacao ? ` · ${s.motivo_anulacao}` : ''}
                </span>
              ) : (
                ehGestao && (
                  <ConfirmarAcao
                    action={anularSaidaCaixa}
                    confirmacao={`Anular a saída de ${s.valor.toFixed(2)}€ (${s.tipo})? Fica registado quem anulou e porquê — não pode ser desfeito.`}
                    className="ml-auto flex items-center gap-1.5"
                  >
                    <input type="hidden" name="estudio_slug" value={slug} />
                    <input type="hidden" name="id" value={s.id} />
                    <input
                      name="motivo"
                      placeholder="Motivo da anulação"
                      className="w-40 rounded-md border border-border-subtle px-2 py-1 text-xs dark:bg-zinc-900"
                    />
                    <SubmitButton
                      pendingText="…"
                      aria-label="Anular"
                      className="text-lg text-zinc-400 hover:text-red-600"
                    >
                      ×
                    </SubmitButton>
                  </ConfirmarAcao>
                )
              )}
            </div>
          ))}
        </div>
      )}

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">Outros</h2>
      <form action={registarOutroCaixa} className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="estudio_slug" value={slug} />
        <input type="hidden" name="estudio_id" value={estudio.id} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Tipo</label>
          <select
            name="tipo"
            className="rounded-md border border-border-subtle px-3 py-2 text-sm outline-none dark:bg-zinc-900"
          >
            {TIPOS_OUTROS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Valor (€)</label>
          <input
            name="valor"
            type="number"
            step="0.01"
            min="0.01"
            required
            className="rounded-md border border-border-subtle px-3 py-2 text-sm outline-none focus:border-black/30 dark:bg-zinc-900 dark:focus:border-white/30"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Documento</label>
          <input
            name="documento"
            placeholder="Nº do documento"
            className="w-28 rounded-md border border-border-subtle px-3 py-2 text-sm outline-none focus:border-black/30 dark:bg-zinc-900 dark:focus:border-white/30"
          />
        </div>
        <div className="flex flex-1 basis-40 flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Descrição</label>
          <input
            name="descricao"
            className="w-full rounded-md border border-border-subtle px-3 py-2 text-sm outline-none focus:border-black/30 dark:bg-zinc-900 dark:focus:border-white/30"
          />
        </div>
        <SubmitButton
          pendingText="A guardar…"
          className="rounded-full border border-border-strong px-4 py-2 text-sm font-bold hover:bg-foreground/[.08]"
        >
          Registar
        </SubmitButton>
      </form>

      {outrosHoje.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {outrosHoje.map((o) => (
            <div
              key={o.id}
              className={`flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-surface p-3 text-sm ${o.anulado_em ? 'opacity-50' : ''}`}
            >
              <span className={`font-medium text-foreground ${o.anulado_em ? 'line-through' : ''}`}>
                {o.tipo === 'Saída' ? '-' : '+'}
                {o.valor.toFixed(2)}€
              </span>
              <span className="text-xs text-zinc-500">{o.tipo}</span>
              {o.documento && <span className="text-xs text-zinc-500">Doc. {o.documento}</span>}
              {o.descricao && <span className="text-xs text-zinc-500">{o.descricao}</span>}
              {o.anulado_em ? (
                <span className="w-full text-xs font-medium text-red-600">
                  Anulado{o.anulado ? ` por ${o.anulado.nome}` : ''}
                  {o.motivo_anulacao ? ` · ${o.motivo_anulacao}` : ''}
                </span>
              ) : (
                ehGestao && (
                  <ConfirmarAcao
                    action={anularOutroCaixa}
                    confirmacao={`Anular este movimento de ${o.valor.toFixed(2)}€ (${o.tipo})? Fica registado quem anulou e porquê — não pode ser desfeito.`}
                    className="ml-auto flex items-center gap-1.5"
                  >
                    <input type="hidden" name="estudio_slug" value={slug} />
                    <input type="hidden" name="id" value={o.id} />
                    <input
                      name="motivo"
                      placeholder="Motivo da anulação"
                      className="w-40 rounded-md border border-border-subtle px-2 py-1 text-xs dark:bg-zinc-900"
                    />
                    <SubmitButton
                      pendingText="…"
                      aria-label="Anular"
                      className="text-lg text-zinc-400 hover:text-red-600"
                    >
                      ×
                    </SubmitButton>
                  </ConfirmarAcao>
                )
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 rounded-xl border border-border-subtle bg-surface p-5">
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
                <dd className={`font-semibold ${corDiferenca(fechoHoje.valor_contado - valorEsperado)}`}>
                  {labelDiferenca(fechoHoje.valor_contado - valorEsperado)}
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
          const diferenca =
            f.valor_contado -
            (f.saldo_anterior + f.valor_numerario_dia + f.outros_entrada_dia - f.saidas_caixa_dia - f.outros_saida_dia)
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
