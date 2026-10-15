import { Skeleton } from "@/components/ui/skeleton"

/** Esqueletos das páginas de visitas, mostrados de imediato enquanto os dados chegam. */

function Carregar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">A carregar…</span>
      {children}
    </div>
  )
}

function Cabecalho() {
  return (
    <div className="mb-5 flex flex-col gap-3 md:mb-6">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-8 w-64 max-w-full" />
      <Skeleton className="h-4 w-48" />
    </div>
  )
}

export function EsqueletoListaVisitas() {
  return (
    <Carregar>
      <Skeleton className="mb-3 h-5 w-32" />
      <div className="grid gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[4.5rem] w-full" />
        ))}
      </div>
    </Carregar>
  )
}

export function EsqueletoFormularioVisita() {
  return (
    <Carregar className="grid gap-6">
      {[2, 3, 3].map((campos, i) => (
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

/** Página de edição a carregar (o título depende dos dados). */
export function EsqueletoEditarVisita() {
  return (
    <div className="max-w-3xl">
      <Cabecalho />
      <EsqueletoFormularioVisita />
    </div>
  )
}

export function EsqueletoVisita() {
  return (
    <Carregar>
      <Cabecalho />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
      <Skeleton className="mt-4 h-56 w-full rounded-xl" />
    </Carregar>
  )
}
