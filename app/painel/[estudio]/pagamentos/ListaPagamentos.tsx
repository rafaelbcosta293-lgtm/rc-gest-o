'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowDown01,
  ArrowUp01,
  ChevronDown,
  ChevronRight,
  TriangleAlert,
  ShieldAlert,
  CircleCheck,
  Archive,
  type LucideIcon,
} from 'lucide-react'
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

export type LinhaInativo = {
  clienteId: string
  nome: string
  semPagarDesdeLabel: string
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

function porNomeSimples<T extends { nome: string }>(lista: T[], filtro: string | null): T[] {
  const alvo = filtro ? normalizarTexto(filtro) : null
  return alvo ? lista.filter((l) => normalizarTexto(l.nome).includes(alvo)) : lista
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

// Cartão do resumo no topo — números estáveis (nunca filtrados pela
// pesquisa), para dar sempre o retrato real do estúdio à primeira
// vista, antes de se procurar fosse o que fosse.
function CartaoResumo({
  icone: Icone,
  cor,
  label,
  valor,
}: {
  icone: LucideIcon
  cor: string
  label: string
  valor: number
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-border-subtle bg-surface p-3.5 shadow-card">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cor}`}>
        <Icone className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="font-mono text-xl font-bold leading-none text-foreground">{valor}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted">{label}</p>
      </div>
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

// Secção recolhida por omissão (Em dia / Inativos) — não é trabalho
// pendente, só referência, por isso não precisa de estar sempre à
// vista. Abre sozinha ao pesquisar por um nome, para a pesquisa
// encontrar sempre toda a gente, esteja onde estiver.
function SeccaoColapsavel({
  titulo,
  nota,
  total,
  aberta,
  onAbrirFechar,
  children,
}: {
  titulo: string
  nota: string
  total: number
  aberta: boolean
  onAbrirFechar: () => void
  children: ReactNode
}) {
  if (total === 0) return null
  return (
    <div className="mt-6 border-t border-border-subtle pt-4">
      <button
        type="button"
        onClick={onAbrirFechar}
        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted transition-colors hover:text-foreground"
      >
        {aberta ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {titulo} ({total}) — {nota}
      </button>
      {aberta && <div className="mt-3">{children}</div>}
    </div>
  )
}

export default function ListaPagamentos({
  slug,
  atrasados,
  emDia,
  segurosARenovar,
  inativos,
}: {
  slug: string
  atrasados: LinhaPagamentoAtraso[]
  emDia: LinhaPagamentoAtraso[]
  segurosARenovar: LinhaSeguro[]
  inativos: LinhaInativo[]
}) {
  const [filtro, setFiltro] = useState('')
  const ordemAtrasados = useOrdem(CAMPOS_ATRASADO_EMDIA)
  const ordemEmDia = useOrdem(CAMPOS_ATRASADO_EMDIA)
  const [mostrarEmDia, setMostrarEmDia] = useState(false)
  const [mostrarInativos, setMostrarInativos] = useState(false)

  const aPesquisar = filtro.trim().length > 0

  const { atrasadosFiltrados, emDiaFiltrados, segurosFiltrados, inativosFiltrados } = useMemo(() => {
    return {
      atrasadosFiltrados: ordenarPor(porNomeSimples(atrasados, filtro), ordemAtrasados.campo, ordemAtrasados.direcao),
      emDiaFiltrados: ordenarPor(porNomeSimples(emDia, filtro), ordemEmDia.campo, ordemEmDia.direcao),
      segurosFiltrados: [...porNomeSimples(segurosARenovar, filtro)].sort((a, b) =>
        a.dataReferencia.localeCompare(b.dataReferencia)
      ),
      inativosFiltrados: [...porNomeSimples(inativos, filtro)].sort((a, b) =>
        normalizarTexto(a.nome).localeCompare(normalizarTexto(b.nome))
      ),
    }
  }, [
    atrasados,
    emDia,
    segurosARenovar,
    inativos,
    filtro,
    ordemAtrasados.campo,
    ordemAtrasados.direcao,
    ordemEmDia.campo,
    ordemEmDia.direcao,
  ])

  const semResultados =
    atrasadosFiltrados.length === 0 &&
    emDiaFiltrados.length === 0 &&
    segurosFiltrados.length === 0 &&
    inativosFiltrados.length === 0

  return (
    <>
      {/* Resumo — o retrato do estúdio à primeira vista, antes de ler
          seja o que for em baixo. */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CartaoResumo
          icone={TriangleAlert}
          cor="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
          label="Por regularizar"
          valor={atrasados.length}
        />
        <CartaoResumo
          icone={ShieldAlert}
          cor="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          label="Seguro a renovar"
          valor={segurosARenovar.length}
        />
        <CartaoResumo
          icone={CircleCheck}
          cor="bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
          label="Em dia"
          valor={emDia.length}
        />
        <CartaoResumo
          icone={Archive}
          cor="bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          label="Inativos"
          valor={inativos.length}
        />
      </div>

      <input
        type="text"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Procurar por nome…"
        className="mt-4 w-full rounded-md border border-border-subtle px-3 py-2 text-sm outline-none focus:border-black/30 dark:bg-zinc-900"
      />

      {semResultados ? (
        <div className="mt-6 rounded-xl border border-dashed border-border-subtle p-8 text-center text-sm text-muted">
          {aPesquisar ? 'Nenhum cliente com esse nome.' : 'Ainda não há clientes neste estúdio.'}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Por regularizar — o que precisa mesmo de ação, por isso
              ocupa mais espaço do que tudo o resto. */}
          <div className="lg:col-span-2">
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

          {/* Seguro a renovar — aviso secundário, por isso fica mais
              compacto: sem controlo de ordenação próprio (ordenado
              sempre do mais urgente para o menos urgente) e com menos
              espaço por linha. */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-600">
              Seguro a renovar ({segurosFiltrados.length})
            </h2>
            {segurosFiltrados.length > 0 ? (
              <div className="mt-2 flex flex-col overflow-hidden rounded-xl border border-amber-200 dark:border-amber-900">
                {segurosFiltrados.map((l, i) => (
                  <Link
                    key={`seguro-${l.clienteId}`}
                    href={`/painel/${slug}/pagamentos/${l.clienteId}`}
                    className={`flex items-center justify-between gap-2 bg-amber-50 px-3 py-2 text-xs hover:bg-amber-100/70 dark:bg-amber-950/40 dark:hover:bg-amber-950/70 ${
                      i === 0 ? '' : 'border-t border-amber-200 dark:border-amber-900'
                    }`}
                  >
                    <span className="font-medium text-foreground">{l.nome}</span>
                    <span className="shrink-0 text-amber-700 dark:text-amber-300">{l.emDividaDesdeLabel}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">Nenhum seguro a renovar.</p>
            )}
          </div>
        </div>
      )}

      {/* Em dia / Inativos — não são trabalho pendente, só referência,
          por isso ficam recolhidos por omissão (abrem sozinhos ao
          pesquisar por um nome). */}
      <SeccaoColapsavel
        titulo="Em dia"
        nota="já não precisam de ação"
        total={emDiaFiltrados.length}
        aberta={mostrarEmDia || aPesquisar}
        onAbrirFechar={() => setMostrarEmDia((v) => !v)}
      >
        <div className="flex flex-col overflow-hidden rounded-2xl border border-teal-200 shadow-card dark:border-teal-900">
          {emDiaFiltrados.map((l, i) => (
            <LinhaPagamento key={l.clienteId} slug={slug} linha={l} primeira={i === 0} />
          ))}
        </div>
      </SeccaoColapsavel>

      <SeccaoColapsavel
        titulo="Inativos"
        nota="não contam para os pendentes nem para os seguros"
        total={inativosFiltrados.length}
        aberta={mostrarInativos || aPesquisar}
        onAbrirFechar={() => setMostrarInativos((v) => !v)}
      >
        <div className="flex max-h-80 flex-col overflow-y-auto overflow-x-hidden rounded-2xl border border-border-subtle">
          {inativosFiltrados.map((l, i) => (
            <Link
              key={l.clienteId}
              href={`/painel/${slug}/pagamentos/${l.clienteId}`}
              className={`flex items-center justify-between gap-3 bg-surface px-4 py-3 text-sm text-muted hover:bg-brand/[.06] ${
                i === 0 ? '' : 'border-t border-border-subtle'
              }`}
            >
              <span className="font-medium text-foreground">{l.nome}</span>
              <span className="text-xs">{l.semPagarDesdeLabel}</span>
            </Link>
          ))}
        </div>
      </SeccaoColapsavel>
    </>
  )
}
