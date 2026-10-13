import { Skeleton } from "@/components/ui/skeleton"

/** Esqueletos do Início, mostrados logo enquanto os dados chegam. */

function Carregar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">A carregar…</span>
      {children}
    </div>
  )
}

export function EsqueletoPicagem() {
  return (
    <Carregar>
      <div className="grid gap-4 rounded-xl border p-4">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-6 w-full" />
      </div>
    </Carregar>
  )
}

export function EsqueletoTrabalhosHoje() {
  return (
    <Carregar className="grid gap-3">
      <Skeleton className="h-6 w-48" />
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-44 w-full rounded-xl" />
      ))}
    </Carregar>
  )
}

export function EsqueletoOMeuDia() {
  return (
    <div className="grid gap-6">
      <EsqueletoPicagem />
      <EsqueletoTrabalhosHoje />
    </div>
  )
}

export function EsqueletoResumo() {
  return (
    <Carregar className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-[74px] w-full rounded-xl" />
      ))}
    </Carregar>
  )
}

export function EsqueletoCartao() {
  return (
    <Carregar>
      <div className="grid gap-4 rounded-xl border p-5">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </Carregar>
  )
}

export function EsqueletoInicio() {
  return (
    <>
      <div className="mb-5 flex flex-col gap-2 md:mb-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-44" />
      </div>
      <EsqueletoOMeuDia />
    </>
  )
}
