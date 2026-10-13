import { Suspense } from "react"
import Link from "next/link"
import {
  EyeIcon,
  EyeOffIcon,
  PhoneIcon,
  PlusIcon,
  SearchXIcon,
  UserRoundXIcon,
  UsersRoundIcon,
} from "lucide-react"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { CampoPesquisa } from "@/components/campo-pesquisa"
import { EstadoVazio } from "@/components/estado-vazio"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { exigirSessao } from "@/lib/auth"
import { eGerente, type Perfil } from "@/lib/perfis"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { BadgePerfil } from "./_componentes/badge-perfil"
import { EsqueletoListaCartoes } from "./_componentes/esqueletos"
import { PontoCor } from "./_componentes/ponto-cor"
import { iniciais, ligacaoTelefone, normalizarPesquisa, primeiroValor } from "./_componentes/utilitarios"

export const metadata = { title: "Colaboradores" }

type ColaboradorLista = {
  id: string
  nome: string
  funcao: string | null
  perfil: Perfil
  telemovel: string | null
  user_id: string | null
  ativo: boolean
  equipa: { id: string; nome: string; cor: string } | null
}

type ParametrosPesquisa = PageProps<"/equipa">["searchParams"]

export default function PaginaColaboradores(props: PageProps<"/equipa">) {
  return (
    <>
      <CabecalhoPagina
        titulo="Colaboradores"
        acoes={
          <Suspense fallback={null}>
            <BotaoNovoColaborador />
          </Suspense>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <Suspense fallback={<Skeleton className="h-11 w-full md:h-10" />}>
            <CampoPesquisa placeholder="Pesquisar por nome ou função…" />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <AlternarInativos searchParams={props.searchParams} />
        </Suspense>
      </div>
      <Suspense fallback={<EsqueletoListaCartoes />}>
        <ListaColaboradores searchParams={props.searchParams} />
      </Suspense>
    </>
  )
}

async function BotaoNovoColaborador() {
  const sessao = await exigirSessao()
  if (!eGerente(sessao.colaborador.perfil)) return null
  return (
    <Button asChild size="lg">
      <Link href="/equipa/colaboradores/novo">
        <PlusIcon />
        Novo colaborador
      </Link>
    </Button>
  )
}

/** "Mostrar inativos" / "Ocultar inativos" (só gerente), mantendo a pesquisa. */
async function AlternarInativos({ searchParams }: { searchParams: ParametrosPesquisa }) {
  const sessao = await exigirSessao()
  if (!eGerente(sessao.colaborador.perfil)) return null
  const parametros = await searchParams
  const pesquisa = (primeiroValor(parametros.q) ?? "").trim()
  const mostrarInativos = primeiroValor(parametros.inativos) === "1"

  const seguintes = new URLSearchParams()
  if (pesquisa) seguintes.set("q", pesquisa)
  if (!mostrarInativos) seguintes.set("inativos", "1")
  const consulta = seguintes.toString()

  return (
    <Button asChild variant="outline" className="h-11 md:h-10">
      <Link href={consulta ? `/equipa?${consulta}` : "/equipa"} scroll={false}>
        {mostrarInativos ? <EyeOffIcon /> : <EyeIcon />}
        {mostrarInativos ? "Ocultar inativos" : "Mostrar inativos"}
      </Link>
    </Button>
  )
}

async function ListaColaboradores({ searchParams }: { searchParams: ParametrosPesquisa }) {
  const sessao = await exigirSessao()
  const parametros = await searchParams
  const pesquisa = (primeiroValor(parametros.q) ?? "").trim()
  const gerente = eGerente(sessao.colaborador.perfil)
  const mostrarInativos = gerente && primeiroValor(parametros.inativos) === "1"

  const supabase = await createClient()
  let consulta = supabase
    .from("colaboradores")
    .select(
      "id, nome, funcao, perfil, telemovel, user_id, ativo, equipa:equipas!colaboradores_equipa_id_fkey(id, nome, cor)"
    )
    .order("ativo", { ascending: false })
    .order("nome")
  if (!mostrarInativos) consulta = consulta.eq("ativo", true)
  const { data: colaboradores, error } = await consulta
  if (error) throw new Error(`Erro ao ler os colaboradores: ${error.message}`)

  // A lista é pequena: filtra-se aqui para ignorar acentos ("ines" encontra "Inês").
  const termo = normalizarPesquisa(pesquisa)
  const lista = termo
    ? colaboradores.filter((c) => normalizarPesquisa(`${c.nome} ${c.funcao ?? ""}`).includes(termo))
    : colaboradores

  if (lista.length === 0) {
    return termo ? (
      <EstadoVazio
        icone={SearchXIcon}
        titulo="Nenhum colaborador encontrado"
        descricao={`Não há colaboradores com “${pesquisa}” no nome ou na função.`}
      />
    ) : (
      <EstadoVazio
        icone={UsersRoundIcon}
        titulo="Ainda não há colaboradores"
        descricao={gerente ? "Adicione as pessoas da empresa para as organizar em equipas." : undefined}
      />
    )
  }

  const ativos = lista.filter((c) => c.ativo).length
  const inativos = lista.length - ativos
  let resumo = `${ativos} ${ativos === 1 ? "colaborador ativo" : "colaboradores ativos"}`
  if (inativos > 0) resumo += ` e ${inativos} ${inativos === 1 ? "inativo" : "inativos"}`

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        {termo ? `${lista.length} ${lista.length === 1 ? "resultado" : "resultados"}` : resumo}
      </p>
      <ul className="grid gap-3 lg:grid-cols-2">
        {lista.map((colaborador) => (
          <CartaoColaborador
            key={colaborador.id}
            colaborador={colaborador}
            mostrarConta={gerente}
            eu={colaborador.id === sessao.colaborador.id}
          />
        ))}
      </ul>
    </>
  )
}

