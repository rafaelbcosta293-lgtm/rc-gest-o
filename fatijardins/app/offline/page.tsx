import type { Metadata } from "next"
import { WifiOffIcon } from "lucide-react"

import { Logotipo } from "@/components/logotipo"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BotaoTentarDeNovo } from "./botao-tentar-de-novo"

export const metadata: Metadata = {
  title: "Sem ligação",
  robots: { index: false, follow: false },
}

/**
 * Página estática (sem sessão nem dados) que o service worker guarda e
 * mostra quando não há rede.
 */
export default function PaginaSemLigacao() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-accent to-background px-4 py-10">
      <div className="mb-8">
        <Logotipo className="scale-125" />
      </div>
      <Card className="w-full max-w-sm text-center">
        <CardHeader className="justify-items-center">
          <span className="mb-2 flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <WifiOffIcon className="size-7" aria-hidden="true" />
          </span>
          <CardTitle className="text-xl">
            <h1>Sem ligação à internet</h1>
          </CardTitle>
          <CardDescription>
            Não foi possível abrir a página. Verifique os dados móveis ou o Wi-Fi e tente de novo.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <BotaoTentarDeNovo />
          <p className="text-sm text-muted-foreground">
            A página volta a abrir sozinha quando a ligação regressar.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
