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
import { normalizarPesquisa, soAlgarismos } from "@/lib/texto"
import { EsqueletoLista } from "./esqueletos"

export const metadata = { title: "Clientes" }

type ParametrosPesquisa = PageProps<"/clientes">["searchParams"]

function primeiroValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? ""
}

type ClientePesquisavel = {
  nome: string
  nif: string | null
  localidade: string | null
  pessoa_contacto: string | null
  email: string | null
  telemovel: string | null
  telefone: string | null
}

/**
 * Texto: todas as palavras têm de aparecer no nome, localidade, pessoa de
 * contacto ou email, sem contar acentos ("joao sintra" encontra "João … Sintra").
 * Números (3 ou mais algarismos): procura no NIF e nos telefones ignorando
 * espaços e o indicativo +351 ("912345678" encontra "912 345 678").
 */
function corresponde(cliente: ClientePesquisavel, pesquisa: string) {
  const algarismos = soAlgarismos(pesquisa)
  if (/^[\d\s+().-]+$/.test(pesquisa) && algarismos.length >= 3) {
    return [cliente.nif, cliente.telemovel, cliente.telefone].some(
      (numero) => numero !== null && soAlgarismos(numero).includes(algarismos)
    )
  }
  const texto = normalizarPesquisa(
    [cliente.nome, cliente.localidade, cliente.pessoa_contacto, cliente.email].filter(Boolean).join(" ")
  )
  return normalizarPesquisa(pesquisa)
    .split(/\s+/)
    .every((palavra) => texto.includes(palavra))
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
  const pesquisa = textoPesquisa.trim()
  const mostrarInativos = primeiroValor(parametros.inativos) === "1"

  const supabase = await createClient()
  let consulta = supabase
    .from("clientes")
    .select("id, nome, nif, localidade, pessoa_contacto, email, telemovel, telefone, ativo, locais(count)")
    .order("nome")
  if (!mostrarInativos) consulta = consulta.eq("ativo", true)
  const { data: todos, error } = await consulta
  if (error) throw new Error(`Erro ao carregar os clientes: ${error.message}`)

  // A pesquisa é feita aqui (e não na base de dados) para ignorar acentos e
  // os espaços dos números. Funciona até 1000 clientes (limite por omissão da
  // API do Supabase); acima disso, paginar e pesquisar na BD (unaccent).
  const clientes = pesquisa ? todos.filter((cliente) => corresponde(cliente, pesquisa)) : todos

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
