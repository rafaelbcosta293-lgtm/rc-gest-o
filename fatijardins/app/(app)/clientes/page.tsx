import { Suspense } from "react"
import Link from "next/link"
import { ChevronRightIcon, MapPinIcon, PhoneIcon, PlusIcon, SearchXIcon, TreesIcon } from "lucide-react"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { CampoPesquisa } from "@/components/campo-pesquisa"
import { EstadoVazio } from "@/components/estado-vazio"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { exigirPerfil } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { EsqueletoLista } from "./esqueletos"

export const metadata = { title: "Clientes" }

type ParametrosPesquisa = PageProps<"/clientes">["searchParams"]

/** Retira os caracteres com significado especial nos filtros do PostgREST (or=, ilike). */
function limparPesquisa(texto: string): string {
  return texto.replace(/[,()"\\%*]/g, " ").replace(/\s+/g, " ").trim()
}

function primeiroValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? ""
}

function BotaoNovoCliente() {
  return (
    <Button asChild size="lg">
      <Link href="/clientes/novo">
        <PlusIcon />
        Novo cliente
      </Link>
    </Button>
  )
}

export default function PaginaClientes(props: PageProps<"/clientes">) {
  return (
    <>
      <CabecalhoPagina titulo="Clientes" acoes={<BotaoNovoCliente />} />
      <div className="mb-4">
        <Suspense fallback={<Skeleton className="h-11 w-full md:h-10" />}>
          <CampoPesquisa placeholder="Nome, NIF, localidade ou telemóvel" />
        </Suspense>
      </div>
      <Suspense fallback={<EsqueletoLista />}>
        <ListaClientes searchParams={props.searchParams} />
      </Suspense>
    </>
  )
}

async function ListaClientes({ searchParams }: { searchParams: ParametrosPesquisa }) {
  await exigirPerfil("gerente", "chefe_equipa")
  const parametros = await searchParams
  const textoPesquisa = primeiroValor(parametros.q)
  const pesquisa = limparPesquisa(textoPesquisa)
  const mostrarInativos = primeiroValor(parametros.inativos) === "1"

  const supabase = await createClient()
  let consulta = supabase
    .from("clientes")
    .select("id, nome, localidade, telemovel, ativo, locais(count)")
    .order("nome")
  if (!mostrarInativos) consulta = consulta.eq("ativo", true)
  if (pesquisa) {
    const padrao = `%${pesquisa}%`
    // Números: ignorar espaços, para "912345678" encontrar "912 345 678" (e vice-versa).
    const algarismos = pesquisa.replace(/\D/g, "")
    const eNumero = /^[\d\s+]+$/.test(pesquisa) && algarismos.length >= 3
    const padraoNif = eNumero ? `%${algarismos}%` : padrao
    const padraoTelemovel = eNumero ? `%${algarismos.split("").join("%")}%` : padrao
    consulta = consulta.or(
      `nome.ilike.${padrao},localidade.ilike.${padrao},nif.ilike.${padraoNif},telemovel.ilike.${padraoTelemovel}`
    )
  }
  const { data: clientes, error } = await consulta
  if (error) throw new Error(`Erro ao carregar os clientes: ${error.message}`)

  // Ligação "Mostrar/Esconder inativos" que mantém a pesquisa.
  const alternarInativos = new URLSearchParams()
  if (pesquisa) alternarInativos.set("q", textoPesquisa)
  if (!mostrarInativos) alternarInativos.set("inativos", "1")
  const hrefInativos = alternarInativos.size ? `/clientes?${alternarInativos}` : "/clientes"

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {clientes.length === 1 ? "1 cliente" : `${clientes.length} clientes`}
          {mostrarInativos ? " (incluindo inativos)" : ""}
        </p>
        <Button asChild variant="ghost" size="sm">
          <Link href={hrefInativos} replace scroll={false}>
            {mostrarInativos ? "Esconder inativos" : "Mostrar inativos"}
          </Link>
        </Button>
      </div>

      {clientes.length === 0 ? (
        pesquisa ? (
          <EstadoVazio
            icone={SearchXIcon}
            titulo="Nenhum cliente encontrado"
            descricao={
              mostrarInativos
                ? "Experimente pesquisar por outra palavra."
                : "Experimente pesquisar por outra palavra ou mostrar também os clientes inativos."
            }
          />
        ) : (
          <EstadoVazio
            icone={TreesIcon}
            titulo={mostrarInativos ? "Ainda não há clientes" : "Não há clientes ativos"}
            descricao="Registe os clientes e os seus jardins para os ter à mão no telemóvel."
            acao={<BotaoNovoCliente />}
          />
        )
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {clientes.map((cliente) => {
            const numeroLocais = cliente.locais[0]?.count ?? 0
            return (
              <li key={cliente.id}>
                <Link
                  href={`/clientes/${cliente.id}`}
                  className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50 active:bg-accent"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{cliente.nome}</span>
                      {!cliente.ativo && <Badge variant="muted">Inativo</Badge>}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                      {cliente.localidade && <span>{cliente.localidade}</span>}
                      <span className="inline-flex items-center gap-1">
                        <MapPinIcon className="size-3.5" />
                        {numeroLocais === 1 ? "1 local" : `${numeroLocais} locais`}
                      </span>
                      {cliente.telemovel && (
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <PhoneIcon className="size-3.5" />
                          {cliente.telemovel}
                        </span>
                      )}
                    </span>
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
