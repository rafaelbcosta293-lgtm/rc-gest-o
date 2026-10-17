import { Suspense } from "react"
import Link from "next/link"
import { ChevronRightIcon, FileSignatureIcon, PlusIcon, SearchXIcon } from "lucide-react"

import { SeparadoresFinancas } from "@/app/(app)/financas/_componentes/separadores"
import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { CampoPesquisa } from "@/components/campo-pesquisa"
import { EstadoVazio } from "@/components/estado-vazio"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { exigirPerfil } from "@/lib/auth"
import {
  ESTADOS_CONTRATO,
  NOMES_ESTADO_CONTRATO,
  NOMES_FREQUENCIA_CONTRATO,
  valorMensalComIva,
  VARIANTE_ESTADO_CONTRATO,
  type EstadoContrato,
} from "@/lib/financas"
import { formatarData, formatarMoeda, hojeEmLisboa } from "@/lib/formatar"
import { createClient } from "@/lib/supabase/server"
import { normalizarPesquisa } from "@/lib/texto"
import { cn } from "@/lib/utils"
import { BotaoGerarContratos } from "../_contratos/botao-gerar"
import { EsqueletoListaContratos } from "../_contratos/esqueletos"

export const metadata = { title: "Contratos" }

type ParametrosPesquisa = PageProps<"/financas/contratos">["searchParams"]

/** Filtro por estado (?estado=); sem ele, só os ativos. */
type Filtro = EstadoContrato | "todos"

const ROTULOS_FILTRO: Record<EstadoContrato, string> = {
  ativo: "Ativos",
  suspenso: "Suspensos",
  terminado: "Terminados",
}

function primeiroValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? ""
}

/** Todas as palavras têm de aparecer no cliente, no local ou no título (sem contar acentos). */
function corresponde(
  contrato: { titulo: string; cliente: { nome: string } | null; local: { nome: string } | null },
  pesquisa: string
) {
  const texto = normalizarPesquisa(
    [contrato.cliente?.nome, contrato.local?.nome, contrato.titulo].filter(Boolean).join(" ")
  )
  const palavras = normalizarPesquisa(pesquisa)
    .replace(/[^\p{L}\p{N}@._-]+/gu, " ")
    .split(" ")
    .filter(Boolean)
  return palavras.every((palavra) => texto.includes(palavra))
}

function BotaoNovoContrato() {
  return (
    <Button asChild size="lg">
      <Link href="/financas/contratos/novo">
        <PlusIcon />
        Novo contrato
      </Link>
    </Button>
  )
}

export default function PaginaContratos(props: PageProps<"/financas/contratos">) {
  return (
    <>
      <SeparadoresFinancas />
      <CabecalhoPagina
        titulo="Contratos"
        descricao="Avenças de manutenção: geram as visitas na agenda e a cobrança de cada mês."
        acoes={
          <>
            <BotaoGerarContratos />
            <BotaoNovoContrato />
          </>
        }
      />
      <div className="mb-4">
        <Suspense fallback={<Skeleton className="h-11 w-full md:h-10" />}>
          <CampoPesquisa placeholder="Cliente, local ou título" />
        </Suspense>
      </div>
      <Suspense fallback={<EsqueletoListaContratos />}>
        <ListaContratos searchParams={props.searchParams} />
      </Suspense>
    </>
  )
}

