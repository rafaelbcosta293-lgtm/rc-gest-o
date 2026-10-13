import { Skeleton } from "@/components/ui/skeleton"

/** Mostrado de imediato enquanto a agenda carrega. */
export function EsqueletoAgenda() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">A carregar a agenda…</span>
      <Skeleton className="mb-4 h-11 w-full sm:w-80 md:h-10" />
      {/* PC: grelha */}
      <div className="hidden overflow-hidden rounded-xl border md:block">
        <div className="grid grid-cols-7 gap-px bg-border">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex justify-center bg-card py-2">
              <Skeleton className="h-10 w-10" />
            </div>
          ))}
          {Array.from({ length: 2 }, (_, linha) => (
            <div key={linha} className="contents">
              <div className="col-span-7 bg-card px-3 py-2">
                <Skeleton className="h-4 w-32" />
              </div>
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="grid min-h-24 content-start gap-1 bg-card p-1">
                  {(i + linha) % 3 !== 2 && <Skeleton className="h-16 w-full" />}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      {/* Telemóvel: lista */}
      <div className="grid gap-6 md:hidden">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="grid gap-2">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  )
}
