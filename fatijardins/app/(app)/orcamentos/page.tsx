import { Suspense } from "react"
import Link from "next/link"
import { ChevronRightIcon, FileTextIcon, PlusIcon, SearchXIcon } from "lucide-react"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { CampoPesquisa } from "@/components/campo-pesquisa"
import { EstadoVazio } from "@/components/estado-vazio"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { exigirPerfil } from "@/lib/auth"
import { formatarData, formatarMoeda, hojeEmLisboa } from "@/lib/formatar"
import {
  ESTADOS_ORCAMENTO,
  estaExpirado,
  formatarNumeroOrcamento,
  NOMES_ESTADO_ORCAMENTO,
  type EstadoOrcamento,
} from "@/lib/orcamentos"
import { createClient } from "@/lib/supabase/server"
import { normalizarPesquisa } from "@/lib/texto"
import { cn } from "@/lib/utils"
import { BadgeEstadoOrcamento, BadgeExpirado } from "./_componentes/badges"
import { EsqueletoListaOrcamentos } from "./_componentes/esqueletos"
import { SeparadoresOrcamentos } from "./_componentes/separadores"

export const metadata = { title: "Orçamentos" }

type ParametrosPesquisa = PageProps<"/orcamentos">["searchParams"]

function primeiroValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? ""
}

type OrcamentoPesquisavel = {
  ano: number
  numero: number
  titulo: string
  cliente: { nome: string } | null
  local: { nome: string } | null
}

/**
 * Número: "2026/0002" (ano e número), "2" ou "0002" (o número em qualquer
 * ano) ou "2026" (também os desse ano). Texto: todas as palavras têm de
 * aparecer no cliente, no local ou no título, sem contar acentos.
 */
function corresponde(orcamento: OrcamentoPesquisavel, pesquisa: string) {
  const numero = /^(?:(\d{4})\s*\/\s*)?(\d{1,6})$/.exec(pesquisa)
  if (numero) {
    const [, ano, n] = numero
    if (ano) return Number(ano) === orcamento.ano && Number(n) === orcamento.numero
    return Number(n) === orcamento.numero || (n.length === 4 && Number(n) === orcamento.ano)
  }
  const texto = normalizarPesquisa(
    [orcamento.cliente?.nome, orcamento.local?.nome, orcamento.titulo].filter(Boolean).join(" ")
  )
  const palavras = normalizarPesquisa(pesquisa)
    .replace(/[^\p{L}\p{N}@._-]+/gu, " ")
    .split(" ")
    .filter(Boolean)
  return palavras.every((palavra) => texto.includes(palavra))
}

function BotaoNovoOrcamento() {
  return (
    <Button asChild size="lg">
      <Link href="/orcamentos/novo">
        <PlusIcon />
        Novo orçamento
      </Link>
    </Button>
  )
}

export default function PaginaOrcamentos(props: PageProps<"/orcamentos">) {
  return (
    <>
      <SeparadoresOrcamentos />
      <CabecalhoPagina titulo="Orçamentos" acoes={<BotaoNovoOrcamento />} />
      <div className="mb-4">
        <Suspense fallback={<Skeleton className="h-11 w-full md:h-10" />}>
          <CampoPesquisa placeholder="Número, cliente, local ou título" />
        </Suspense>
      </div>
      <Suspense fallback={<EsqueletoListaOrcamentos />}>
        <ListaOrcamentos searchParams={props.searchParams} />
      </Suspense>
    </>
  )
}

