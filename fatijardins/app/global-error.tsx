"use client"

import "./globals.css"

/** Último recurso: erro no próprio layout principal. Tem de ter <html> e <body>. */
export default function ErroGlobal({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="pt-PT">
      <body className="flex min-h-dvh items-center justify-center bg-background px-4 font-sans text-foreground">
        <title>Erro · Fatijardins</title>
        <main className="max-w-sm text-center">
          <h1 className="text-xl font-semibold">Ocorreu um erro</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Não foi possível abrir a Fatijardins. Verifique a ligação à internet e tente de novo.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            className="mt-6 h-11 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground"
          >
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  )
}
