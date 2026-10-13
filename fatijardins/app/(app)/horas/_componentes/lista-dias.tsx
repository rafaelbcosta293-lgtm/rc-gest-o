import Link from "next/link"
import { TriangleAlertIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { eFimDeSemana, feriadoNacional, formatarDiaCurto } from "@/lib/datas"
import { formatarDuracao, formatarHora } from "@/lib/formatar"
import { dataEmLisboa, horaEmLisboa, type DiaHoras } from "@/lib/horas"
import { cn } from "@/lib/utils"
import { rotuloTrabalho, type PeriodoMapa } from "./dados"
import { BotaoEditarPeriodo, BotaoRevisto, type PeriodoEditavel } from "./editor-periodos"

function paraEditar(periodo: PeriodoMapa): PeriodoEditavel {
  return {
    id: periodo.id,
    data: dataEmLisboa(periodo.entrada),
    entrada: horaEmLisboa(periodo.entrada),
    saida: periodo.saida ? horaEmLisboa(periodo.saida) : "",
    trabalhoId: periodo.trabalhoId,
    trabalhoRotulo: rotuloTrabalho(periodo),
    notas: periodo.notas,
  }
}

function maiuscula(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

type Props = {
  /** Dias a mostrar (aaaa-mm-dd), por ordem. */
  datas: string[]
  dias: DiaHoras<PeriodoMapa>[]
  /** O gerente corrige períodos. */
  gerente: boolean
  /** Ligações para o trabalho (quem o pode abrir). */
  ligarTrabalhos: boolean
}

/** Mapa dia a dia: no PC em colunas (dia, períodos, total, extra); no telemóvel em cartões. */
export function ListaDias({ datas, dias, gerente, ligarTrabalhos }: Props) {
  const porData = new Map(dias.map((dia) => [dia.data, dia]))

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div
        aria-hidden="true"
        className="hidden border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[9.5rem_minmax(0,1fr)_6.5rem_5.5rem] md:gap-4"
      >
        <span>Dia</span>
        <span>Períodos</span>
        <span className="text-right">Total</span>
        <span className="text-right">Extra</span>
      </div>
      <ul className="divide-y">
        {datas.map((data) => {
          const dia = porData.get(data)
          const fimDeSemana = eFimDeSemana(data)
          const feriado = feriadoNacional(data)
          const nomeDia = maiuscula(formatarDiaCurto(data))

          if (!dia) {
            return (
              <li
                key={data}
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-2 text-sm text-muted-foreground md:grid md:grid-cols-[9.5rem_minmax(0,1fr)_6.5rem_5.5rem] md:gap-4",
                  (fimDeSemana || feriado) && "bg-muted/40"
                )}
              >
                <span>{nomeDia}</span>
                <span className="hidden md:block">—</span>
                <span className="truncate md:text-right" title={feriado ?? undefined}>
                  {feriado ? "Feriado" : fimDeSemana ? "Fim de semana" : "—"}
                </span>
                <span className="hidden md:block" />
              </li>
            )
          }

          return (
            <li
              key={data}
              className={cn(
                "grid gap-2 px-4 py-3 md:grid-cols-[9.5rem_minmax(0,1fr)_6.5rem_5.5rem] md:items-start md:gap-4",
                (fimDeSemana || feriado) && "bg-muted/40"
              )}
            >
              <div className="flex items-start justify-between gap-2 md:block">
                <div>
                  <p className="font-medium">{nomeDia}</p>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {feriado && (
                      <Badge variant="secondary" title={feriado}>
                        Feriado
                      </Badge>
                    )}
                    {fimDeSemana && !feriado && <Badge variant="muted">Fim de semana</Badge>}
                    {dia.aRever && (
                      <Badge variant="outline" className="border-amber-400 text-amber-800 dark:text-amber-300">
                        <TriangleAlertIcon />A rever
                      </Badge>
                    )}
                  </div>
                </div>
                {/* Telemóvel: total e extra à direita do dia. */}
                <div className="text-right md:hidden">
                  <p className="font-semibold tabular-nums">{formatarDuracao(dia.minutos)}</p>
                  {dia.extra > 0 && <p className="text-xs text-primary tabular-nums">+{formatarDuracao(dia.extra)} extra</p>}
                </div>
              </div>

              <ul className="grid gap-1.5">
                {dia.periodos.map((periodo) => {
                  const rotulo = rotuloTrabalho(periodo)
                  const aberto = periodo.saida === null
                  return (
                    <li key={periodo.id} className="flex items-start gap-2 text-sm">
                      <div className="min-w-0 flex-1 py-0.5">
                        <p>
                          <span className="font-medium tabular-nums">
                            {formatarHora(periodo.entrada)}–{aberto ? "…" : formatarHora(periodo.saida)}
                          </span>
                          <span className="text-muted-foreground"> · </span>
                          {ligarTrabalhos && periodo.trabalho && periodo.trabalhoId ? (
                            <Link href={`/trabalhos/${periodo.trabalhoId}`} className="underline-offset-4 hover:underline">
                              {rotulo}
                            </Link>
                          ) : (
                            <span className={cn(!periodo.trabalhoId && "text-muted-foreground")}>{rotulo}</span>
                          )}
                          <span className="text-muted-foreground"> · </span>
                          <span className="whitespace-nowrap text-muted-foreground tabular-nums">
                            {formatarDuracao(periodo.minutos)}
                          </span>
                          {aberto && (
                            <Badge className="ml-1.5 align-middle" variant="default">
                              Em curso
                            </Badge>
                          )}
                          {periodo.aRever && (
                            <TriangleAlertIcon
                              className="ml-1.5 inline size-4 align-text-bottom text-amber-600"
                              aria-label="A rever"
                            />
                          )}
                          {periodo.origem === "manual" && (
                            <span className="ml-1.5 text-xs text-muted-foreground">(manual)</span>
                          )}
                        </p>
                        {periodo.notas && <p className="text-xs text-muted-foreground">{periodo.notas}</p>}
                        {gerente && periodo.aRever && (
                          <div className="mt-1">
                            <BotaoRevisto id={periodo.id} />
                          </div>
                        )}
                      </div>
                      {gerente && <BotaoEditarPeriodo periodo={paraEditar(periodo)} />}
                    </li>
                  )
                })}
              </ul>

              <p className="hidden text-right font-semibold tabular-nums md:block">{formatarDuracao(dia.minutos)}</p>
              <p className={cn("hidden text-right tabular-nums md:block", dia.extra > 0 ? "text-primary" : "text-muted-foreground")}>
                {dia.extra > 0 ? formatarDuracao(dia.extra) : "—"}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
