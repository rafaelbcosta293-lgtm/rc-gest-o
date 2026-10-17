import { Suspense } from "react"
import Link from "next/link"
import { BanknoteIcon, ChevronLeftIcon, ChevronRightIcon, SearchXIcon } from "lucide-react"

import { SeparadoresFinancas } from "@/app/(app)/financas/_componentes/separadores"
import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { CampoPesquisa } from "@/components/campo-pesquisa"
import { EstadoVazio } from "@/components/estado-vazio"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { exigirPerfil } from "@/lib/auth"
import { formatarMes, NOMES_METODO_PAGAMENTO } from "@/lib/financas"
import { formatarData, formatarMoeda, hojeEmLisboa } from "@/lib/formatar"
import { createClient } from "@/lib/supabase/server"
import { normalizarPesquisa } from "@/lib/texto"
import { somar } from "../_cobrancas/dados"
import { EsqueletoListaCobrancas } from "../_cobrancas/esqueletos"

export const metadata = { title: "Pagamentos" }

type ParametrosPesquisa = PageProps<"/financas/pagamentos">["searchParams"]

function primeiroValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? ""
}

/** "2026-10" → primeiro dia do mês ("2026-10-01"); inválido → null. */
function lerMes(valor: string): string | null {
  const partes = /^(\d{4})-(\d{2})$/.exec(valor)
  if (!partes) return null
  const ano = Number(partes[1])
  const mes = Number(partes[2])
  if (ano < 2000 || ano > 2100 || mes < 1 || mes > 12) return null
  return `${partes[1]}-${partes[2]}-01`
}

/** Primeiro dia do mês seguinte (ou anterior) a "aaaa-mm-01". */
function somarMeses(mes: string, n: number): string {
  const [ano, m] = mes.split("-").map(Number)
  const data = new Date(Date.UTC(ano, m - 1 + n, 1))
  return data.toISOString().slice(0, 10)
}

export default function PaginaPagamentos(props: PageProps<"/financas/pagamentos">) {
  return (
    <>
      <SeparadoresFinancas />
      <CabecalhoPagina titulo="Pagamentos" descricao="Pagamentos recebidos dos clientes, mês a mês." />
      <div className="mb-4">
        <Suspense fallback={<Skeleton className="h-11 w-full md:h-10" />}>
          <CampoPesquisa placeholder="Cliente ou referência" />
        </Suspense>
      </div>
      <Suspense fallback={<EsqueletoListaCobrancas />}>
        <ListaPagamentos searchParams={props.searchParams} />
      </Suspense>
    </>
  )
}

async function ListaPagamentos({ searchParams }: { searchParams: ParametrosPesquisa }) {
  await exigirPerfil("gerente")
  const parametros = await searchParams
  const textoPesquisa = primeiroValor(parametros.q)
  const pesquisa = textoPesquisa.trim()
  const mesAtual = `${hojeEmLisboa().slice(0, 7)}-01`
  const mes = lerMes(primeiroValor(parametros.mes)) ?? mesAtual
  const seguinte = somarMeses(mes, 1)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("pagamentos")
    .select("id, data, valor, metodo, referencia, cobranca:cobrancas(id, descricao, cliente:clientes(nome))")
    .gte("data", mes)
    .lt("data", seguinte)
    .order("data", { ascending: false })
    .order("created_at", { ascending: false })
  if (error) throw new Error(`Erro ao carregar os pagamentos: ${error.message}`)

  // Pesquisa aqui (e não na BD) para ignorar acentos.
  const palavras = normalizarPesquisa(pesquisa)
    .replace(/[^\p{L}\p{N}@._/-]+/gu, " ")
    .split(" ")
    .filter(Boolean)
  const pagamentos = palavras.length
    ? data.filter((pagamento) => {
        const texto = normalizarPesquisa(
          [pagamento.cobranca?.cliente?.nome, pagamento.referencia, pagamento.cobranca?.descricao]
            .filter(Boolean)
            .join(" ")
        )
        return palavras.every((palavra) => texto.includes(palavra))
      })
    : data
  const total = somar(pagamentos.map((pagamento) => Number(pagamento.valor)))

  // Setas para o mês anterior e o seguinte (mantêm a pesquisa).
  function hrefMes(valor: string) {
    const novos = new URLSearchParams()
    if (pesquisa) novos.set("q", textoPesquisa)
    if (valor !== mesAtual) novos.set("mes", valor.slice(0, 7))
    return novos.size ? `/financas/pagamentos?${novos}` : "/financas/pagamentos"
  }
  const nomeMes = formatarMes(mes)

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <Button asChild variant="outline" size="icon-lg" aria-label="Mês anterior">
          <Link href={hrefMes(somarMeses(mes, -1))} replace scroll={false}>
            <ChevronLeftIcon />
          </Link>
        </Button>
        <p className="min-w-0 flex-1 text-center text-lg font-semibold first-letter:uppercase">{nomeMes}</p>
        <Button asChild variant="outline" size="icon-lg" aria-label="Mês seguinte">
          <Link href={hrefMes(seguinte)} replace scroll={false}>
            <ChevronRightIcon />
          </Link>
        </Button>
      </div>

      <div className="mb-4 rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Total recebido{pesquisa ? " (na pesquisa)" : ""} em {nomeMes}
        </p>
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{formatarMoeda(total)}</p>
        <p className="text-xs text-muted-foreground">
          {pagamentos.length === 1 ? "1 pagamento" : `${pagamentos.length} pagamentos`}
        </p>
      </div>

      {pagamentos.length === 0 ? (
        pesquisa ? (
          <EstadoVazio
            icone={SearchXIcon}
            titulo="Nenhum pagamento encontrado"
            descricao="Experimente pesquisar pelo cliente ou pela referência, ou veja outro mês."
          />
        ) : (
          <EstadoVazio
            icone={BanknoteIcon}
            titulo={`Sem pagamentos em ${nomeMes}`}
            descricao="Os pagamentos registam-se na ficha de cada cobrança."
            acao={
              <Button asChild size="lg" variant="outline">
                <Link href="/financas/cobrancas">Ver as cobranças</Link>
              </Button>
            }
          />
        )
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {pagamentos.map((pagamento) => {
            const conteudo = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="font-medium tabular-nums">{formatarData(pagamento.data)}</span>
                    <span className="text-muted-foreground">{NOMES_METODO_PAGAMENTO[pagamento.metodo]}</span>
                  </span>
                  <span className="mt-1 block font-medium break-words">{pagamento.cobranca?.cliente?.nome ?? "—"}</span>
                  <span className="mt-0.5 block text-sm break-words text-primary">{pagamento.cobranca?.descricao}</span>
                  {pagamento.referencia && (
                    <span className="mt-0.5 block text-sm break-words text-muted-foreground">
                      Ref.: {pagamento.referencia}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right font-semibold whitespace-nowrap tabular-nums">
                  {formatarMoeda(Number(pagamento.valor))}
                </span>
              </>
            )
            return (
              <li key={pagamento.id}>
                {pagamento.cobranca ? (
                  <Link
                    href={`/financas/cobrancas/${pagamento.cobranca.id}`}
                    className="flex min-h-20 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50 active:bg-accent"
                  >
                    {conteudo}
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                ) : (
                  <div className="flex min-h-20 items-center gap-3 px-4 py-3">{conteudo}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
