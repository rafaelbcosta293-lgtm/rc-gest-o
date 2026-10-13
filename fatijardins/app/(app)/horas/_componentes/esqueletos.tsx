import { Skeleton } from "@/components/ui/skeleton"

/** Esqueleto do mapa mensal, mostrado logo enquanto as horas chegam. */
export function EsqueletoMapa() {
  return (
    <div aria-busy="true" aria-live="polite" className="grid gap-5">
      <span className="sr-only">A carregar…</span>
      <div className="flex flex-wrap items-end gap-3">
        <Skeleton className="h-11 w-full sm:w-64" />
        <Skeleton className="h-12 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className={i === 0 ? "col-span-2 h-20 rounded-xl lg:col-span-1" : "h-20 rounded-xl"} />
        ))}
      </div>
      <div className="grid gap-2 rounded-xl border p-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}