async function ListaOrcamentos({ searchParams }: { searchParams: ParametrosPesquisa }) {
  await exigirPerfil("gerente", "chefe_equipa")
  const parametros = await searchParams
  const textoPesquisa = primeiroValor(parametros.q)
  const pesquisa = textoPesquisa.trim()
  const estadoPedido = primeiroValor(parametros.estado)
  const estado = ESTADOS_ORCAMENTO.find((e) => e === estadoPedido) ?? null

  const supabase = await createClient()
  const { data: todos, error } = await supabase
    .from("orcamentos")
    .select("id, ano, numero, titulo, data, validade, estado, total, cliente:clientes(nome), local:locais(nome)")
    .order("data", { ascending: false })
    .order("ano", { ascending: false })
    .order("numero", { ascending: false })
  if (error) throw new Error(`Erro ao carregar os orçamentos: ${error.message}`)

  // Pesquisa aqui (e não na BD) para ignorar acentos, como nos clientes.
  // Funciona até 1000 orçamentos (limite por omissão da API do Supabase).
  const pesquisados = pesquisa ? todos.filter((orcamento) => corresponde(orcamento, pesquisa)) : todos
  const contagem = new Map<EstadoOrcamento, number>()
  for (const orcamento of pesquisados) contagem.set(orcamento.estado, (contagem.get(orcamento.estado) ?? 0) + 1)
  const orcamentos = estado ? pesquisados.filter((orcamento) => orcamento.estado === estado) : pesquisados
  const hoje = hojeEmLisboa()

  // Filtros por estado que mantêm a pesquisa.
  function hrefFiltro(valor: EstadoOrcamento | null) {
    const novos = new URLSearchParams()
    if (pesquisa) novos.set("q", textoPesquisa)
    if (valor) novos.set("estado", valor)
    return novos.size ? `/orcamentos?${novos}` : "/orcamentos"
  }
  const filtros: { valor: EstadoOrcamento | null; rotulo: string; total: number }[] = [
    { valor: null, rotulo: "Todos", total: pesquisados.length },
    ...ESTADOS_ORCAMENTO.map((e) => ({ valor: e, rotulo: NOMES_ESTADO_ORCAMENTO[e], total: contagem.get(e) ?? 0 })),
  ]

  return (
    <>
      <nav aria-label="Filtrar por estado" className="mb-4">
        <ul className="flex flex-wrap gap-2">
          {filtros.map((filtro) => {
            const ativo = filtro.valor === estado
            return (
              <li key={filtro.rotulo}>
                <Link
                  href={hrefFiltro(filtro.valor)}
                  replace
                  scroll={false}
                  aria-current={ativo ? "true" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                    ativo ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
                  )}
                >
                  {filtro.rotulo}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs tabular-nums",
                      ativo ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {filtro.total}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <p className="mb-2 text-sm text-muted-foreground">
        {orcamentos.length === 1 ? "1 orçamento" : `${orcamentos.length} orçamentos`}
      </p>

      {orcamentos.length === 0 ? (
        pesquisa || estado ? (
          <EstadoVazio
            icone={SearchXIcon}
            titulo="Nenhum orçamento encontrado"
            descricao={
              estado
                ? "Experimente outra pesquisa ou veja os orçamentos de todos os estados."
                : "Experimente pesquisar pelo número, pelo cliente ou por outra palavra."
            }
          />
        ) : (
          <EstadoVazio
            icone={FileTextIcon}
            titulo="Ainda não há orçamentos"
            descricao="Faça o orçamento a partir de uma visita ou diretamente para um cliente."
            acao={<BotaoNovoOrcamento />}
          />
        )
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {orcamentos.map((orcamento) => (
            <li key={orcamento.id}>
              <Link
                href={`/orcamentos/${orcamento.id}`}
                className="flex min-h-20 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50 active:bg-accent"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-medium text-muted-foreground tabular-nums">
                      {formatarNumeroOrcamento(orcamento.ano, orcamento.numero)}
                    </span>
                    <BadgeEstadoOrcamento estado={orcamento.estado} />
                    {estaExpirado(orcamento, hoje) && <BadgeExpirado />}
                  </span>
                  <span className="mt-1 block font-medium break-words">{orcamento.titulo}</span>
                  <span className="mt-0.5 block text-sm break-words text-muted-foreground">
                    {[orcamento.cliente?.nome, orcamento.local?.nome].filter(Boolean).join(" — ")}
                    <span className="whitespace-nowrap tabular-nums"> · {formatarData(orcamento.data)}</span>
                  </span>
                </span>
                <span className="shrink-0 text-right font-semibold tabular-nums">{formatarMoeda(orcamento.total)}</span>
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
