import { Skeleton } from "@/components/ui/skeleton"

/**
 * Esqueletos mostrados de imediato ao navegar, enquanto os dados chegam
 * (as páginas leem a sessão e a base de dados dentro de <Suspense>).
 */

function Carregar({ children }: { children: React.ReactNode }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">A carregar…</span>
      {children}
    </div>
  )
}

export function EsqueletoCabecalho() {
  return (
    <div className="mb-5 flex flex-col gap-3 md:mb-6">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-8 w-64 max-w-full" />
      <Skeleton className="h-4 w-40" />
    </div>
  )
}

export function EsqueletoListaCartoes() {
  return (
    <Carregar>
      <Skeleton className="mb-3 h-5 w-40" />
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </Carregar>
  )
}

export function EsqueletoFormulario({ comCabecalho = false }: { comCabecalho?: boolean }) {
  return (
    <Carregar>
      {comCabecalho && <EsqueletoCabecalho />}
      <div className="grid gap-5 rounded-xl border p-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="grid gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-11 w-full md:h-10" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-6 ml-auto h-12 w-40" />
    </Carregar>
  )
}

export function EsqueletoFicha() {
  return (
    <Carregar>
      <EsqueletoCabecalho />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl lg:col-span-2" />
      </div>
    </Carregar>
  )
}
