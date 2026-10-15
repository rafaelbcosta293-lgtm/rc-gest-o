import { Suspense } from "react"
import Link from "next/link"
import {
  CalendarIcon,
  CameraIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  FileTextIcon,
  PlusIcon,
  SearchXIcon,
  UserRoundIcon,
} from "lucide-react"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { CampoPesquisa } from "@/components/campo-pesquisa"
import { EstadoVazio } from "@/components/estado-vazio"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { exigirPerfil } from "@/lib/auth"
import { hojeEmLisboa } from "@/lib/formatar"
import { createClient } from "@/lib/supabase/server"
import { normalizarPesquisa } from "@/lib/texto"
import { formatarQuandoVisita, nomeSitioVisita } from "@/lib/visitas"
import { SeparadoresOrcamentos } from "../_componentes/separadores"
import { EsqueletoListaVisitas } from "./_componentes/esqueletos"

export const metadata = { title: "Visitas" }

/** Visitas anteriores mostradas de cada vez ("Mostrar mais antigas" junta outras tantas). */
const POR_PAGINA = 20
const MAXIMO_ANTERIORES = 1000

type ParametrosPesquisa = PageProps<"/orcamentos/visitas">["searchParams"]

function primeiroValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? ""
}

type VisitaLista = {
  id: string
  data: string
  hora: string | null
  cliente: { nome: string; localidade: string | null } | null
  local: { nome: string; localidade: string | null } | null
  responsavel: { nome: string } | null
  fotos: { count: number }[]
  orcamentos: { count: number }[]
}

/** Todas as palavras têm de aparecer no cliente ou no local (nome ou localidade), sem contar acentos. */
function corresponde(visita: VisitaLista, pesquisa: string) {
  const texto = normalizarPesquisa(
    [visita.cliente?.nome, visita.cliente?.localidade, visita.local?.nome, visita.local?.localidade]
      .filter(Boolean)
      .join(" ")
  )
  const palavras = normalizarPesquisa(pesquisa)
    .replace(/[^\p{L}\p{N}@._-]+/gu, " ")
    .split(" ")
    .filter(Boolean)
  return palavras.every((palavra) => texto.includes(palavra))
}

function BotaoNovaVisita() {
  return (
    <Button asChild size="lg">
      <Link href="/orcamentos/visitas/nova">
        <PlusIcon />
        Nova visita
      </Link>
    </Button>
  )
}

export default function PaginaVisitas(props: PageProps<"/orcamentos/visitas">) {
  return (
    <>
      <SeparadoresOrcamentos />
      <CabecalhoPagina
        titulo="Visitas"
        descricao="Visitas aos jardins para preparar orçamentos: fotos, medidas e notas."
        acoes={<BotaoNovaVisita />}
      />
      <div className="mb-4">
        <Suspense fallback={<Skeleton className="h-11 w-full md:h-10" />}>
          <CampoPesquisa placeholder="Cliente ou local" />
        </Suspense>
      </div>
      <Suspense fallback={<EsqueletoListaVisitas />}>
        <ListaVisitas searchParams={props.searchParams} />
      </Suspense>
    </>
  )
}

