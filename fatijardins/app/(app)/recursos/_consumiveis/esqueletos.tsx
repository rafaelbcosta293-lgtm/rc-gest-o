import { Skeleton } from "@/components/ui/skeleton"

function Carregar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">A carregar…</span>
      {children}
    </div>
  )
}

/** Lista de consumíveis a carregar (filtros e linhas). */
export function EsqueletoListaConsumiveis() {
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
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </Carregar>
  )
}

/** Formulário do consumível a carregar. */
export function EsqueletoFormularioConsumivel() {
  return (
    <Carregar className="grid gap-5">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="grid gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-11 w-full md:h-10" />
        </div>
      ))}
      <Skeleton className="h-12 w-40" />
    </Carregar>
  )
}

/** Cabeçalho + formulário (editar, em que o título depende dos dados). */
export function EsqueletoPaginaFormularioConsumivel() {
  return (
    <div className="max-w-2xl">
      <Carregar>
        <div className="mb-5 flex flex-col gap-3 md:mb-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-64 max-w-full" />
        </div>
      </Carregar>
      <EsqueletoFormularioConsumivel />
    </div>
  )
}

/** Ficha do consumível a carregar. */
export function EsqueletoConsumivel() {
  return (
    <Carregar>
      <div className="mb-5 flex flex-col gap-3 md:mb-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-48 max-w-full" />
      </div>
      <div className="grid gap-4">
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    </Carregar>
  )
}
