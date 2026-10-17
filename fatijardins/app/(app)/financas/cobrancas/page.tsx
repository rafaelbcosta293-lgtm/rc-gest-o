import { Suspense } from "react"
import Link from "next/link"
import { ChevronRightIcon, PlusIcon, ReceiptIcon, SearchXIcon } from "lucide-react"

import { SeparadoresFinancas } from "@/app/(app)/financas/_componentes/separadores"
import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { CampoPesquisa } from "@/components/campo-pesquisa"
import { EstadoVazio } from "@/components/estado-vazio"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { exigirPerfil } from "@/lib/auth"
import { NOMES_ORIGEM_COBRANCA } from "@/lib/financas"
import { formatarData, formatarMoeda } from "@/lib/formatar"
import { createClient } from "@/lib/supabase/server"
import { normalizarPesquisa } from "@/lib/texto"
import { cn } from "@/lib/utils"
import { BadgeEstadoCobranca } from "../_cobrancas/badges"
import { carregarCobrancas, ordenarCobrancas, somar, type CobrancaSaldo } from "../_cobrancas/dados"
import { EsqueletoListaCobrancas } from "../_cobrancas/esqueletos"

export const metadata = { title: "Cobranças" }

type ParametrosPesquisa = PageProps<"/financas/cobrancas">["searchParams"]

const FILTROS = ["abertas", "atrasadas", "pagas", "todas"] as const
type Filtro = (typeof FILTROS)[number]

const NOMES_FILTRO: Record<Filtro, string> = {
  abertas: "Em aberto",
  atrasadas: "Em atraso",
  pagas: "Pagas",
  todas: "Todas",
}

const CRITERIO: Record<Filtro, (cobranca: CobrancaSaldo) => boolean> = {
  abertas: (cobranca) => cobranca.estado !== "paga",
  atrasadas: (cobranca) => cobranca.estado === "atrasada",
  pagas: (cobranca) => cobranca.estado === "paga",
  todas: () => true,
}

function primeiroValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? ""
}

/** Todas as palavras têm de aparecer no cliente, na descrição ou no n.º da fatura (sem contar acentos). */
function corresponde(cobranca: CobrancaSaldo, palavras: string[]) {
  const texto = normalizarPesquisa([cobranca.cliente, cobranca.descricao, cobranca.faturaReferencia].filter(Boolean).join(" "))
  return palavras.every((palavra) => texto.includes(palavra))
}

function BotaoNovaCobranca() {
  return (
    <Button asChild size="lg">
      <Link href="/financas/cobrancas/nova">
        <PlusIcon />
        Nova cobrança
      </Link>
    </Button>
  )
}

export default function PaginaCobrancas(props: PageProps<"/financas/cobrancas">) {
  return (
    <>
      <SeparadoresFinancas />
      <CabecalhoPagina titulo="Cobranças" acoes={<BotaoNovaCobranca />} />
      <Suspense fallback={<EsqueletoListaCobrancas />}>
        <ListaCobrancas searchParams={props.searchParams} />
      </Suspense>
    </>
  )
}

