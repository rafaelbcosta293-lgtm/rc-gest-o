import { Badge } from "@/components/ui/badge"
import { formatarData, formatarDuracao, formatarHora, hojeEmLisboa } from "@/lib/formatar"

export type RegistoHorasTrabalho = {
  id: string
  entrada: string
  saida: string | null
  a_rever: boolean
  colaborador: { nome: string } | null
}

type Props = {
  registos: RegistoHorasTrabalho[]
  /** Data do trabalho (aaaa-mm-dd): só se mostra a data das picagens de outros dias. */
  dataTrabalho: string
  /** Hora atual (ms), para a duração dos períodos ainda abertos. */
  agora: number
}

/** Períodos picados neste trabalho (cada perfil vê os que a RLS deixa). */
export function HorasTrabalho({ registos, dataTrabalho, agora }: Props) {
  if (registos.length === 0) {
    return <p className="text-sm text-muted-foreground">Ainda não há horas registadas neste trabalho.</p>
  }

  const linhas = registos.map((registo) => {
    const inicio = new Date(registo.entrada)
    const fim = registo.saida ? new Date(registo.saida).getTime() : agora
    const minutos = Math.max(0, (fim - inicio.getTime()) / 60_000)
    const dia = hojeEmLisboa(inicio)
    return { ...registo, minutos, outroDia: dia !== dataTrabalho ? formatarData(dia) : null }
  })
  const total = linhas.reduce((soma, linha) => soma + linha.minutos, 0)

  return (
    <div className="grid gap-2">
      <ul className="divide-y rounded-lg border">
        {linhas.map((linha) => (
          <li key={linha.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
            <span className="min-w-0">
              <span className="block truncate font-medium">{linha.colaborador?.nome ?? "—"}</span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground tabular-nums">
                {linha.outroDia && <span>{linha.outroDia}</span>}
                <span>
                  {formatarHora(linha.entrada)}–{linha.saida ? formatarHora(linha.saida) : "…"}
                </span>
                {!linha.saida && <Badge>Em curso</Badge>}
                {linha.a_rever && <Badge variant="outline">A rever</Badge>}
              </span>
            </span>
            <span className="shrink-0 font-medium tabular-nums">{formatarDuracao(linha.minutos)}</span>
          </li>
        ))}
      </ul>
      <p className="flex items-center justify-between gap-3 px-3 text-sm font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{formatarDuracao(total)}</span>
      </p>
    </div>
  )
}
