import { Skeleton } from "@/components/ui/skeleton"

function Carregar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">A carregar…</span>
      {children}
    </div>
  )
}

/** Lista de orçamentos a carregar (filtros e cartões). */
export function EsqueletoListaOrcamentos() {
  return (
    <Carregar>
      <div className="mb-4 flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <Skeleton className="mb-3 h-5 w-32" />
      <div className="grid gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </Carregar>
  )
}

/** Formulário do orçamento a carregar. */
export function EsqueletoFormularioOrcamento() {
  return (
    <Carregar className="grid gap-6">
      {[2, 2, 4].map((campos, i) => (
        <div key={i} className="grid gap-4 rounded-xl border p-5">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: campos }, (_, j) => (
            <div key={j} className="grid gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-11 w-full md:h-10" />
            </div>
          ))}
        </div>
      ))}
      <Skeleton className="h-12 w-40" />
    </Carregar>
  )
}

/** Página do orçamento a carregar. */
export function EsqueletoOrcamento() {
  return (
    <Carregar>
      <div className="mb-5 flex flex-col gap-3 md:mb-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-80 max-w-full" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="grid gap-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    </Carregar>
  )
}
