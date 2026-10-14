"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeftIcon, ChevronRightIcon, LoaderCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DATA_MAXIMA, DATA_MINIMA, eDataValida, formatarDiaLongo, inicioDaSemana, somarDiasData } from "@/lib/datas"
import { hojeEmLisboa } from "@/lib/formatar"
import { cn } from "@/lib/utils"
import { deslocar, lerParametrosAgenda, urlAgenda, type ParametrosAgenda, type Vista } from "./tipos"

const formatoDiaMes = new Intl.DateTimeFormat("pt-PT", { timeZone: "UTC", day: "numeric", month: "long" })

function dataUTC(data: string) {
  return new Date(`${data}T00:00:00Z`)
}

/** Ex.: "12–18 de outubro de 2026" ou "28 de setembro – 4 de outubro de 2026". */
function rotuloSemana(inicio: string) {
  const fim = somarDiasData(inicio, 6)
  const ano = fim.slice(0, 4)
  if (inicio.slice(0, 7) === fim.slice(0, 7)) {
    return `${Number(inicio.slice(8))}–${formatoDiaMes.format(dataUTC(fim))} de ${ano}`
  }
  const anoInicio = inicio.slice(0, 4) === ano ? "" : ` de ${inicio.slice(0, 4)}`
  return `${formatoDiaMes.format(dataUTC(inicio))}${anoInicio} – ${formatoDiaMes.format(dataUTC(fim))} de ${ano}`
}

function rotulo({ vista, data }: ParametrosAgenda) {
  if (vista === "semana") return rotuloSemana(inicioDaSemana(data))
  const texto = `${formatarDiaLongo(data)} de ${data.slice(0, 4)}`
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/**
 * Navegação da agenda: anterior / Hoje / seguinte, Semana | Dia e escolha da
 * data. Lê o estado do endereço (tem de estar dentro de <Suspense>), por
 * isso responde de imediato enquanto a agenda carrega.
 */
export function BarraAgenda() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [aNavegar, iniciar] = useTransition()
  const hoje = hojeEmLisboa()
  const atual = lerParametrosAgenda((nome) => searchParams.get(nome) ?? undefined, hoje)
  const href = (alteracoes: Partial<ParametrosAgenda>) => urlAgenda({ ...atual, ...alteracoes }, hoje)
  const incluiHoje =
    atual.vista === "semana" ? inicioDaSemana(atual.data) === inicioDaSemana(hoje) : atual.data === hoje
  const nomePasso = atual.vista === "semana" ? "Semana" : "Dia"
  // Dia ou semana mostrados: no limite das datas aceites, a seta fica desativada.
  const periodo = ({ vista, data }: ParametrosAgenda) => (vista === "semana" ? inicioDaSemana(data) : data)
  const anterior = deslocar(atual, -1)
  const seguinte = deslocar(atual, 1)

  function irParaData(data: string) {
    if (!eDataValida(data) || data === atual.data) return
    iniciar(() => router.push(href({ data })))
  }

  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-2">
        <BotaoPasso
          href={periodo(anterior) === periodo(atual) ? null : urlAgenda(anterior, hoje)}
          rotulo={`${nomePasso} anterior`}
        >
          <ChevronLeftIcon className="size-5" />
        </BotaoPasso>
        <h2 className="min-w-0 flex-1 text-center text-base font-semibold text-balance lg:order-last lg:ml-2 lg:flex-none lg:text-left lg:text-lg">
          {rotulo(atual)}
          {aNavegar && <LoaderCircleIcon className="ml-2 inline size-4 animate-spin text-muted-foreground" />}
        </h2>
        <BotaoPasso
          href={periodo(seguinte) === periodo(atual) ? null : urlAgenda(seguinte, hoje)}
          rotulo={`${nomePasso} seguinte`}
        >
          <ChevronRightIcon className="size-5" />
        </BotaoPasso>
      </div>

      <div className="flex items-center gap-2">
        <Button asChild variant={incluiHoje ? "secondary" : "outline"} size="lg" className="px-4">
          <Link href={href({ data: hoje })} aria-current={incluiHoje ? "date" : undefined}>
            Hoje
          </Link>
        </Button>
        <EscolhaVista atual={atual.vista} href={(vista) => href({ vista })} />
        <Input
          // Volta a montar quando a data do endereço muda (o Next.js guarda a página escondida).
          key={atual.data}
          type="date"
          min={DATA_MINIMA}
          max={DATA_MAXIMA}
          defaultValue={atual.data}
          onChange={(evento) => irParaData(evento.target.value)}
          aria-label="Ir para a data"
          className="h-12 min-w-0 flex-1 lg:w-44 lg:flex-none"
        />
      </div>
    </div>
  )
}

/** Seta anterior/seguinte (sem href: desativada). */
function BotaoPasso({ href, rotulo, children }: { href: string | null; rotulo: string; children: React.ReactNode }) {
  if (!href) {
    return (
      <Button variant="outline" size="icon-lg" disabled aria-label={rotulo}>
        {children}
      </Button>
    )
  }
  return (
    <Button asChild variant="outline" size="icon-lg">
      <Link href={href} aria-label={rotulo} scroll={false}>
        {children}
      </Link>
    </Button>
  )
}

function EscolhaVista({ atual, href }: { atual: Vista; href: (vista: Vista) => string }) {
  const opcoes: { vista: Vista; nome: string }[] = [
    { vista: "semana", nome: "Semana" },
    { vista: "dia", nome: "Dia" },
  ]
  return (
    <nav aria-label="Vista da agenda" className="flex h-12 shrink-0 rounded-lg border bg-muted p-1">
      {opcoes.map(({ vista, nome }) => (
        <Link
          key={vista}
          href={href(vista)}
          aria-current={atual === vista ? "page" : undefined}
          className={cn(
            "flex items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
            atual === vista && "bg-background text-foreground shadow-xs"
          )}
        >
          {nome}
        </Link>
      ))}
    </nav>
  )
}

export function EsqueletoBarraAgenda() {
  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:justify-between" aria-hidden="true">
      <div className="flex items-center gap-2">
        <div className="size-12 animate-pulse rounded-lg bg-muted" />
        <div className="h-6 flex-1 animate-pulse rounded-md bg-muted lg:w-56 lg:flex-none" />
        <div className="size-12 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="flex gap-2">
        <div className="h-12 w-20 animate-pulse rounded-lg bg-muted" />
        <div className="h-12 w-36 animate-pulse rounded-lg bg-muted" />
        <div className="h-12 flex-1 animate-pulse rounded-lg bg-muted lg:w-44 lg:flex-none" />
      </div>
    </div>
  )
}
