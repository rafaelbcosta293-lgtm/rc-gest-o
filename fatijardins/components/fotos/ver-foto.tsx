"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export type FotoEmGrande = {
  url: string | null
  largura: number | null
  altura: number | null
  titulo: string
  descricao: React.ReactNode
  /** Texto alternativo da imagem. */
  alt: string
}

type Props = {
  /** null: janela fechada. */
  foto: FotoEmGrande | null
  aoFechar: () => void
  /** null na primeira/última foto (o botão fica desativado). */
  aoAnterior: (() => void) | null
  aoSeguinte: (() => void) | null
  /** Botões à direita das setas (ex.: apagar). */
  acoes?: React.ReactNode
  /** Por baixo da foto (ex.: a legenda). */
  children?: React.ReactNode
}

/** Ver uma foto em grande, com setas para a anterior e a seguinte. */
export function VerFoto({ foto, aoFechar, aoAnterior, aoSeguinte, acoes, children }: Props) {
  return (
    <Dialog open={foto !== null} onOpenChange={(abrir) => !abrir && aoFechar()}>
      <DialogContent className="max-w-[calc(100%-1rem)] gap-3 p-3 sm:max-w-3xl sm:p-4">
        {foto && (
          <>
            <DialogHeader className="pr-10 text-left">
              <DialogTitle>{foto.titulo}</DialogTitle>
              <DialogDescription>{foto.descricao}</DialogDescription>
            </DialogHeader>
            <div className="flex min-h-40 items-center justify-center overflow-hidden rounded-md bg-black">
              {foto.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={foto.url}
                  alt={foto.alt}
                  width={foto.largura ?? undefined}
                  height={foto.altura ?? undefined}
                  className="h-auto max-h-[65dvh] w-auto max-w-full object-contain"
                />
              ) : (
                <p className="p-6 text-sm text-white/80">Não foi possível carregar a foto.</p>
              )}
            </div>
            {children}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                aria-label="Foto anterior"
                disabled={!aoAnterior}
                onClick={() => aoAnterior?.()}
              >
                <ChevronLeftIcon className="size-5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                aria-label="Foto seguinte"
                disabled={!aoSeguinte}
                onClick={() => aoSeguinte?.()}
              >
                <ChevronRightIcon className="size-5" />
              </Button>
              {acoes}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
