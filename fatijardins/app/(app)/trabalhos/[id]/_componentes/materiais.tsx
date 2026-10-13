"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircleIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { useAcaoFormulario } from "@/hooks/use-acao-formulario"
import {
  esquemaMaterial,
  UNIDADES_MATERIAL,
  type CamposMaterial,
  type DadosMaterial,
} from "@/lib/validacao/registos"
import { adicionarMaterial, apagarMaterial } from "../acoes"
import { Confirmar } from "./confirmar"

export type MaterialGasto = {
  id: string
  descricao: string
  /** Quantidade já formatada à portuguesa ("2,5"). */
  quantidade: string
  unidade: string
}

const VAZIO: CamposMaterial = { descricao: "", quantidade: "", unidade: "un" }

/** Lista dos materiais gastos, com formulário para acrescentar. */
export function Materiais({ trabalhoId, materiais }: { trabalhoId: string; materiais: MaterialGasto[] }) {
  const form = useForm<CamposMaterial, unknown, DadosMaterial>({
    resolver: zodResolver(esquemaMaterial),
    defaultValues: VAZIO,
  })
  const { submeter, aGuardar } = useAcaoFormulario(form, (campos) => adicionarMaterial(trabalhoId, campos), {
    // Fica pronto para o material seguinte.
    aoConcluir: () => form.reset(VAZIO),
  })

  return (
    <div className="grid gap-5">
      {materiais.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ainda não foram registados materiais.</p>
      ) : (
        <ul className="divide-y rounded-lg border" aria-label="Materiais gastos">
          {materiais.map((material) => (
            <li key={material.id} className="flex items-center gap-3 py-1 pr-1 pl-3">
              <span className="min-w-16 shrink-0 font-semibold tabular-nums">
                {material.quantidade} {material.unidade}
              </span>
              <span className="min-w-0 flex-1 break-words">{material.descricao}</span>
              <Confirmar
                gatilho={
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Apagar ${material.descricao}`}
                  >
                    <Trash2Icon className="size-5" />
                  </Button>
                }
                titulo="Apagar este material?"
                descricao={`${material.quantidade} ${material.unidade} de ${material.descricao}`}
                confirmar="Apagar"
                acao={() => apagarMaterial(trabalhoId, material.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <Form {...form}>
        <form onSubmit={submeter} className="grid gap-3" noValidate aria-label="Adicionar material">
          <FormField
            control={form.control}
            name="descricao"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Material *</FormLabel>
                <FormControl>
                  <Input placeholder="Ex.: Adubo granulado" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 items-start gap-3">
            <FormField
              control={form.control}
              name="quantidade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade *</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" placeholder="Ex.: 2,5" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unidade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidade</FormLabel>
                  <FormControl>
                    <NativeSelect {...field}>
                      {UNIDADES_MATERIAL.map((unidade) => (
                        <option key={unidade} value={unidade}>
                          {unidade}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button type="submit" size="lg" variant="secondary" disabled={aGuardar} className="sm:w-fit">
            {aGuardar ? <LoaderCircleIcon className="animate-spin" /> : <PlusIcon />}
            Adicionar material
          </Button>
        </form>
      </Form>
    </div>
  )
}
