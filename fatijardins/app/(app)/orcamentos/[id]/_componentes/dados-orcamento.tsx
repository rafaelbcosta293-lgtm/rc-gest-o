"use client"

import { useState } from "react"
import { PencilIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FormularioOrcamento } from "../../_componentes/formulario-orcamento"

type PropsFormulario = Omit<React.ComponentProps<typeof FormularioOrcamento>, "cancelarHref" | "aoTerminar"> & {
  orcamentoId: string
}

type Props = {
  /** Formulário de edição (só em rascunho); null = só de leitura. */
  formulario: PropsFormulario | null
  /** updated_at do orçamento: o formulário volta a montar se o orçamento mudar. */
  versao: string
  /** Os dados só de leitura (vêm do servidor). */
  children: React.ReactNode
}

/** Cartão "Dados do orçamento"; em rascunho, o botão Editar troca-o pelo formulário. */
export function DadosOrcamento({ formulario, versao, children }: Props) {
  const [aEditar, setAEditar] = useState(false)

  if (aEditar && formulario) {
    return (
      <section aria-labelledby="titulo-editar-dados" className="grid gap-3">
        <h2 id="titulo-editar-dados" className="text-lg font-semibold">
          Editar dados do orçamento
        </h2>
        <FormularioOrcamento key={versao} {...formulario} aoTerminar={() => setAEditar(false)} />
      </section>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Dados do orçamento</CardTitle>
        {formulario && (
          <CardAction>
            <Button variant="outline" size="lg" onClick={() => setAEditar(true)}>
              <PencilIcon />
              Editar
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="grid gap-5">{children}</CardContent>
    </Card>
  )
}
