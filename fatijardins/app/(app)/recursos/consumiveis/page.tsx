import { Suspense } from "react"
import Link from "next/link"
import { ArchiveIcon, ChevronRightIcon, PackageCheckIcon, PackageIcon, PlusIcon, SearchXIcon } from "lucide-react"

import { SeparadoresRecursos } from "@/app/(app)/recursos/_componentes/separadores"
import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { CampoPesquisa } from "@/components/campo-pesquisa"
import { EstadoVazio } from "@/components/estado-vazio"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { exigirPerfil, exigirSessao } from "@/lib/auth"
import { formatarMoeda } from "@/lib/formatar"
import { eGerente } from "@/lib/perfis"
import { eStockBaixo, formatarQuantidade } from "@/lib/recursos"
import { createClient } from "@/lib/supabase/server"
import { normalizarPesquisa } from "@/lib/texto"
import { cn } from "@/lib/utils"
import { EsqueletoListaConsumiveis } from "../_consumiveis/esqueletos"

export const metadata = { title: "Consumíveis" }

type ParametrosPesquisa = PageProps<"/recursos/consumiveis">["searchParams"]

function primeiroValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? ""
}

type Filtro = "ativos" | "stock-baixo" | "desativados"

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "ativos", rotulo: "Ativos" },
  { valor: "stock-baixo", rotulo: "Stock baixo" },
  { valor: "desativados", rotulo: "Desativados" },
]

/** Todas as palavras têm de aparecer no nome ou na categoria, sem contar acentos. */
function corresponde(consumivel: { nome: string; categoria: string | null }, pesquisa: string) {
  const texto = normalizarPesquisa([consumivel.nome, consumivel.categoria].filter(Boolean).join(" "))
  const palavras = normalizarPesquisa(pesquisa)
    .replace(/[^\p{L}\p{N}._-]+/gu, " ")
    .split(" ")
    .filter(Boolean)
  return palavras.every((palavra) => texto.includes(palavra))
}

function BotaoNovoConsumivel() {
  return (
    <Button asChild size="lg">
      <Link href="/recursos/consumiveis/novo">
        <PlusIcon />
        Novo consumível
      </Link>
    </Button>
  )
}

/** Só o gerente cria consumíveis. */
async function BotaoNovoConsumivelGerente() {
  const sessao = await exigirSessao()
  return eGerente(sessao.colaborador.perfil) ? <BotaoNovoConsumivel /> : null
}

export default function PaginaConsumiveis(props: PageProps<"/recursos/consumiveis">) {
  return (
    <>
      <SeparadoresRecursos />
      <CabecalhoPagina
        titulo="Consumíveis"
        acoes={
          <Suspense fallback={null}>
            <BotaoNovoConsumivelGerente />
          </Suspense>
        }
      />
      <div className="mb-4">
        <Suspense fallback={<Skeleton className="h-11 w-full md:h-10" />}>
          <CampoPesquisa placeholder="Nome ou categoria" />
        </Suspense>
      </div>
      <Suspense fallback={<EsqueletoListaConsumiveis />}>
        <ListaConsumiveis searchParams={props.searchParams} />
      </Suspense>
    </>
  )
}

