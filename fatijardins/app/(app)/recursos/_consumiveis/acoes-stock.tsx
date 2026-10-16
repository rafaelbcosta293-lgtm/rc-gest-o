"use client"

import { useState } from "react"
import { ClipboardCheckIcon, PackageMinusIcon, PackagePlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FormularioAcerto, FormularioEntrada, FormularioSaida } from "./formularios-movimento"
import type { OpcaoTrabalho } from "./tipos"

type Acao = "entrada" | "saida" | "acerto"

const BOTOES: { acao: Acao; rotulo: string; icone: typeof PackagePlusIcon }[] = [
  { acao: "entrada", rotulo: "Registar entrada", icone: PackagePlusIcon },
  { acao: "saida", rotulo: "Registar saída", icone: PackageMinusIcon },
  { acao: "acerto", rotulo: "Acerto de inventário", icone: ClipboardCheckIcon },
]

type Props = {
  consumivelId: string
  unidade: string
  hoje: string
  stock: number
  precoAtual: number | null
  trabalhos: OpcaoTrabalho[]
}

/** Botões do gerente para mexer no stock; cada um abre o seu formulário por baixo. */
export function AcoesStock({ consumivelId, unidade, hoje, stock, precoAtual, trabalhos }: Props) {
  const [aberta, setAberta] = useState<Acao | null>(null)
  const fechar = () => setAberta(null)

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {BOTOES.map(({ acao, rotulo, icone: Icone }) => (
          <Button
            key={acao}
            type="button"
            size="lg"
            variant={aberta === acao ? "default" : "outline"}
            aria-expanded={aberta === acao}
            onClick={() => setAberta(aberta === acao ? null : acao)}
          >
            <Icone />
            {rotulo}
          </Button>
        ))}
      </div>
      {aberta === "entrada" && (
        <FormularioEntrada
          consumivelId={consumivelId}
          unidade={unidade}
          hoje={hoje}
          stock={stock}
          precoAtual={precoAtual}
          aoTerminar={fechar}
        />
      )}
      {aberta === "saida" && (
        <FormularioSaida
          consumivelId={consumivelId}
          unidade={unidade}
          hoje={hoje}
          stock={stock}
          trabalhos={trabalhos}
          aoTerminar={fechar}
        />
      )}
      {aberta === "acerto" && (
        <FormularioAcerto consumivelId={consumivelId} unidade={unidade} hoje={hoje} stock={stock} aoTerminar={fechar} />
      )}
    </div>
  )
}
