import Link from "next/link"
import { ChevronRightIcon, CircleCheckIcon, ClockIcon, TriangleAlertIcon } from "lucide-react"

import { ProvedorPicagem } from "@/components/horas/contexto-picagem"
import { carregarEstadoPicagem } from "@/components/horas/estado-picagem"
import { Picagem } from "@/components/horas/picagem"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Sessao } from "@/lib/auth"
import { formatarData, formatarHora, hojeEmLisboa } from "@/lib/formatar"
import { dataEmLisboa } from "@/lib/horas"
import { createClient } from "@/lib/supabase/server"

/** Cartão "Hoje": trabalhos de hoje por equipa (agendados / em curso / concluídos). */
export async function HojePorEquipa() {
  const supabase = await createClient()
  const hoje = hojeEmLisboa()
  const { data, error } = await supabase
    .from("trabalhos")
    .select("equipa_id, estado, equipa:equipas(nome, cor)")
    .eq("data", hoje)
  if (error) throw new Error(`Não foi possível carregar os trabalhos de hoje: ${error.message}`)

  type Linha = { equipaId: string | null; nome: string; cor: string | null; agendado: number; em_curso: number; concluido: number }
  const porEquipa = new Map<string | null, Linha>()
  for (const trabalho of data) {
    if (trabalho.estado === "cancelado") continue
    const linha = porEquipa.get(trabalho.equipa_id) ?? {
      equipaId: trabalho.equipa_id,
      nome: trabalho.equipa?.nome ?? "Por atribuir",
      cor: trabalho.equipa?.cor ?? null,
      agendado: 0,
      em_curso: 0,
      concluido: 0,
    }
    linha[trabalho.estado] += 1
    porEquipa.set(trabalho.equipa_id, linha)
  }
  const linhas = [...porEquipa.values()].sort(
    (a, b) => Number(a.equipaId === null) - Number(b.equipaId === null) || a.nome.localeCompare(b.nome, "pt")
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Hoje</h2>
        </CardTitle>
        <CardDescription>Trabalhos por equipa</CardDescription>
        <CardAction>
          <Button asChild variant="ghost" size="sm" className="h-10">
            <Link href="/agenda?vista=dia">
              Agenda do dia
              <ChevronRightIcon />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {linhas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Não há trabalhos marcados para hoje.</p>
        ) : (
          <ul className="divide-y">
            {linhas.map((linha) => (
              <li key={linha.equipaId ?? "sem-equipa"}>
                <Link
                  href={linha.equipaId ? `/agenda?vista=dia&equipa=${linha.equipaId}` : "/agenda?vista=dia"}
                  className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2 font-medium">
                    <span
                      className="size-2.5 shrink-0 rounded-full bg-muted-foreground"
                      style={linha.cor ? { backgroundColor: linha.cor } : undefined}
                      aria-hidden="true"
                    />
                    <span className="truncate">{linha.nome}</span>
                  </span>
                  <span className="flex gap-3 text-sm tabular-nums">
                    <span title="Agendados">
                      <span className="font-semibold">{linha.agendado}</span>{" "}
                      <span className="text-muted-foreground">agendados</span>
                    </span>
                    <span title="Em curso">
                      <span className="font-semibold text-primary">{linha.em_curso}</span>{" "}
                      <span className="text-muted-foreground">em curso</span>
                    </span>
                    <span title="Concluídos">
                      <span className="font-semibold">{linha.concluido}</span>{" "}
                      <span className="text-muted-foreground">concluídos</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/** Quem tem uma entrada aberta agora (nome, desde quando, em que trabalho). */
export async function ATrabalharAgora() {
  const supabase = await createClient()
  const hoje = hojeEmLisboa()
  const { data, error } = await supabase
    .from("registos_horas")
    .select("id, entrada, colaborador:colaboradores(id, nome), trabalho:trabalhos(id, titulo, cliente:clientes(nome))")
    .is("saida", null)
    .order("entrada")
  if (error) throw new Error(`Não foi possível carregar quem está a trabalhar: ${error.message}`)

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>A trabalhar agora</h2>
        </CardTitle>
        <CardDescription>
          {data.length === 0 ? "Ninguém tem a entrada picada." : data.length === 1 ? "1 pessoa" : `${data.length} pessoas`}
        </CardDescription>
      </CardHeader>
      {data.length > 0 && (
        <CardContent>
          <ul className="divide-y">
            {data.map((registo) => {
              const dia = dataEmLisboa(registo.entrada)
              const doutroDia = dia !== hoje
              return (
                <li key={registo.id}>
                  <Link
                    href={`/horas?mes=${dia.slice(0, 7)}&colaborador=${registo.colaborador?.id ?? ""}`}
                    className="flex min-h-12 items-center gap-3 py-2.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{registo.colaborador?.nome}</span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {registo.trabalho
                          ? [registo.trabalho.titulo, registo.trabalho.cliente?.nome].filter(Boolean).join(" · ")
                          : "Sem trabalho"}
                      </span>
                    </span>
                    {doutroDia ? (
                      <Badge variant="destructive" className="shrink-0">
                        <TriangleAlertIcon />
                        desde {formatarData(dia).slice(0, 5)}
                      </Badge>
                    ) : (
                      <span className="flex shrink-0 items-center gap-1 text-sm tabular-nums text-muted-foreground">
                        <ClockIcon className="size-3.5" aria-hidden="true" />
                        desde {formatarHora(registo.entrada)}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </CardContent>
      )}
    </Card>
  )
}

/** Períodos marcados "a rever" (saídas esquecidas fechadas automaticamente). */
export async function HorasARever() {
  const supabase = await createClient()
  const { data, count, error } = await supabase
    .from("registos_horas")
    .select("id, entrada, colaborador:colaboradores(id, nome)", { count: "exact" })
    .eq("a_rever", true)
    .order("entrada", { ascending: false })
    .limit(5)
  if (error) throw new Error(`Não foi possível carregar as horas a rever: ${error.message}`)
  const total = count ?? data.length

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Horas a rever</h2>
        </CardTitle>
        <CardDescription>
          {total === 0 ? "Nada para rever." : total === 1 ? "1 período por confirmar" : `${total} períodos por confirmar`}
        </CardDescription>
        <CardAction>
          <Button asChild variant="ghost" size="sm" className="h-10">
            <Link href="/horas">
              Horas
              <ChevronRightIcon />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleCheckIcon className="size-4" aria-hidden="true" />
            Todas as saídas foram registadas.
          </p>
        ) : (
          <ul className="divide-y">
            {data.map((registo) => {
              const dia = dataEmLisboa(registo.entrada)
              return (
                <li key={registo.id}>
                  <Link
                    href={`/horas?mes=${dia.slice(0, 7)}&colaborador=${registo.colaborador?.id ?? ""}`}
                    className="flex min-h-12 items-center gap-3 py-2.5"
                  >
                    <TriangleAlertIcon className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate font-medium">{registo.colaborador?.nome}</span>
                    <span className="text-sm tabular-nums text-muted-foreground">{formatarData(dia)}</span>
                    <ChevronRightIcon className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/** O gerente também pode picar. */
export async function PicagemGerente({ sessao }: { sessao: Sessao }) {
  const estado = await carregarEstadoPicagem(sessao.colaborador.id)
  return (
    <section aria-label="A minha picagem" className="grid gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">A minha picagem</h2>
      <ProvedorPicagem>
        <Picagem estado={estado} />
      </ProvedorPicagem>
    </section>
  )
}