async function ListaVisitas({ searchParams }: { searchParams: ParametrosPesquisa }) {
  await exigirPerfil("gerente", "chefe_equipa")
  const parametros = await searchParams
  const textoPesquisa = primeiroValor(parametros.q)
  const pesquisa = textoPesquisa.trim()
  const pedidas = Number.parseInt(primeiroValor(parametros.anteriores), 10)
  const limite = Number.isFinite(pedidas) ? Math.min(Math.max(pedidas, POR_PAGINA), MAXIMO_ANTERIORES) : POR_PAGINA

  const supabase = await createClient()
  const hoje = hojeEmLisboa()
  const colunas = `id, data, hora, cliente:clientes(nome, localidade), local:locais(nome, localidade),
    responsavel:colaboradores!visitas_responsavel_id_fkey(nome), fotos(count), orcamentos(count)`

  // Próximas (de hoje em diante): todas, da mais próxima para a mais distante.
  // Anteriores: da mais recente para a mais antiga, às páginas. Com pesquisa, a filtragem é feita
  // aqui (para ignorar acentos), sobre as últimas MAXIMO_ANTERIORES.
  let consultaAnteriores = supabase
    .from("visitas")
    .select(colunas, { count: "exact" })
    .lt("data", hoje)
    .order("data", { ascending: false })
    .order("hora", { ascending: false, nullsFirst: false })
  consultaAnteriores = consultaAnteriores.limit(pesquisa ? MAXIMO_ANTERIORES : limite)
  const [proximasR, anterioresR] = await Promise.all([
    supabase
      .from("visitas")
      .select(colunas)
      .gte("data", hoje)
      .order("data")
      .order("hora", { nullsFirst: false }),
    consultaAnteriores,
  ])
  if (proximasR.error) throw new Error(`Erro ao carregar as visitas: ${proximasR.error.message}`)
  if (anterioresR.error) throw new Error(`Erro ao carregar as visitas: ${anterioresR.error.message}`)

  const proximas = pesquisa ? proximasR.data.filter((visita) => corresponde(visita, pesquisa)) : proximasR.data
  const anterioresFiltradas = pesquisa
    ? anterioresR.data.filter((visita) => corresponde(visita, pesquisa))
    : anterioresR.data
  const totalAnteriores = pesquisa ? anterioresFiltradas.length : (anterioresR.count ?? anterioresFiltradas.length)
  const anteriores = anterioresFiltradas.slice(0, limite)

  if (proximas.length === 0 && anteriores.length === 0) {
    return pesquisa ? (
      <EstadoVazio
        icone={SearchXIcon}
        titulo="Nenhuma visita encontrada"
        descricao="Experimente pesquisar pelo nome do cliente, do local ou pela localidade."
      />
    ) : (
      <EstadoVazio
        icone={ClipboardListIcon}
        titulo="Ainda não há visitas"
        descricao="Marque uma visita ao jardim do cliente para tirar fotos e medidas antes de fazer o orçamento."
        acao={<BotaoNovaVisita />}
      />
    )
  }

  // "Mostrar mais antigas" mantém a pesquisa.
  const maisAntigas = new URLSearchParams()
  if (pesquisa) maisAntigas.set("q", textoPesquisa)
  maisAntigas.set("anteriores", String(Math.min(limite + POR_PAGINA, MAXIMO_ANTERIORES)))

  return (
    <div className="grid gap-6">
      <section aria-labelledby="titulo-proximas" className="grid gap-2">
        <h2 id="titulo-proximas" className="text-sm font-semibold text-muted-foreground">
          Próximas <span className="font-normal">({proximas.length})</span>
        </h2>
        {proximas.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
            {pesquisa ? "Nenhuma visita marcada corresponde à pesquisa." : "Não há visitas marcadas."}
          </p>
        ) : (
          <ListaLinhas visitas={proximas} hoje={hoje} />
        )}
      </section>

      {totalAnteriores > 0 && (
        <section aria-labelledby="titulo-anteriores" className="grid gap-2">
          <h2 id="titulo-anteriores" className="text-sm font-semibold text-muted-foreground">
            Anteriores <span className="font-normal">({totalAnteriores})</span>
          </h2>
          <ListaLinhas visitas={anteriores} hoje={hoje} />
          {totalAnteriores > anteriores.length && limite < MAXIMO_ANTERIORES && (
            <Button asChild variant="outline" size="lg" className="w-full sm:w-fit">
              <Link href={`/orcamentos/visitas?${maisAntigas}`} replace scroll={false}>
                Mostrar mais antigas
                <span className="font-normal text-muted-foreground">
                  ({anteriores.length} de {totalAnteriores})
                </span>
              </Link>
            </Button>
          )}
        </section>
      )}
    </div>
  )
}

function ListaLinhas({ visitas, hoje }: { visitas: VisitaLista[]; hoje: string }) {
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
      {visitas.map((visita) => {
        const fotos = visita.fotos[0]?.count ?? 0
        const orcamentos = visita.orcamentos[0]?.count ?? 0
        return (
          <li key={visita.id}>
            <Link
              href={`/orcamentos/visitas/${visita.id}`}
              className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50 active:bg-accent"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-start gap-2">
                  <span className="min-w-0 font-medium break-words">
                    {nomeSitioVisita(visita.cliente?.nome, visita.local?.nome)}
                  </span>
                  {visita.data === hoje && <Badge className="mt-0.5">Hoje</Badge>}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-medium text-foreground tabular-nums">
                    <CalendarIcon className="size-3.5" aria-hidden="true" />
                    {formatarQuandoVisita(visita.data, visita.hora)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <UserRoundIcon className="size-3.5" aria-hidden="true" />
                    {visita.responsavel?.nome ?? "Sem responsável"}
                  </span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <CameraIcon className="size-3.5" aria-hidden="true" />
                    {fotos === 1 ? "1 foto" : `${fotos} fotos`}
                  </span>
                  {orcamentos > 0 ? (
                    <Badge variant="secondary">
                      <FileTextIcon aria-hidden="true" />
                      {orcamentos === 1 ? "Com orçamento" : `${orcamentos} orçamentos`}
                    </Badge>
                  ) : (
                    visita.data < hoje && <Badge variant="outline">Sem orçamento</Badge>
                  )}
                </span>
              </span>
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
