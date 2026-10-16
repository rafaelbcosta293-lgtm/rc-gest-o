import { Skeleton } from "@/components/ui/skeleton"

function Carregar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">A carregar…</span>
      {children}
    </div>
  )
}

/** Lista de equipamentos a carregar (filtros e linhas). */
export function EsqueletoListaEquipamentos() {
  return (
    <Carregar>
      <div className="mb-4 flex gap-2 overflow-hidden">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-28 shrink-0 rounded-full" />
        ))}
      </div>
      <Skeleton className="mb-3 h-5 w-32" />
      <div className="grid gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full md:h-16" />
        ))}
      </div>
    </Carregar>
  )
}

/** Formulário do equipamento a carregar. */
export function EsqueletoFormularioEquipamento() {
  return (
    <Carregar className="grid gap-6">
      {[4, 3, 3].map((campos, i) => (
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

/** Ficha do equipamento a carregar. */
export function EsqueletoEquipamento() {
  return (
    <Carregar>
      <div className="mb-5 flex flex-col gap-3 md:mb-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </Carregar>
  )
}
