"use client"

import { ImageIcon } from "lucide-react"

/** Miniatura quadrada de uma foto; ao tocar abre-a em grande. */
export function MiniaturaFoto({ url, rotulo, aoAbrir }: { url: string | null; rotulo: string; aoAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={aoAbrir}
      className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      aria-label={rotulo}
    >
      {url ? (
        // URLs assinados do Storage (privados e temporários): sem otimização do next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <ImageIcon className="size-6 text-muted-foreground" aria-hidden="true" />
      )}
    </button>
  )
}
