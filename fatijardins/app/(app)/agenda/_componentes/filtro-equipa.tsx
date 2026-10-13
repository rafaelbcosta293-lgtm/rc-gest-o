"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircleIcon } from "lucide-react"

import { NativeSelect } from "@/components/ui/native-select"
import { urlAgenda, type ParametrosAgenda } from "./tipos"

type Props = {
  parametros: ParametrosAgenda
  hoje: string
  equipas: { id: string; nome: string }[]
}

/** Filtro de equipa da agenda (muda o ?equipa= do endereço). */
export function FiltroEquipa({ parametros, hoje, equipas }: Props) {
  const router = useRouter()
  const [aFiltrar, iniciar] = useTransition()

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="filtro-equipa" className="shrink-0 text-sm font-medium">
        Equipa
      </label>
      <div className="w-full sm:w-64">
        <NativeSelect
          // Volta a montar quando o endereço muda (o Next.js guarda a página escondida).
          key={parametros.equipa}
          id="filtro-equipa"
          defaultValue={parametros.equipa}
          onChange={(evento) => {
            const equipa = evento.target.value
            iniciar(() => router.push(urlAgenda({ ...parametros, equipa }, hoje)))
          }}
        >
          <option value="todas">Todas as equipas</option>
          {equipas.map((equipa) => (
            <option key={equipa.id} value={equipa.id}>
              {equipa.nome}
            </option>
          ))}
        </NativeSelect>
      </div>
      {aFiltrar && <LoaderCircleIcon className="size-4 shrink-0 animate-spin text-muted-foreground" />}
    </div>
  )
}
