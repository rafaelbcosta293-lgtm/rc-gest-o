"use client"

import { useLayoutEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { HammerIcon, LoaderCircleIcon } from "lucide-react"

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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { useAcaoFormulario } from "@/hooks/use-acao-formulario"
import { DATA_MAXIMA, DATA_MINIMA, eDataValida, feriadoNacional, formatarDiaLongo } from "@/lib/datas"
import { NOMES_TIPO_TRABALHO } from "@/lib/trabalhos"
import { esquemaConverter, type CamposConverter, type DadosConverter } from "@/lib/validacao/orcamentos"
import { TIPOS_TRABALHO } from "@/lib/validacao/trabalhos"
import { converterOrcamento } from "../../_componentes/acoes"
import { Opcoes } from "./opcoes"

type Props = {
  orcamentoId: string
  equipas: { id: string; nome: string }[]
  /** Próximo dia útil. */
  diaSugerido: string
}

const OPCOES_TIPO = TIPOS_TRABALHO.map((tipo) => ({ valor: tipo, nome: NOMES_TIPO_TRABALHO[tipo] }))

/** "Converter em trabalho" (gerente, orçamento aceite): escolhe o dia, a equipa, a hora e o tipo. */
export function ConverterTrabalho({ orcamentoId, equipas, diaSugerido }: Props) {
  const [aberto, setAberto] = useState(false)
  // Ao sair da página (que fica guardada escondida), fechar a janela.
  useLayoutEffect(() => () => setAberto(false), [])

  const form = useForm<CamposConverter, unknown, DadosConverter>({
    resolver: zodResolver(esquemaConverter),
    defaultValues: { data: diaSugerido, equipa_id: "", hora_inicio: "", tipo: "obra" },
  })
  const { submeter, aGuardar } = useAcaoFormulario(form, (valores) => converterOrcamento(orcamentoId, valores), {
    aoConcluir: () => setAberto(false),
  })
  const data = useWatch({ control: form.control, name: "data" })
  const feriado = eDataValida(data) ? feriadoNacional(data) : null

  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !aGuardar && setAberto(abrir)}>
      <DialogTrigger asChild>
        <Button size="lg">
          <HammerIcon />
          Converter em trabalho
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Converter em trabalho</DialogTitle>
          <DialogDescription>
            O trabalho fica na agenda com o cliente, o local e o título do orçamento. As tarefas previstas são a
            descrição e as linhas de mão de obra.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={submeter} className="grid gap-4" noValidate>
            <div className="grid items-start gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="data"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dia *</FormLabel>
                    <FormControl>
                      <Input type="date" min={DATA_MINIMA} max={DATA_MAXIMA} {...field} />
                    </FormControl>
                    {eDataValida(data) && (
                      <FormDescription>
                        {formatarDiaLongo(data)}
                        {feriado && ` (feriado: ${feriado})`}
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hora_inicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora de início</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="equipa_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Equipa</FormLabel>
                  <FormControl>
                    <NativeSelect {...field}>
                      <option value="">Por atribuir</option>
                      {equipas.map((equipa) => (
                        <option key={equipa.id} value={equipa.id}>
                          {equipa.nome}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Opcoes
                    nome={field.name}
                    rotulo="Tipo de trabalho"
                    valor={field.value}
                    opcoes={OPCOES_TIPO}
                    aoMudar={(valor) => field.onChange(valor)}
                    className="grid-cols-2"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" size="lg" disabled={aGuardar} onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="lg" disabled={aGuardar}>
                {aGuardar && <LoaderCircleIcon className="animate-spin" />}
                Criar trabalho
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