function CartaoColaborador({
  colaborador,
  mostrarConta,
  eu,
}: {
  colaborador: ColaboradorLista
  mostrarConta: boolean
  eu: boolean
}) {
  return (
    <li
      className={cn(
        "relative flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-accent/40",
        !colaborador.ativo && "bg-muted/40"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground",
          !colaborador.ativo && "opacity-60"
        )}
      >
        {iniciais(colaborador.nome)}
      </span>

      <div className="min-w-0 flex-1">
        {/* A ligação cobre o cartão todo (after:inset-0); o telefone fica por cima. */}
        <Link
          href={`/equipa/colaboradores/${colaborador.id}`}
          className="block truncate font-medium after:absolute after:inset-0 after:rounded-xl after:content-['']"
        >
          {colaborador.nome}
          {eu && <span className="font-normal text-muted-foreground"> (eu)</span>}
        </Link>
        <p className="truncate text-sm text-muted-foreground">{colaborador.funcao || "Sem função definida"}</p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          {colaborador.equipa ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <PontoCor cor={colaborador.equipa.cor} />
              <span className="truncate">{colaborador.equipa.nome}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Sem equipa</span>
          )}
          <BadgePerfil perfil={colaborador.perfil} />
          {!colaborador.ativo && <Badge variant="destructive">Inativo</Badge>}
          {mostrarConta && !colaborador.user_id && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <UserRoundXIcon className="size-3.5" />
              Sem conta
            </span>
          )}
        </div>
      </div>

      {colaborador.telemovel && (
        <a
          href={ligacaoTelefone(colaborador.telemovel)}
          className="relative z-10 inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent"
          aria-label={`Ligar para ${colaborador.nome} (${colaborador.telemovel})`}
        >
          <PhoneIcon className="size-4 text-primary" />
          <span className="hidden tabular-nums sm:inline">{colaborador.telemovel}</span>
        </a>
      )}
    </li>
  )
}
