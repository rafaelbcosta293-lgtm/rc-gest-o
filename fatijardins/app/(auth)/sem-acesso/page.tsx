import { Suspense } from "react"
import { redirect } from "next/navigation"
import { ShieldOffIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { obterEstadoSessao } from "@/lib/auth"

export const metadata = { title: "Sem acesso" }

async function Conteudo() {
  const estado = await obterEstadoSessao()
  if (estado.estado === "sem_sessao") redirect("/login")
  if (estado.estado === "ok") redirect("/")

  return (
    <CardDescription>
      A conta <strong>{estado.email}</strong> não está associada a nenhum colaborador ativo. Peça
      ao gerente para ativar o seu acesso.
    </CardDescription>
  )
}

export default function PaginaSemAcesso() {
  return (
    <Card>
      <CardHeader>
        <ShieldOffIcon className="mb-2 size-8 text-muted-foreground" />
        <CardTitle className="text-xl">
          <h1>Sem acesso à app</h1>
        </CardTitle>
        <Suspense fallback={<CardDescription>A verificar…</CardDescription>}>
          <Conteudo />
        </Suspense>
      </CardHeader>
      <CardContent>
        <form action="/auth/sair" method="post">
          <Button type="submit" variant="outline" className="w-full">
            Terminar sessão
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
