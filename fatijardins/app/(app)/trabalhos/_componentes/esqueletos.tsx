import { Skeleton } from "@/components/ui/skeleton"

/** Formulário de trabalho a carregar. */
export function EsqueletoFormularioTrabalho() {
  return (
    <div aria-busy="true" aria-live="polite" className="grid gap-6">
      <span className="sr-only">A carregar…</span>
      {[2, 3, 4].map((campos, i) => (
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
    </div>
  )
}

/** Página de edição a carregar (o título depende dos dados). */
export function EsqueletoEditarTrabalho() {
  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex flex-col gap-3 md:mb-6">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-48" />
      </div>
      <EsqueletoFormularioTrabalho />
    </div>
  )
}
