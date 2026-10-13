"use client"

import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarPlusIcon, LoaderCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { useAcaoFormulario } from "@/hooks/use-acao-formulario"
import { NOMES_TIPO_AUSENCIA, TIPOS_AUSENCIA } from "@/lib/rotulos"
import { esquemaAusencia, type CamposAusencia, type DadosAusencia } from "@/lib/validacao/equipa"
import { marcarAusencia } from "../../acoes"

/** Botão + diálogo para o gerente marcar uma ausência (férias, doença…). */
export function MarcarAusencia({
  colaboradorId,
  nome,
  hoje,
}: {
  colaboradorId: string
  nome: string
  /** Data de hoje em Lisboa (aaaa-mm-dd), calculada no servidor. */
  hoje: string
}) {
  const [aberto, setAberto] = useState(false)
  const valoresIniciais: CamposAusencia = {
    colaboradorId,
    tipo: "ferias",
    dataInicio: hoje,
    dataFim: hoje,
    notas: "",
  }
  const form = useForm<CamposAusencia, unknown, DadosAusencia>({
    resolver: zodResolver(esquemaAusencia),
    defaultValues: valoresIniciais,
  })
  const { submeter, aGuardar } = useAcaoFormulario(form, marcarAusencia, {
    aoConcluir: () => setAberto(false),
  })
  const dataInicio = useWatch({ control: form.control, name: "dataInicio" })

  function mudar(abrir: boolean) {
    if (aGuardar) return
    if (abrir) form.reset(valoresIniciais)
    setAberto(abrir)
  }

  return (
    <Dialog open={aberto} onOpenChange={mudar}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full sm:w-fit">
          <CalendarPlusIcon />
          Marcar ausência
        </Button>
      </DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={submeter} className="grid gap-4" noValidate>
            <DialogHeader>
              <DialogTitle>Marcar ausência</DialogTitle>
              <DialogDescription>{nome}</DialogDescription>
            </DialogHeader>
            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <FormControl>
                    <NativeSelect {...field}>
                      {TIPOS_AUSENCIA.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {NOMES_TIPO_AUSENCIA[tipo]}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="dataInicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de início</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e)
                          // Se o fim ficar antes do início, acompanha o início.
                          const inicio = e.target.value
                          if (inicio && form.getValues("dataFim") < inicio) {
                            form.setValue("dataFim", inicio, { shouldValidate: form.formState.isSubmitted })
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dataFim"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de fim</FormLabel>
                    <FormControl>
                      <Input type="date" min={dataInicio || undefined} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Opcional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" size="lg" onClick={() => mudar(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="lg" disabled={aGuardar}>
                {aGuardar && <LoaderCircleIcon className="animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
