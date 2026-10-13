import { Skeleton } from "@/components/ui/skeleton"

/** Mostrado de imediato ao abrir a ficha, enquanto os dados chegam. */
export function EsqueletoTrabalho() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">A carregar…</span>
      <div className="mb-5 flex flex-col gap-3 md:mb-6">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-48" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl lg:row-span-2" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
      <Skeleton className="mt-4 h-48 w-full rounded-xl" />
    </div>
  )
}
