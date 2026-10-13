import { cn } from "@/lib/utils"

/** Símbolo (folha) da Fatijardins. Substitua por o logótipo oficial quando existir. */
export function SimboloFatijardins({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("size-8", className)}>
      <rect width="64" height="64" rx="16" fill="#15803d" />
      <path
        d="M47 15C30 15 18 24 18 38c0 4 1 7 3 10 2-9 8-17 17-22-7 6-11 13-13 23 3 1 5 1 8 1 13 0 19-11 17-35z"
        fill="#dcfce7"
      />
    </svg>
  )
}

export function Logotipo({ className, claro = false }: { className?: string; claro?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <SimboloFatijardins />
      <span
        className={cn(
          "text-lg font-semibold tracking-tight",
          claro ? "text-sidebar-foreground" : "text-foreground"
        )}
      >
        Fatijardins
      </span>
    </span>
  )
}
