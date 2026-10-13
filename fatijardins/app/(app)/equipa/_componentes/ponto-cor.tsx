import { cn } from "@/lib/utils"

/** Bolinha com a cor da equipa. */
export function PontoCor({ cor, className }: { cor: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2.5 shrink-0 rounded-full ring-1 ring-black/10", className)}
      style={{ backgroundColor: cor }}
    />
  )
}