async function ListaConsumiveis({ searchParams }: { searchParams: ParametrosPesquisa }) {
  const sessao = await exigirPerfil("gerente", "chefe_equipa")
  const gerente = eGerente(sessao.colaborador.perfil)
  const parametros = await searchParams
  const textoPesquisa = primeiroValor(parametros.q)
  const pesquisa = textoPesquisa.trim()
  const filtroPedido = primeiroValor(parametros.filtro)
  const filtro: Filtro = FILTROS.find((f) => f.valor === filtroPedido)?.valor ?? "ativos"

  // Os preços só o gerente os vê: ao chefe nem se pedem.
  const supabase = await createClient()
  const [consumiveisR, stockR, precosR] = await Promise.all([
    supabase.from("consumiveis").select("id, nome, categoria, unidade, stock_minimo, ativo"),
    supabase.rpc("stock_consumiveis"),
    gerente
      ? supabase.from("consumiveis_precos").select("consumivel_id, preco_unitario")
      : Promise.resolve({ data: [], error: null }),
  ])
  if (consumiveisR.error) throw new Error(`Erro ao carregar os consumíveis: ${consumiveisR.error.message}`)
  if (stockR.error) throw new Error(`Erro ao carregar o stock: ${stockR.error.message}`)
  if (precosR.error) throw new Error(`Erro ao carregar os preços: ${precosR.error.message}`)

  const stocks = new Map(stockR.data.map((linha) => [linha.consumivel_id, Number(linha.stock)]))
  const precos = new Map(precosR.data.map((linha) => [linha.consumivel_id, Number(linha.preco_unitario)]))
  const todos = consumiveisR.data
    .map((consumivel) => {
      const stock = stocks.get(consumivel.id) ?? 0
      const preco = precos.get(consumivel.id) ?? null
      return {
        ...consumivel,
        stock,
        preco,
        // Stock negativo (falta um acerto) não tem valor.
        valor: preco === null ? null : Math.max(0, stock) * preco,
        baixo: eStockBaixo(consumivel, stock),
      }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt"))
  const valorTotal = todos.reduce((soma, consumivel) => soma + (consumivel.valor ?? 0), 0)

  // Pesquisa aqui (e não na BD) para ignorar acentos, como nos clientes.
  const pesquisados = pesquisa ? todos.filter((consumivel) => corresponde(consumivel, pesquisa)) : todos
  const doFiltro: Record<Filtro, typeof todos> = {
    ativos: pesquisados.filter((consumivel) => consumivel.ativo),
    "stock-baixo": pesquisados.filter((consumivel) => consumivel.baixo),
    desativados: pesquisados.filter((consumivel) => !consumivel.ativo),
  }
  const consumiveis = doFiltro[filtro]

  // Filtros que mantêm a pesquisa ("Ativos" é o de omissão).
  function hrefFiltro(valor: Filtro) {
    const novos = new URLSearchParams()
    if (pesquisa) novos.set("q", textoPesquisa)
    if (valor !== "ativos") novos.set("filtro", valor)
    return novos.size ? `/recursos/consumiveis?${novos}` : "/recursos/consumiveis"
  }

  return (
    <>
      {gerente && (
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl border bg-card px-4 py-3 shadow-sm">
          <span className="text-sm text-muted-foreground">Valor total em stock</span>
          <span className="text-xl font-semibold tabular-nums">{formatarMoeda(valorTotal)}</span>
        </div>
      )}

      <nav aria-label="Filtrar consumíveis" className="mb-4">
        <ul className="flex flex-wrap gap-2">
          {FILTROS.map((opcao) => {
            const ativo = opcao.valor === filtro
            return (
              <li key={opcao.valor}>
                <Link
                  href={hrefFiltro(opcao.valor)}
                  replace
                  scroll={false}
                  aria-current={ativo ? "true" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                    ativo ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
                  )}
                >
                  {opcao.rotulo}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs tabular-nums",
                      ativo
                        ? "bg-primary-foreground/20"
                        : opcao.valor === "stock-baixo" && doFiltro[opcao.valor].length > 0
                          ? "bg-destructive text-white"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {doFiltro[opcao.valor].length}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <p className="mb-2 text-sm text-muted-foreground">
        {consumiveis.length === 1 ? "1 consumível" : `${consumiveis.length} consumíveis`}
      </p>

      {consumiveis.length === 0 ? (
        todos.length === 0 ? (
          <EstadoVazio
            icone={PackageIcon}
            titulo="Ainda não há consumíveis"
            descricao="Registe os artigos que a empresa compra e gasta nos trabalhos (adubos, fio, sacos, combustível…)."
            acao={gerente ? <BotaoNovoConsumivel /> : undefined}
          />
        ) : pesquisa ? (
          <EstadoVazio
            icone={SearchXIcon}
            titulo="Nenhum consumível encontrado"
            descricao="Experimente outra pesquisa ou outro filtro."
          />
        ) : filtro === "stock-baixo" ? (
          <EstadoVazio
            icone={PackageCheckIcon}
            titulo="Nenhum consumível com stock baixo"
            descricao="Todos os consumíveis ativos estão acima do stock mínimo."
          />
        ) : filtro === "desativados" ? (
          <EstadoVazio
            icone={ArchiveIcon}
            titulo="Não há consumíveis desativados"
            descricao="Os consumíveis que deixam de ser usados podem ser desativados na ficha de cada um."
          />
        ) : (
          <EstadoVazio
            icone={PackageIcon}
            titulo="Não há consumíveis ativos"
            descricao="Veja os desativados ou registe um consumível novo."
          />
        )
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          {/* Cabeçalho das colunas (só no PC). */}
          <div
            aria-hidden="true"
            className="hidden items-center gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground lg:flex"
          >
            <span className="flex-1">Consumível</span>
            <span className="w-36 text-right">Stock (mínimo)</span>
            {gerente && (
              <>
                <span className="w-28 text-right">Preço unitário</span>
                <span className="w-28 text-right">Valor em stock</span>
              </>
            )}
            <span className="w-4" />
          </div>
          <ul className="divide-y">
            {consumiveis.map((consumivel) => {
              const preco = consumivel.preco === null ? "Sem preço" : `${formatarMoeda(consumivel.preco)}/${consumivel.unidade}`
              const valor = consumivel.valor === null ? "—" : formatarMoeda(consumivel.valor)
              return (
                <li key={consumivel.id}>
                  <Link
                    href={`/recursos/consumiveis/${consumivel.id}`}
                    className="flex min-h-20 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50 active:bg-accent"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium break-words">{consumivel.nome}</span>
                        {consumivel.baixo && <Badge variant="destructive">Stock baixo</Badge>}
                        {!consumivel.ativo && <Badge variant="muted">Desativado</Badge>}
                      </span>
                      <span className="mt-0.5 block text-sm break-words text-muted-foreground">
                        {consumivel.categoria ?? "Sem categoria"}
                        {gerente && <span className="whitespace-nowrap tabular-nums lg:hidden"> · {preco}</span>}
                      </span>
                    </span>
                    <span className="shrink-0 text-right lg:w-36">
                      <span
                        className={cn(
                          "block font-semibold whitespace-nowrap tabular-nums",
                          (consumivel.baixo || consumivel.stock < 0) && "text-destructive"
                        )}
                      >
                        {formatarQuantidade(consumivel.stock, consumivel.unidade)}
                      </span>
                      <span className="block text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                        mín. {formatarQuantidade(consumivel.stock_minimo, consumivel.unidade)}
                      </span>
                      {gerente && (
                        <span className="block text-xs whitespace-nowrap text-muted-foreground tabular-nums lg:hidden">
                          Valor: {valor}
                        </span>
                      )}
                    </span>
                    {gerente && (
                      <>
                        <span className="hidden w-28 shrink-0 text-right text-sm whitespace-nowrap tabular-nums lg:block">
                          {preco}
                        </span>
                        <span className="hidden w-28 shrink-0 text-right font-medium whitespace-nowrap tabular-nums lg:block">
                          {valor}
                        </span>
                      </>
                    )}
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </>
  )
}
