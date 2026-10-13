import { FormularioPalavraPasse } from "@/components/formulario-palavra-passe"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata = { title: "Nova palavra-passe" }

export default function PaginaAtualizarPalavraPasse() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          <h1>Nova palavra-passe</h1>
        </CardTitle>
        <CardDescription>Escolha uma palavra-passe com pelo menos 8 caracteres.</CardDescription>
      </CardHeader>
      <CardContent>
        <FormularioPalavraPasse />
      </CardContent>
    </Card>
  )
}
