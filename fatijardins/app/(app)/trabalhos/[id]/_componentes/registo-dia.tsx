"use client"

import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircleIcon, SaveIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { useAcaoFormulario } from "@/hooks/use-acao-formulario"
import { paraCampo } from "@/lib/validacao/comum"
import { esquemaRegisto, type CamposRegisto, type DadosRegisto } from "@/lib/validacao/registos"
import { guardarRegisto } from "../acoes"

type Props = {
  trabalhoId: string
  tarefasFeitas: string | null
  notas: string | null
  /** Ex.: "Atualizado por Rui Carvalho às 10:42" (calculado no servidor). */
  atualizado: string | null
}

/** Tarefas feitas e notas do dia (um só registo por trabalho). */
export function RegistoDia({ trabalhoId, tarefasFeitas, notas, atualizado }: Props) {
  const valores = useMemo<CamposRegisto>(
    () => ({ tarefas_feitas: paraCampo(tarefasFeitas), notas: paraCampo(notas) }),
    [tarefasFeitas, notas]
  )
  const form = useForm<CamposRegisto, unknown, DadosRegisto>({
    resolver: zodResolver(esquemaRegisto),
    defaultValues: valores,
    // Quando os dados do servidor mudam (ex.: um colega guardou, ou foi
    // guardada a assinatura), os campos acompanham, exceto os que a pessoa
    // está a escrever: o texto ainda por guardar nunca se perde.
    values: valores,
    resetOptions: { keepDirtyValues: true },
  })
  const { submeter, aGuardar } = useAcaoFormulario(form, (campos) => guardarRegisto(trabalhoId, campos))

  return (
    <Form {...form}>
      <form onSubmit={submeter} className="grid gap-4" noValidate>
        <FormField
          control={form.control}
          name="tarefas_feitas"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tarefas feitas</FormLabel>
              <FormControl>
                <Textarea rows={4} placeholder="Ex.: Relva cortada, sebes aparadas, folhas recolhidas." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notas"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas</FormLabel>
              <FormControl>
                <Textarea rows={3} placeholder="Avarias, pedidos do cliente, o que falta fazer…" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-2 sm:flex sm:items-center sm:gap-4">
          <Button type="submit" size="lg" disabled={aGuardar}>
            {aGuardar ? <LoaderCircleIcon className="animate-spin" /> : <SaveIcon />}
            Guardar registo
          </Button>
          {atualizado && <p className="text-sm text-muted-foreground">{atualizado}</p>}
        </div>
      </form>
    </Form>
  )
}
