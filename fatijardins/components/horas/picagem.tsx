"use client"

import { useLayoutEffect, useState } from "react"
import {
  ArrowLeftRightIcon,
  ClockIcon,
  LoaderCircleIcon,
  LogInIcon,
  LogOutIcon,
  MapPinIcon,
  TriangleAlertIcon,
  WarehouseIcon,
  XIcon,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { formatarData, formatarDuracao, formatarHora } from "@/lib/formatar"
import { dataEmLisboa, minutosDoPeriodo } from "@/lib/horas"
import { cn } from "@/lib/utils"
import { usePicagem, type EtapaPicagem } from "./contexto-picagem"
import { Interruptor } from "./interruptor"
import type { EstadoPicagem, TrabalhoPicagem } from "./tipos"
import { useMinutoAtual } from "./use-minuto-atual"

function textoEtapa(etapa: EtapaPicagem) {
  return etapa === "localizacao" ? "A obter a localização…" : "A registar…"
}

/**
 * Picagem de horas: botão grande "Picar entrada"; com a entrada aberta
 * mostra desde quando, o tempo a contar e o trabalho, com "Mudar de
 * trabalho" e "Picar saída". A hora registada é sempre a do servidor.
 * Tem de estar dentro de <ProvedorPicagem>.
 */
export function Picagem({ estado }: { estado: EstadoPicagem }) {
  const { aCorrer, etapa, aviso, fecharAviso, guardarLocalizacao, mudarGuardarLocalizacao, entrar, sair } =
    usePicagem()
  const agora = useMinutoAtual(estado.agora)
  const [escolher, setEscolher] = useState(false)
  const [confirmarSaida, setConfirmarSaida] = useState(false)

  // Diálogos são passageiros: fechados ao voltar a esta página.
  useLayoutEffect(() => {
    return () => {
      setEscolher(false)
      setConfirmarSaida(false)
    }
  }, [])

  const { aberto, trabalhos } = estado
  const diaAberto = aberto ? dataEmLisboa(aberto.entrada) : null
  const esquecida = aberto !== null && diaAberto !== estado.hoje
  const decorrido = aberto && !esquecida ? minutosDoPeriodo({ entrada: aberto.entrada, saida: null }, agora) : 0
  const totalHoje = estado.minutosFechadosHoje + decorrido
  // Sem trabalhos hoje e já "sem trabalho": não há para onde mudar.
  const podeMudar = trabalhos.length > 0 || aberto?.trabalhoId != null

  function picarEntrada() {
    // Sem trabalhos hoje não há nada a escolher.
    if (trabalhos.length === 0) entrar(null)
    else setEscolher(true)
  }

  return (
    <Card className="gap-4 py-4" aria-busy={aCorrer}>
      <CardContent className="grid gap-4 px-4">
        <h2 className="sr-only">Picagem de horas</h2>

        {aviso && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <TriangleAlertIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p className="flex-1 font-medium">{aviso}</p>
            <button
              type="button"
              onClick={fecharAviso}
              aria-label="Fechar aviso"
              className="-m-2 flex size-10 shrink-0 items-center justify-center rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/40"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        )}

        {aberto && !esquecida ? (
          <div className="grid gap-1">
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <span className="relative flex size-2.5" aria-hidden="true">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
              </span>
              A trabalhar desde {formatarHora(aberto.entrada)}
            </p>
            <p className="text-4xl font-semibold tracking-tight tabular-nums" aria-label={`Tempo decorrido: ${formatarDuracao(decorrido)}`}>
              {formatarDuracao(decorrido)}
            </p>
            <p className="text-base">
              {aberto.trabalhoId ? (
                <>
                  <span className="font-medium">{aberto.trabalho ?? "Trabalho"}</span>
                  {aberto.cliente && <span className="text-muted-foreground"> · {aberto.cliente}</span>}
                </>
              ) : (
                <span className="text-muted-foreground">Sem trabalho: armazém / deslocação</span>
              )}
            </p>
            {estado.minutosFechadosHoje > 0 && (
              <p className="text-sm text-muted-foreground">Hoje: {formatarDuracao(totalHoje)}</p>
            )}
          </div>
        ) : esquecida && aberto ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <TriangleAlertIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p>
              <span className="font-semibold">
                Ficou uma entrada aberta de {formatarData(diaAberto).slice(0, 5)}, desde as {formatarHora(aberto.entrada)}.
              </span>{" "}
              Ao picar, essa saída fica às 23:59 e o gerente vai rever.
            </p>
          </div>
        ) : (
          <div className="grid gap-1">
            <p className="flex items-center gap-2 text-base font-semibold">
              <ClockIcon className="size-5 text-muted-foreground" aria-hidden="true" />
              {estado.ultimaSaida ? `Saiu às ${estado.ultimaSaida}` : "Ainda não picou hoje"}
            </p>
            {totalHoje > 0 && <p className="text-sm text-muted-foreground">Hoje: {formatarDuracao(totalHoje)}</p>}
          </div>
        )}

        {aberto && !esquecida ? (
          <div className={cn("grid gap-2", podeMudar && "grid-cols-2")}>
            {podeMudar && (
              <Button
                variant="outline"
                size="lg"
                className="h-14 leading-tight whitespace-normal"
                onClick={() => setEscolher(true)}
                disabled={aCorrer}
              >
                <ArrowLeftRightIcon />
                Mudar de trabalho
              </Button>
            )}
            <Button
              variant="destructive"
              size="lg"
              className="h-14 leading-tight whitespace-normal"
              onClick={() => setConfirmarSaida(true)}
              disabled={aCorrer}
            >
              {aCorrer ? <LoaderCircleIcon className="animate-spin" /> : <LogOutIcon />}
              Picar saída
            </Button>
          </div>
        ) : (
          <div className={cn("grid gap-2", esquecida && "grid-cols-2")}>
            <Button size="lg" className="h-16 text-lg" onClick={picarEntrada} disabled={aCorrer}>
              {aCorrer ? <LoaderCircleIcon className="size-5 animate-spin" /> : <LogInIcon className="size-5" />}
              Picar entrada
            </Button>
            {esquecida && (
              <Button variant="outline" size="lg" className="h-16 text-lg" onClick={() => setConfirmarSaida(true)} disabled={aCorrer}>
                <LogOutIcon className="size-5" />
                Picar saída
              </Button>
            )}
          </div>
        )}

        {aCorrer && (
          <p role="status" className="-mt-2 text-center text-sm text-muted-foreground">
            {textoEtapa(etapa)}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 border-t pt-3">
          <Label htmlFor="picagem-localizacao" className="flex items-center gap-2 font-normal text-muted-foreground">
            <MapPinIcon className="size-4" aria-hidden="true" />
            Guardar a localização
          </Label>
          <Interruptor id="picagem-localizacao" ligado={guardarLocalizacao} aoMudar={mudarGuardarLocalizacao} />
        </div>
      </CardContent>

      <EscolherTrabalho
        aberto={escolher}
        aoMudar={(abrir) => !aCorrer && setEscolher(abrir)}
        trabalhos={trabalhos}
        atual={aberto && !esquecida ? aberto.trabalhoId : undefined}
        mudar={aberto !== null && !esquecida}
        aCorrer={aCorrer}
        etapa={etapa}
        escolher={(trabalhoId) => entrar(trabalhoId, () => setEscolher(false))}
      />

      <AlertDialog open={confirmarSaida} onOpenChange={(abrir) => !aCorrer && setConfirmarSaida(abrir)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Picar saída?</AlertDialogTitle>
            <AlertDialogDescription>
              {esquecida
                ? "A entrada esquecida fica fechada às 23:59 desse dia, para o gerente rever."
                : "A saída fica registada com a hora de agora."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={aCorrer} className="h-12">
              Cancelar
            </AlertDialogCancel>
            <Button
              variant="destructive"
              size="lg"
              disabled={aCorrer}
              onClick={() => sair(() => setConfirmarSaida(false))}
            >
              {aCorrer ? <LoaderCircleIcon className="animate-spin" /> : <LogOutIcon />}
              {aCorrer ? textoEtapa(etapa) : "Picar saída"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

type PropsEscolher = {
  aberto: boolean
  aoMudar: (abrir: boolean) => void
  trabalhos: TrabalhoPicagem[]
  /** Trabalho do período em curso (undefined = não há período em curso). */
  atual: string | null | undefined
  /** Já está a trabalhar: é uma mudança de trabalho. */
  mudar: boolean
  aCorrer: boolean
  etapa: EtapaPicagem
  escolher: (trabalhoId: string | null) => void
}

/** Lista de botões grandes: os trabalhos de hoje e "Sem trabalho". */
function EscolherTrabalho({ aberto, aoMudar, trabalhos, atual, mudar, aCorrer, etapa, escolher }: PropsEscolher) {
  const [escolhido, setEscolhido] = useState<string | null | undefined>(undefined)
  const variasEquipas = new Set(trabalhos.map((trabalho) => trabalho.equipa)).size > 1

  function tocar(trabalhoId: string | null) {
    setEscolhido(trabalhoId)
    escolher(trabalhoId)
  }

  function opcao(id: string | null, conteudo: React.ReactNode) {
    const eAtual = atual === id
    return (
      <li key={id ?? "sem-trabalho"}>
        <Button
          type="button"
          variant={eAtual ? "secondary" : "outline"}
          disabled={aCorrer || eAtual}
          onClick={() => tocar(id)}
          className="h-auto min-h-14 w-full justify-start gap-3 px-3 py-2 text-left whitespace-normal"
        >
          {conteudo}
          {eAtual && <span className="ml-auto shrink-0 text-xs font-normal">Atual</span>}
          {aCorrer && escolhido === id && <LoaderCircleIcon className="ml-auto animate-spin" />}
        </Button>
      </li>
    )
  }

  return (
    <Dialog open={aberto} onOpenChange={aoMudar}>
      <DialogContent className="gap-3 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{mudar ? "Mudar para que trabalho?" : "Em que trabalho vai estar?"}</DialogTitle>
          <DialogDescription>
            {aCorrer ? textoEtapa(etapa) : "Toque no trabalho. A hora fica a de agora."}
          </DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2">
          {trabalhos.map((trabalho) =>
            opcao(
              trabalho.id,
              <>
              <span className="w-12 shrink-0 text-base font-semibold tabular-nums">{trabalho.hora ?? "—"}</span>
              <span className="min-w-0">
                <span className="block text-base font-medium">{trabalho.titulo}</span>
                <span className="block text-sm font-normal text-muted-foreground">
                  {[trabalho.cliente, variasEquipas ? trabalho.equipa : null].filter(Boolean).join(" · ")}
                </span>
              </span>
              </>
            )
          )}
          {opcao(
            null,
            <>
              <WarehouseIcon className="size-5 shrink-0" aria-hidden="true" />
              <span className="text-base font-medium">Sem trabalho (armazém, deslocação…)</span>
            </>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
