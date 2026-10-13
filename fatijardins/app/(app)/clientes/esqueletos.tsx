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
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-8 w-64 max-w-full" />
      <Skeleton className="h-4 w-40" />
    </div>
  )
}

export function EsqueletoLista() {
  return (
    <Carregar>
      <Skeleton className="mb-3 h-5 w-32" />
      <div className="grid gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </Carregar>
  )
}

export function EsqueletoFormulario() {
  return (
    <Carregar>
      <div className="grid gap-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="grid gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-11 w-full md:h-10" />
          </div>
        ))}
        <Skeleton className="h-12 w-40" />
      </div>
    </Carregar>
  )
}

export function EsqueletoFicha() {
  return (
    <Carregar>
      <EsqueletoCabecalho />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
      <Skeleton className="mt-8 mb-3 h-6 w-40" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    </Carregar>
  )
}

/** Cabeçalho + formulário (páginas de edição, em que o título depende dos dados). */
export function EsqueletoPaginaFormulario() {
  return (
    <div className="max-w-2xl">
      <EsqueletoCabecalho />
      <EsqueletoFormulario />
    </div>
  )
}
