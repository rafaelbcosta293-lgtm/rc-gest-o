import { Suspense } from "react"
import Link from "next/link"

import { Logotipo } from "@/components/logotipo"
import { Navegacao, NavegacaoEsqueleto } from "@/components/navegacao/navegacao"

export default function LayoutApp({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh md:flex">
      <Suspense fallback={<NavegacaoEsqueleto />}>
        <Navegacao />
      </Suspense>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
          <Link href="/" aria-label="Início">
            <Logotipo />
          </Link>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-10">
          {children}
        </main>
      </div>
    </div>
  )
}
