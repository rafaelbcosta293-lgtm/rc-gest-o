"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircleIcon } from "lucide-react"

import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"

type Pessoa = { id: string; nome: string; equipa: string | null; ativo: boolean }

type Props = {
  pessoas: Pessoa[]
  atual: string
  mes: string
}

/** Escolher de quem é o mapa (chefe: a sua equipa; gerente: todos). */
export function SeletorPessoa({ pessoas, atual, mes }: Props) {
  const router = useRouter()
  const [aMudar, iniciar] = useTransition()

  // Agrupadas por equipa; os inativos só aparecem se forem o escolhido.
  const grupos = new Map<string, Pessoa[]>()
  for (const pessoa of pessoas) {
    if (!pessoa.ativo && pessoa.id !== atual) continue
    const chave = pessoa.equipa ?? "Sem equipa"
    grupos.set(chave, [...(grupos.get(chave) ?? []), pessoa])
  }
  const nomesGrupos = [...grupos.keys()].sort((a, b) =>
    a === "Sem equipa" ? 1 : b === "Sem equipa" ? -1 : a.localeCompare(b, "pt")
  )

  return (
    <div className="grid gap-1.5">
      <Label htmlFor="seletor-pessoa" className="flex items-center gap-2">
        Colaborador
        {aMudar && <LoaderCircleIcon className="size-3.5 animate-spin" aria-label="A carregar" />}
      </Label>
      <NativeSelect
        id="seletor-pessoa"
        value={atual}
        onChange={(e) => {
          const parametros = new URLSearchParams({ mes, colaborador: e.target.value })
          iniciar(() => router.push(`/horas?${parametros}`, { scroll: false }))
        }}
      >
        {nomesGrupos.map((grupo) => (
          <optgroup key={grupo} label={grupo}>
            {grupos.get(grupo)?.map((pessoa) => (
              <option key={pessoa.id} value={pessoa.id}>
                {pessoa.nome}
                {pessoa.ativo ? "" : " (inativo)"}
              </option>
            ))}
          </optgroup>
        ))}
      </NativeSelect>
    </div>
  )
}
