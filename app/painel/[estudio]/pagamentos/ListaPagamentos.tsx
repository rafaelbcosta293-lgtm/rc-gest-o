'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDownAZ, ArrowUpAZ, ArrowDown01, ArrowUp01 } from 'lucide-react'
import { normalizarTexto } from '@/lib/texto'

export type LinhaPagamentoAtraso = {
  clienteId: string
  nome: string
  variante: 'atrasado' | 'emDia'
  situacaoLabel: string
  tipoMensalidade: string | null
  realizados: number
  adquiridos: number | null
  dataReferencia: string | null
  dataPagamento: string | null
}

export type LinhaSeguro = {
  clienteId: string
  nome: string
  emDividaDesdeLabel: string
  dataReferencia: string
}

type Direcao = 'asc' | 'desc'

type CampoOrdem<T> = {
  valor: string
  label: string
  obter: (l: T) => string | null
  omissao: Direcao
}

const CAMPO_NOME = <T extends { nome: string }>(): CampoOrdem<T> => ({
  valor: 'nome',
  label: 'Nome',
  obter: (l) => normalizarTexto(l.nome),
  omissao: 'asc',
})

const CAMPOS_ATRASADO_EMDIA: CampoOrdem<LinhaPagamentoAtraso>[] = [
  { valor: 'validade', label: 'Válido até', obter: (l) => l.dataReferencia, omissao: 'desc' },
  { valor: 'pagamento', label: 'Data de pagamento', obter: (l) => l.dataPagamento, omissao: 'desc' },
  CAMPO_NOME<LinhaPagamentoAtraso>(),
]

const CAMPOS_SEGURO: CampoOrdem<LinhaSeguro>[] = [
  { valor: 'renovacao', label: 'Data de renovação', obter: (l) => l.dataReferencia, omissao: 'desc' },
  CAMPO_NOME<LinhaSeguro>(),
]

// Quem não tem data (nunca pagou, por exemplo) fica sempre no fim,
// seja qual for a direção escolhida — não há "mais recente"/"mais
// antigo" para comparar.
function ordenarPor<T>(linhas: T[], campo: CampoOrdem<T>, direcao: Direcao): T[] {
  return [...linhas].sort((a, b) => {
    const va = campo.obter(a)
    const vb = campo.obter(b)
    if (va === null && vb === null) return 0
    if (va === null) return 1
    if (vb === null) return -1
    const cmp = va.localeCompare(vb)
    return direcao === 'desc' ? -cmp : cmp
  })
}

function useOrdem<T>(campos: CampoOrdem<T>[]) {
  const [valor, setValor] = useState(campos[0].valor)
  const [direcao, setDirecao] = useState<Direcao>(campos[0].omissao)
  const campo = campos.find((c) => c.valor === valor) ?? campos[0]

  function mudarCampo(novoValor: string) {
    const novoCampo = campos.find((c) => c.valor === novoValor)
    setValor(novoValor)
    if (novoCampo) setDirecao(novoCampo.omissao)
  }

  return { campo, direcao, mudarCampo, setDirecao }
}

