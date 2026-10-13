import Link from "next/link"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FormularioRecuperar } from "./formulario-recuperar"

export const metadata = { title: "Recuperar palavra-passe" }

export default function PaginaRecuperar() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Recuperar palavra-passe</CardTitle>
        <CardDescription>
          Indique o seu email. Vai receber uma ligação para definir uma nova palavra-passe.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <FormularioRecuperar />
        <Link
          href="/login"
          className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Voltar ao login
        </Link>
      </CardContent>
    </Card>
  )
}
