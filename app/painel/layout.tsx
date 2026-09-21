import Link from 'next/link'

export default function PainelLayout({ children }: LayoutProps<'/painel'>) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 border-b border-black/10 bg-background dark:border-white/10">
        <div className="mx-auto flex max-w-4xl items-center px-4 py-2.5">
          <Link
            href="/painel"
            className="text-sm font-medium text-zinc-600 dark:text-zinc-400"
          >
            🏠 Início
          </Link>
        </div>
      </div>
      {children}
    </div>
  )
}
