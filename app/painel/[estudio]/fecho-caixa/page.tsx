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
  somarNumerario,
  somarPorGrupoMetodo,
  somarSaidas,
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
const inputCls =
  'rounded-md border border-border-subtle px-2.5 py-1.5 text-xs outline-none focus:border-black/30 dark:bg-zinc-900 dark:focus:border-white/30'

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

type LinhaEntrada = {
  nome: string
  metodo: string
  descricao: string
}

type MovimentoBase = {
  id: string
  valor: number
  descricao: string | null
  criado_em: string
  anulado_em: string | null
  motivo_anulacao: string | null
  anulado: { nome: string } | null
}

type SaidaLista = MovimentoBase & { tipo: TipoSaidaCaixa }
type OutroLista = MovimentoBase & { tipo: TipoMovimentoOutros; documento: string | null }

type MovimentoLinha = {
  id: string
  origem: 'saida' | 'outro'
  tipo: string
  sinal: 1 | -1
  valor: number
  descricao: string
  criado_em: string
  anulado_em: string | null
  motivo_anulacao: string | null
  anulado: { nome: string } | null
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

function LinhaResumo({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-1.5 text-sm ${destaque ? 'mt-1 border-t border-border-subtle pt-2.5' : ''}`}
    >
      <span className={destaque ? 'font-semibold text-foreground' : 'text-muted'}>{label}</span>
      <span className={destaque ? 'text-lg font-bold text-foreground' : 'font-semibold text-foreground'}>
        {valor}
      </span>
    </div>
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
      .select(
        'id, tipo, valor, descricao, criado_em, anulado_em, motivo_anulacao, anulado:perfis!anulado_por(nome)'
      )
      .eq('estudio_id', estudio.id)
      .eq('data', hoje)
      .order('criado_em', { ascending: false }),
    supabase
      .from('outros_caixa')
      .select(
        'id, tipo, documento, descricao, valor, criado_em, anulado_em, motivo_anulacao, anulado:perfis!anulado_por(nome)'
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

  // Uma única tabela de entradas, ordenada por método — em vez de 3
  // tabelas separadas, cada linha já diz o método, por isso chega.
  const linhasEntradas: LinhaEntrada[] = pagamentosHoje.map((p) => ({
    nome: p.cliente?.nome ?? '—',
    metodo: p.metodo ?? 'Numerário',
    descricao: descricaoPagamento(p),
  }))

  const saidasHoje: SaidaLista[] = ((saidasHojeData ?? []) as unknown as SaidaLista[]).map((s) => ({
    ...s,
    valor: Number(s.valor),
  }))
  const outrosHoje: OutroLista[] = ((outrosHojeData ?? []) as unknown as OutroLista[]).map((o) => ({
    ...o,
    valor: Number(o.valor),
  }))

  const saidasCaixaDia = somarSaidas(saidasHoje.filter((s) => !s.anulado_em))
  const outrosEntradaDia = somarSaidas(outrosHoje.filter((o) => !o.anulado_em && o.tipo === 'Entrada'))
  const outrosSaidaDia = somarSaidas(outrosHoje.filter((o) => !o.anulado_em && o.tipo === 'Saída'))

  // Sangrias/compras e "outros" juntos numa só lista — são as duas
  // formas de movimentar a caixa fora dos pagamentos de clientes.
  const movimentosHoje: MovimentoLinha[] = [
    ...saidasHoje.map((s) => ({
      id: s.id,
      origem: 'saida' as const,
      tipo: s.tipo,
      sinal: -1 as const,
      valor: s.valor,
      descricao: s.descricao ?? '',
      criado_em: s.criado_em,
      anulado_em: s.anulado_em,
      motivo_anulacao: s.motivo_anulacao,
      anulado: s.anulado,
    })),
    ...outrosHoje.map((o) => ({
      id: o.id,
      origem: 'outro' as const,
      tipo: o.tipo,
      sinal: (o.tipo === 'Saída' ? -1 : 1) as 1 | -1,
      valor: o.valor,
      descricao: [o.documento && `Doc. ${o.documento}`, o.descricao].filter(Boolean).join(' · '),
      criado_em: o.criado_em,
      anulado_em: o.anulado_em,
      motivo_anulacao: o.motivo_anulacao,
      anulado: o.anulado,
    })),
  ].sort((a, b) => b.criado_em.localeCompare(a.criado_em))

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
  const diferencaHoje = fechoHoje ? fechoHoje.valor_contado - valorEsperado : null

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

      {/* Resumo + registo do fecho juntos num único cartão — é a tarefa
          principal da página, por isso fica tudo à vista sem caixas à parte. */}
      <div className="mt-6 rounded-xl border border-border-subtle bg-surface py-3">
        <LinhaResumo label="Saldo anterior" valor={`${saldoAnterior.toFixed(2)} €`} />
        <LinhaResumo label="Entradas" valor={`${entradasTotal.toFixed(2)} €`} />
        <LinhaResumo label="Saídas" valor={`-${saidasTotal.toFixed(2)} €`} />
        <LinhaResumo
          label="Outros (entrada / saída)"
          valor={`+${outrosEntradaDia.toFixed(2)} € / -${outrosSaidaDia.toFixed(2)} €`}
        />
        <LinhaResumo label="Valor esperado em caixa" valor={`${valorEsperado.toFixed(2)} €`} destaque />

        {fechoHoje && diferencaHoje !== null ? (
          <>
            <LinhaResumo label="Valor contado" valor={`${fechoHoje.valor_contado.toFixed(2)} €`} />
            <div className="flex items-center justify-between gap-3 px-4 py-1.5 text-sm">
              <span className="text-muted">Diferença</span>
              <span className={`font-semibold ${corDiferenca(diferencaHoje)}`}>
                {labelDiferenca(diferencaHoje)}
              </span>
            </div>
            {fechoHoje.nota && <p className="px-4 pt-1 text-xs text-muted">Nota: {fechoHoje.nota}</p>}
            <details className="px-4 pt-2">
              <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
                Corrigir valor contado
              </summary>
              <form action={registarFechoCaixa} className="mt-2 flex flex-wrap items-end gap-2 pb-1">
                <input type="hidden" name="estudio_slug" value={slug} />
                <input type="hidden" name="estudio_id" value={estudio.id} />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  name="valor_contado"
                  defaultValue={fechoHoje.valor_contado}
                  className={inputCls}
                />
                <input
                  name="nota"
                  defaultValue={fechoHoje.nota ?? ''}
                  placeholder="Nota (opcional)"
                  className={`${inputCls} flex-1 basis-40`}
                />
                <SubmitButton
                  pendingText="…"
                  className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-bold hover:bg-foreground/[.08]"
                >
                  Guardar
                </SubmitButton>
              </form>
            </details>
          </>
        ) : (
          <form action={registarFechoCaixa} className="mt-2 flex flex-wrap items-end gap-2 px-4 pt-1">
            <input type="hidden" name="estudio_slug" value={slug} />
            <input type="hidden" name="estudio_id" value={estudio.id} />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Valor contado (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                name="valor_contado"
                defaultValue={valorEsperado}
                className={inputCls}
              />
            </div>
            <div className="flex flex-1 basis-40 flex-col gap-1">
              <label className="text-xs text-muted">Nota (opcional)</label>
              <input name="nota" placeholder="Ex.: faltam 5€" className={`${inputCls} w-full`} />
            </div>
            <SubmitButton
              pendingText="A guardar…"
              className="rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-black shadow-pop hover:bg-brand-strong"
            >
              Registar fecho
            </SubmitButton>
          </form>
        )}
      </div>

      <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Entradas de hoje ({linhasEntradas.length})
      </h2>
      {linhasEntradas.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">Sem entradas hoje.</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-lg border border-border-subtle">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-subtle bg-border-subtle/40 text-left uppercase tracking-wide text-muted">
                <th className="px-3 py-1.5">Sócio</th>
                <th className="px-3 py-1.5">Descrição</th>
                <th className="px-3 py-1.5">Método</th>
              </tr>
            </thead>
            <tbody>
              {linhasEntradas.map((l, i) => (
                <tr key={i} className={`bg-surface ${i === 0 ? '' : 'border-t border-border-subtle'}`}>
                  <td className="px-3 py-1.5 font-medium text-foreground">{l.nome}</td>
                  <td className="px-3 py-1.5 text-muted">{l.descricao}</td>
                  <td className="px-3 py-1.5 text-muted">{l.metodo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Movimentos de caixa
      </h2>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
        <form action={registarSaidaCaixa} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="estudio_slug" value={slug} />
          <input type="hidden" name="estudio_id" value={estudio.id} />
          <select name="tipo" className={inputCls}>
            {TIPOS_SAIDA.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input name="valor" type="number" step="0.01" min="0.01" required placeholder="Valor (€)" className={`${inputCls} w-24`} />
          <input name="descricao" placeholder="Descrição" className={`${inputCls} w-36`} />
          <SubmitButton
            pendingText="…"
            className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-bold hover:bg-foreground/[.08]"
          >
            Registar
          </SubmitButton>
        </form>

        <form action={registarOutroCaixa} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="estudio_slug" value={slug} />
          <input type="hidden" name="estudio_id" value={estudio.id} />
          <select name="tipo" className={inputCls}>
            {TIPOS_OUTROS.map((t) => (
              <option key={t} value={t}>
                Outra {t.toLowerCase()}
              </option>
            ))}
          </select>
          <input name="valor" type="number" step="0.01" min="0.01" required placeholder="Valor (€)" className={`${inputCls} w-24`} />
          <input name="documento" placeholder="Documento" className={`${inputCls} w-24`} />
          <input name="descricao" placeholder="Descrição" className={`${inputCls} w-36`} />
          <SubmitButton
            pendingText="…"
            className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-bold hover:bg-foreground/[.08]"
          >
            Registar
          </SubmitButton>
        </form>
      </div>

      {movimentosHoje.length > 0 && (
        <div className="mt-2 overflow-x-auto rounded-lg border border-border-subtle">
          <table className="w-full text-xs">
            <tbody>
              {movimentosHoje.map((m, i) => (
                <tr key={m.id} className={`bg-surface ${i === 0 ? '' : 'border-t border-border-subtle'} ${m.anulado_em ? 'opacity-50' : ''}`}>
                  <td className="px-3 py-1.5 text-muted">{m.tipo}</td>
                  <td className={`px-3 py-1.5 ${m.descricao ? 'text-muted' : ''}`}>
                    {m.anulado_em ? (
                      <span className="font-medium text-red-600">
                        Anulado{m.anulado ? ` por ${m.anulado.nome}` : ''}
                        {m.motivo_anulacao ? ` · ${m.motivo_anulacao}` : ''}
                      </span>
                    ) : (
                      m.descricao
                    )}
                  </td>
                  <td className={`px-3 py-1.5 text-right font-semibold ${m.anulado_em ? 'text-foreground line-through' : m.sinal < 0 ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400'}`}>
                    {m.sinal < 0 ? '-' : '+'}
                    {m.valor.toFixed(2)} €
                  </td>
                  <td className="w-8 px-1 py-1.5 text-right">
                    {!m.anulado_em && ehGestao && (
                      <ConfirmarAcao
                        action={m.origem === 'saida' ? anularSaidaCaixa : anularOutroCaixa}
                        confirmacao={`Anular este movimento de ${m.valor.toFixed(2)}€ (${m.tipo})? Fica registado quem anulou e porquê — não pode ser desfeito.`}
                        className="inline-flex items-center gap-1"
                      >
                        <input type="hidden" name="estudio_slug" value={slug} />
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="motivo" value="" />
                        <SubmitButton
                          pendingText="…"
                          aria-label="Anular"
                          className="text-base text-zinc-400 hover:text-red-600"
                        >
                          ×
                        </SubmitButton>
                      </ConfirmarAcao>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Histórico recente
      </h2>
      {recentes.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">Ainda não há fechos de dias anteriores.</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-lg border border-border-subtle">
          <table className="w-full text-xs">
            <tbody>
              {recentes.map((f, i) => {
                const diferenca =
                  f.valor_contado -
                  (f.saldo_anterior + f.valor_numerario_dia + f.outros_entrada_dia - f.saidas_caixa_dia - f.outros_saida_dia)
                return (
                  <tr key={f.id} className={`bg-surface ${i === 0 ? '' : 'border-t border-border-subtle'}`}>
                    <td className="px-3 py-1.5 text-foreground">{fmt(f.data)}</td>
                    <td className="px-3 py-1.5 text-right text-muted">contado {f.valor_contado.toFixed(2)} €</td>
                    <td className={`px-3 py-1.5 text-right font-semibold ${corDiferenca(diferenca)}`}>
                      {labelDiferenca(diferenca)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
