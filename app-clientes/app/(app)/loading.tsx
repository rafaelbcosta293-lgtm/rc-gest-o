// Esqueleto mostrado de imediato ao mudar de separador, enquanto os
// dados chegam.
export default function ACarregar() {
  return (
    <div aria-busy="true" aria-label="A carregar" className="animate-pulse pt-3">
      <div className="h-8 w-44 rounded-lg bg-zinc-200/80" />
      <div className="mt-2.5 h-4 w-64 max-w-full rounded bg-zinc-200/60" />
      <div className="mt-8 h-3.5 w-24 rounded bg-zinc-200/60" />
      <div className="mt-3 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-surface ring-1 ring-border" />
        ))}
      </div>
    </div>
  )
}
