import { Suspense } from "react"
import { LogOutIcon, SmartphoneIcon } from "lucide-react"

import { terminarSessao } from "@/app/(auth)/acoes"
import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { FormularioPalavraPasse } from "@/components/formulario-palavra-passe"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { exigirSessao } from "@/lib/auth"
import { NOMES_PERFIL } from "@/lib/perfis"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Perfil" }

// A página em si não lê dados: o título aparece logo e os dados da sessão
// chegam dentro de <Suspense> (navegação instantânea com Cache Components).
export default function PaginaPerfil() {
  return (
    <>
      <CabecalhoPagina titulo="Perfil" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
          <DadosPerfil />
        </Suspense>

        <Card>
          <CardHeader>
            <CardTitle>Mudar palavra-passe</CardTitle>
          </CardHeader>
          <CardContent>
            <FormularioPalavraPasse redirecionar={false} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SmartphoneIcon className="size-5" />
              Instalar no telemóvel
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Android (Chrome):</strong> menu ⋮ → “Instalar
              aplicação” ou “Adicionar ao ecrã principal”.
            </p>
            <p>
              <strong className="text-foreground">iPhone (Safari):</strong> botão Partilhar →
              “Adicionar ao ecrã principal”.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

async function DadosPerfil() {
  const sessao = await exigirSessao()
  const supabase = await createClient()
  const { data: equipa } = sessao.colaborador.equipaId
    ? await supabase.from("equipas").select("nome").eq("id", sessao.colaborador.equipaId).maybeSingle()
    : { data: null }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{sessao.colaborador.nome}</CardTitle>
        <CardDescription>{sessao.email}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Perfil</dt>
          <dd>
            <Badge variant="secondary">{NOMES_PERFIL[sessao.colaborador.perfil]}</Badge>
          </dd>
          <dt className="text-muted-foreground">Função</dt>
          <dd>{sessao.colaborador.funcao || "—"}</dd>
          <dt className="text-muted-foreground">Equipa</dt>
          <dd>{equipa?.nome ?? "—"}</dd>
        </dl>
        <form action={terminarSessao} className="mt-6">
          <Button type="submit" variant="outline" size="lg" className="w-full sm:w-fit">
            <LogOutIcon />
            Terminar sessão
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