async function ListaContratos({ searchParams }: { searchParams: ParametrosPesquisa }) {
  await exigirPerfil("gerente")
  const parametros = await searchParams
  const textoPesquisa = primeiroValor(parametros.q)
  const pesquisa = textoPesquisa.trim()
  const filtroPedido = primeiroValor(parametros.estado)
  const filtro: Filtro =
    filtroPedido === "todos" ? "todos" : (ESTADOS_CONTRATO.find((e) => e === filtroPedido) ?? "ativo")

  const supabase = await createClient()
  const hoje = hojeEmLisboa()
  const [contratosR, visitasR] = await Promise.all([
    supabase
      .from("contratos")
      .select(
        `id, titulo, frequencia, estado, valor_mensal, taxa_iva, data_fim,
         cliente:clientes(nome), local:locais(nome), equipa:equipas(nome, cor)`
      )
      .order("titulo"),
    // Próximas visitas geradas (a primeira de cada contrato é a "próxima visita").
    supabase
      .from("trabalhos")
      .select("contrato_id, data")
      .not("contrato_id", "is", null)
      .gte("data", hoje)
      .in("estado", ["agendado", "em_curso"])
      .order("data"),
  ])
  if (contratosR.error) throw new Error(`Erro ao carregar os contratos: ${contratosR.error.message}`)
  if (visitasR.error) throw new Error(`Erro ao carregar as visitas: ${visitasR.error.message}`)

  const proximaVisita = new Map<string, string>()
  for (const visita of visitasR.data) {
    if (visita.contrato_id && !proximaVisita.has(visita.contrato_id)) proximaVisita.set(visita.contrato_id, visita.data)
  }

  // Por cliente, para os contratos do mesmo cliente ficarem juntos.
  const todos = [...contratosR.data].sort(
    (a, b) =>
      (a.cliente?.nome ?? "").localeCompare(b.cliente?.nome ?? "", "pt") || a.titulo.localeCompare(b.titulo, "pt")
  )
  const ativos = todos.filter((contrato) => contrato.estado === "ativo")
  const totalMensal = ativos.reduce(
    (total, contrato) => total + valorMensalComIva(Number(contrato.valor_mensal), Number(contrato.taxa_iva)),
    0
  )

  // Pesquisa aqui (e não na BD) para ignorar acentos, como nos clientes.
  const pesquisados = pesquisa ? todos.filter((contrato) => corresponde(contrato, pesquisa)) : todos
  const contagem = new Map<EstadoContrato, number>()
  for (const contrato of pesquisados) contagem.set(contrato.estado, (contagem.get(contrato.estado) ?? 0) + 1)
  const contratos = filtro === "todos" ? pesquisados : pesquisados.filter((contrato) => contrato.estado === filtro)

  // Filtros que mantêm a pesquisa (os ativos são o filtro por omissão).
  function hrefFiltro(valor: Filtro) {
    const novos = new URLSearchParams()
    if (pesquisa) novos.set("q", textoPesquisa)
    if (valor !== "ativo") novos.set("estado", valor)
    return novos.size ? `/financas/contratos?${novos}` : "/financas/contratos"
  }
  const filtros: { valor: Filtro; rotulo: string; total: number }[] = [
    ...ESTADOS_CONTRATO.map((e) => ({ valor: e, rotulo: ROTULOS_FILTRO[e], total: contagem.get(e) ?? 0 })),
    { valor: "todos", rotulo: "Todos", total: pesquisados.length },
  ]

  return (
    <>
      <div className="mb-4 rounded-xl border bg-card p-4 shadow-sm sm:w-fit sm:min-w-72">
        <p className="text-sm text-muted-foreground">Avenças ativas, por mês com IVA</p>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{formatarMoeda(totalMensal)}</p>
        <p className="text-sm text-muted-foreground">
          {ativos.length === 1 ? "1 contrato ativo" : `${ativos.length} contratos ativos`}
        </p>
      </div>

      <nav aria-label="Filtrar por estado" className="mb-4">
        <ul className="flex flex-wrap gap-2">
          {filtros.map((item) => {
            const ativo = item.valor === filtro
            return (
              <li key={item.valor}>
                <Link
                  href={hrefFiltro(item.valor)}
                  replace
                  scroll={false}
                  aria-current={ativo ? "true" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                    ativo ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
                  )}
                >
                  {item.rotulo}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs tabular-nums",
                      ativo ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {item.total}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <p className="mb-2 text-sm text-muted-foreground">
        {contratos.length === 1 ? "1 contrato" : `${contratos.length} contratos`}
      </p>

      {contratos.length === 0 ? (
        todos.length > 0 ? (
          <EstadoVazio
            icone={SearchXIcon}
            titulo="Nenhum contrato encontrado"
            descricao={
              pesquisa
                ? "Experimente pesquisar pelo cliente, pelo local ou por outra palavra."
                : "Não há contratos neste estado. Veja os outros filtros."
            }
          />
        ) : (
          <EstadoVazio
            icone={FileSignatureIcon}
            titulo="Ainda não há contratos"
            descricao="Registe as avenças de manutenção: as visitas aparecem na agenda e as cobranças são criadas todos os meses."
            acao={<BotaoNovoContrato />}
          />
        )
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {contratos.map((contrato) => {
            const proxima = proximaVisita.get(contrato.id)
            return (
              <li key={contrato.id}>
                <Link
                  href={`/financas/contratos/${contrato.id}`}
                  className="flex min-h-20 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50 active:bg-accent"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium break-words">{contrato.titulo}</span>
                      <Badge variant={VARIANTE_ESTADO_CONTRATO[contrato.estado]}>
                        {NOMES_ESTADO_CONTRATO[contrato.estado]}
                      </Badge>
                    </span>
                    <span className="mt-0.5 block text-sm break-words text-muted-foreground">
                      {[contrato.cliente?.nome, contrato.local?.nome].filter(Boolean).join(" — ")}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                      <span>{NOMES_FREQUENCIA_CONTRATO[contrato.frequencia]}</span>
                      <span className="flex items-center gap-1.5">
                        {contrato.equipa ? (
                          <>
                            <span
                              aria-hidden="true"
                              className="inline-block size-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                              style={{ backgroundColor: contrato.equipa.cor }}
                            />
                            {contrato.equipa.nome}
                          </>
                        ) : (
                          "Equipa por atribuir"
                        )}
                      </span>
                      {contrato.estado === "ativo" && (
                        <span className="tabular-nums">
                          {proxima ? `Próxima visita: ${formatarData(proxima)}` : "Sem visitas agendadas"}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold whitespace-nowrap tabular-nums">
                      {formatarMoeda(valorMensalComIva(Number(contrato.valor_mensal), Number(contrato.taxa_iva)))}
                    </span>
                    <span className="block text-xs text-muted-foreground">/mês c/ IVA</span>
                  </span>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