async function ListaCobrancas({ searchParams }: { searchParams: ParametrosPesquisa }) {
  await exigirPerfil("gerente")
  const parametros = await searchParams
  const textoPesquisa = primeiroValor(parametros.q)
  const pesquisa = textoPesquisa.trim()
  const filtroPedido = primeiroValor(parametros.filtro)
  const filtro: Filtro = FILTROS.find((f) => f === filtroPedido) ?? "abertas"

  const supabase = await createClient()
  const todas = await carregarCobrancas(supabase)

  // Pesquisa aqui (e não na BD) para ignorar acentos, como nos clientes.
  const palavras = normalizarPesquisa(pesquisa)
    .replace(/[^\p{L}\p{N}@._/-]+/gu, " ")
    .split(" ")
    .filter(Boolean)
  const pesquisadas = palavras.length ? todas.filter((cobranca) => corresponde(cobranca, palavras)) : todas
  const cobrancas = ordenarCobrancas(pesquisadas.filter(CRITERIO[filtro]))
  // As pagas mais recentes primeiro.
  if (filtro === "pagas") cobrancas.reverse()

  const emDivida = somar(pesquisadas.map((cobranca) => cobranca.emDivida))
  const atrasadas = pesquisadas.filter(CRITERIO.atrasadas)
  const emAtraso = somar(atrasadas.map((cobranca) => cobranca.emDivida))

  // Filtros que mantêm a pesquisa.
  function hrefFiltro(valor: Filtro) {
    const novos = new URLSearchParams()
    if (pesquisa) novos.set("q", textoPesquisa)
    if (valor !== "abertas") novos.set("filtro", valor)
    return novos.size ? `/financas/cobrancas?${novos}` : "/financas/cobrancas"
  }
  const filtros = FILTROS.map((valor) => {
    const doFiltro = pesquisadas.filter(CRITERIO[valor])
    return {
      valor,
      total: doFiltro.length,
      divida: valor === "pagas" ? 0 : somar(doFiltro.map((cobranca) => cobranca.emDivida)),
    }
  })

  return (
    <>
      <dl className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <dt className="text-sm text-muted-foreground">Total em dívida</dt>
          <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{formatarMoeda(emDivida)}</dd>
        </div>
        <div
          className={cn(
            "rounded-xl border bg-card p-4 shadow-sm",
            emAtraso > 0 && "border-destructive/40 bg-destructive/5"
          )}
        >
          <dt className="text-sm text-muted-foreground">Em atraso</dt>
          <dd
            className={cn(
              "mt-1 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl",
              emAtraso > 0 && "text-destructive"
            )}
          >
            {formatarMoeda(emAtraso)}
          </dd>
          {atrasadas.length > 0 && (
            <dd className="text-xs text-muted-foreground">
              {atrasadas.length === 1 ? "1 cobrança" : `${atrasadas.length} cobranças`}
            </dd>
          )}
        </div>
      </dl>

      <div className="mb-4">
        <Suspense fallback={<Skeleton className="h-11 w-full md:h-10" />}>
          <CampoPesquisa placeholder="Cliente, descrição ou n.º da fatura" />
        </Suspense>
      </div>

      <nav aria-label="Filtrar cobranças" className="mb-4">
        <ul className="flex flex-wrap gap-2">
          {filtros.map((f) => {
            const ativo = f.valor === filtro
            return (
              <li key={f.valor}>
                <Link
                  href={hrefFiltro(f.valor)}
                  replace
                  scroll={false}
                  aria-current={ativo ? "true" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                    ativo ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
                  )}
                >
                  {NOMES_FILTRO[f.valor]}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs tabular-nums",
                      ativo ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {f.total}
                  </span>
                  {f.divida > 0 && (
                    <span className={cn("text-xs tabular-nums", !ativo && "text-muted-foreground")}>
                      {formatarMoeda(f.divida)}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <p className="mb-2 text-sm text-muted-foreground">
        {cobrancas.length === 1 ? "1 cobrança" : `${cobrancas.length} cobranças`}
      </p>

      {cobrancas.length === 0 ? (
        pesquisa || todas.length > 0 ? (
          <EstadoVazio
            icone={SearchXIcon}
            titulo={pesquisa ? "Nenhuma cobrança encontrada" : `Sem cobranças: ${NOMES_FILTRO[filtro].toLowerCase()}`}
            descricao={
              pesquisa
                ? "Experimente pesquisar pelo cliente, pelo n.º da fatura ou por outra palavra."
                : filtro === "todas"
                  ? undefined
                  : "Veja as cobranças de outro filtro."
            }
          />
        ) : (
          <EstadoVazio
            icone={ReceiptIcon}
            titulo="Ainda não há cobranças"
            descricao="As avenças dos contratos criam a cobrança de cada mês. Registe aqui os outros valores a receber."
            acao={<BotaoNovaCobranca />}
          />
        )
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {cobrancas.map((cobranca) => (
            <li key={cobranca.id}>
              <LinhaCobranca cobranca={cobranca} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function LinhaCobranca({ cobranca }: { cobranca: CobrancaSaldo }) {
  const paga = cobranca.estado === "paga"
  return (
    <Link
      href={`/financas/cobrancas/${cobranca.id}`}
      className="flex min-h-20 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50 active:bg-accent"
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <BadgeEstadoCobranca estado={cobranca.estado} diasAtraso={cobranca.diasAtraso} />
          <span className="text-xs text-muted-foreground">{NOMES_ORIGEM_COBRANCA[cobranca.origem]}</span>
        </span>
        <span className="mt-1 block font-medium break-words">{cobranca.cliente}</span>
        <span className="mt-0.5 block text-sm break-words">{cobranca.descricao}</span>
        <span className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
          <span className="tabular-nums">Vence {formatarData(cobranca.dataVencimento)}</span>
          {cobranca.faturaReferencia ? (
            <span className="break-all">{cobranca.faturaReferencia}</span>
          ) : (
            <span className="text-xs italic opacity-70">Sem fatura</span>
          )}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span
          className={cn(
            "block font-semibold tabular-nums",
            paga ? "text-muted-foreground" : cobranca.estado === "atrasada" && "text-destructive"
          )}
        >
          {formatarMoeda(paga ? cobranca.valor : cobranca.emDivida)}
        </span>
        <span className="block text-xs text-muted-foreground tabular-nums">
          {paga
            ? "pago"
            : cobranca.emDivida !== cobranca.valor
              ? `em dívida de ${formatarMoeda(cobranca.valor)}`
              : "em dívida"}
        </span>
      </span>
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
