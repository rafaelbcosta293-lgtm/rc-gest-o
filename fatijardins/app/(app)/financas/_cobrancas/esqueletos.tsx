import { Skeleton } from "@/components/ui/skeleton"

function Carregar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">A carregar…</span>
      {children}
    </div>
  )
}

/** Lista de cobranças ou de pagamentos a carregar (totais, filtros e linhas). */
export function EsqueletoListaCobrancas() {
  return (
    <Carregar>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
      <div className="mb-4 flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-28 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="grid gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </Carregar>
  )
}

/** Formulário da cobrança a carregar. */
export function EsqueletoFormularioCobranca() {
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
export function EsqueletoPaginaFormularioCobranca() {
  return (
    <div className="max-w-3xl">
      <Carregar>
        <div className="mb-5 flex flex-col gap-3 md:mb-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-64 max-w-full" />
        </div>
      </Carregar>
      <EsqueletoFormularioCobranca />
    </div>
  )
}

/** Ficha da cobrança a carregar. */
export function EsqueletoCobranca() {
  return (
    <Carregar>
      <div className="mb-5 flex flex-col gap-3 md:mb-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-48 max-w-full" />
      </div>
      <div className="grid gap-4">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </Carregar>
  )
}