function SeletorOrdem<T>({
  campos,
  campo,
  direcao,
  onCampo,
  onDirecao,
}: {
  campos: CampoOrdem<T>[]
  campo: CampoOrdem<T>
  direcao: Direcao
  onCampo: (valor: string) => void
  onDirecao: (d: Direcao) => void
}) {
  const ehNome = campo.valor === 'nome'
  const IconeAsc = ehNome ? ArrowDownAZ : ArrowUp01
  const IconeDesc = ehNome ? ArrowUpAZ : ArrowDown01
  return (
    <div className="flex shrink-0 items-center gap-1">
      <select
        value={campo.valor}
        onChange={(e) => onCampo(e.target.value)}
        className="rounded-full border border-border-subtle bg-surface px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-muted outline-none transition-colors hover:border-border-strong"
        title="Ordenar por"
      >
        {campos.map((c) => (
          <option key={c.valor} value={c.valor}>
            {c.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onDirecao(direcao === 'asc' ? 'desc' : 'asc')}
        className="rounded-full border border-border-subtle p-1 text-muted transition-colors hover:border-border-strong hover:bg-brand/[.06]"
        title={
          ehNome
            ? direcao === 'asc'
              ? 'A → Z'
              : 'Z → A'
            : direcao === 'desc'
              ? 'Mais recentes primeiro'
              : 'Mais antigos primeiro'
        }
      >
        {direcao === 'asc' ? <IconeAsc className="h-3 w-3" /> : <IconeDesc className="h-3 w-3" />}
      </button>
    </div>
  )
}

function LinhaPagamento({
  slug,
  linha,
  primeira,
}: {
  slug: string
  linha: LinhaPagamentoAtraso
  primeira: boolean
}) {
  const atrasado = linha.variante === 'atrasado'
  return (
    <Link
      href={`/painel/${slug}/pagamentos/${linha.clienteId}`}
      className={`flex flex-col gap-1.5 px-4 py-3.5 text-sm ${
        atrasado ? 'bg-red-50 hover:bg-red-100/70 dark:bg-red-950/40 dark:hover:bg-red-950/70' : 'bg-surface hover:bg-brand/[.06]'
      } ${primeira ? '' : atrasado ? 'border-t border-red-200 dark:border-red-900' : 'border-t border-border-subtle'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-foreground">{linha.nome}</span>
        <span
          className={`text-xs font-semibold ${
            atrasado ? 'text-red-700 dark:text-red-300' : 'text-teal-700 dark:text-teal-400'
          }`}
        >
          {linha.situacaoLabel}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <span>{linha.tipoMensalidade ?? 'sem plano associado'}</span>
        {linha.adquiridos != null && (
          <span>
            · {linha.realizados} de {linha.adquiridos} treinos
          </span>
        )}
      </div>
    </Link>
  )
}

export default function ListaPagamentos({
  slug,
  atrasados,
  emDia,
  segurosARenovar,
}: {
  slug: string
  atrasados: LinhaPagamentoAtraso[]
  emDia: LinhaPagamentoAtraso[]
  segurosARenovar: LinhaSeguro[]
}) {
  const [filtro, setFiltro] = useState('')
  const ordemAtrasados = useOrdem(CAMPOS_ATRASADO_EMDIA)
  const ordemSeguros = useOrdem(CAMPOS_SEGURO)
  const ordemEmDia = useOrdem(CAMPOS_ATRASADO_EMDIA)

  const { atrasadosFiltrados, emDiaFiltrados, segurosFiltrados } = useMemo(() => {
    const alvo = filtro ? normalizarTexto(filtro) : null
    const porNome = <T extends { nome: string }>(lista: T[]) =>
      alvo ? lista.filter((l) => normalizarTexto(l.nome).includes(alvo)) : lista

    return {
      atrasadosFiltrados: ordenarPor(porNome(atrasados), ordemAtrasados.campo, ordemAtrasados.direcao),
      emDiaFiltrados: ordenarPor(porNome(emDia), ordemEmDia.campo, ordemEmDia.direcao),
      segurosFiltrados: ordenarPor(porNome(segurosARenovar), ordemSeguros.campo, ordemSeguros.direcao),
    }
  }, [
    atrasados,
    emDia,
    segurosARenovar,
    filtro,
    ordemAtrasados.campo,
    ordemAtrasados.direcao,
    ordemSeguros.campo,
    ordemSeguros.direcao,
    ordemEmDia.campo,
    ordemEmDia.direcao,
  ])

  const semResultados =
    atrasadosFiltrados.length === 0 && emDiaFiltrados.length === 0 && segurosFiltrados.length === 0

  return (
    <>
      <input
        type="text"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Procurar por nome…"
        className="mt-6 w-full rounded-md border border-border-subtle px-3 py-2 text-sm outline-none focus:border-black/30 dark:bg-zinc-900"
      />

      {semResultados ? (
        <div className="mt-6 rounded-xl border border-dashed border-border-subtle p-8 text-center text-sm text-muted">
          {filtro ? 'Nenhum cliente com esse nome.' : 'Ainda não há clientes neste estúdio.'}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-red-600">
                Por regularizar ({atrasadosFiltrados.length})
              </h2>
              {atrasadosFiltrados.length > 1 && (
                <SeletorOrdem
                  campos={CAMPOS_ATRASADO_EMDIA}
                  campo={ordemAtrasados.campo}
                  direcao={ordemAtrasados.direcao}
                  onCampo={ordemAtrasados.mudarCampo}
                  onDirecao={ordemAtrasados.setDirecao}
                />
              )}
            </div>
            {atrasadosFiltrados.length > 0 ? (
              <div className="mt-2 flex flex-col overflow-hidden rounded-2xl border border-red-200 shadow-card dark:border-red-900">
                {atrasadosFiltrados.map((l, i) => (
                  <LinhaPagamento key={l.clienteId} slug={slug} linha={l} primeira={i === 0} />
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">Ninguém por regularizar.</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                Seguro a renovar ({segurosFiltrados.length})
              </h2>
              {segurosFiltrados.length > 1 && (
                <SeletorOrdem
                  campos={CAMPOS_SEGURO}
                  campo={ordemSeguros.campo}
                  direcao={ordemSeguros.direcao}
                  onCampo={ordemSeguros.mudarCampo}
                  onDirecao={ordemSeguros.setDirecao}
                />
              )}
            </div>
            {segurosFiltrados.length > 0 ? (
              <div className="mt-2 flex flex-col overflow-hidden rounded-2xl border border-amber-200 shadow-card dark:border-amber-900">
                {segurosFiltrados.map((l, i) => (
                  <Link
                    key={`seguro-${l.clienteId}`}
                    href={`/painel/${slug}/pagamentos/${l.clienteId}`}
                    className={`flex items-center justify-between gap-3 bg-amber-50 px-4 py-3.5 text-sm hover:bg-amber-100/70 dark:bg-amber-950/40 dark:hover:bg-amber-950/70 ${
                      i === 0 ? '' : 'border-t border-amber-200 dark:border-amber-900'
                    }`}
                  >
                    <span className="font-medium text-foreground">{l.nome}</span>
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                      {l.emDividaDesdeLabel}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">Nenhum seguro a renovar.</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                Em dia ({emDiaFiltrados.length})
              </h2>
              {emDiaFiltrados.length > 1 && (
                <SeletorOrdem
                  campos={CAMPOS_ATRASADO_EMDIA}
                  campo={ordemEmDia.campo}
                  direcao={ordemEmDia.direcao}
                  onCampo={ordemEmDia.mudarCampo}
                  onDirecao={ordemEmDia.setDirecao}
                />
              )}
            </div>
            {emDiaFiltrados.length > 0 ? (
              <div className="mt-2 flex flex-col overflow-hidden rounded-2xl border border-teal-200 shadow-card dark:border-teal-900">
                {emDiaFiltrados.map((l, i) => (
                  <LinhaPagamento key={l.clienteId} slug={slug} linha={l} primeira={i === 0} />
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">Ninguém em dia.</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
