import { Suspense } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FormularioLogin } from "./formulario-login"

export const metadata = { title: "Entrar" }

export default function PaginaLogin() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Entrar</CardTitle>
        <CardDescription>Use o email e a palavra-passe que o gerente lhe deu.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense>
          <FormularioLogin />
        </Suspense>
      </CardContent>
    </Card>
  )
}
