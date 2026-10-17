import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** 553.5 → "553,50" (para os campos de valor). */
export function valorParaCampo(valor: number): string {
  return valor.toFixed(2).replace(".", ",")
}

/** Campo de valor em euros (teclado decimal, € à direita). */
export function InputEuros({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <Input inputMode="decimal" autoComplete="off" className={cn("pr-10 tabular-nums", className)} {...props} />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
      >
        €
      </span>
    </div>
  )
}
