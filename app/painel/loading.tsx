export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse px-4 py-10">
      <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-4 h-7 w-56 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-2 h-4 w-72 rounded bg-zinc-200 dark:bg-zinc-800" />

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl border border-black/10 bg-zinc-100 dark:border-white/10 dark:bg-zinc-900"
          />
        ))}
      </div>
    </div>
  )
}
