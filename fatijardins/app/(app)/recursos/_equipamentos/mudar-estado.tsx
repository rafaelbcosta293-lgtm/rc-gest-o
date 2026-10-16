"use client"

import { useLayoutEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  ArchiveIcon,
  ArrowRightLeftIcon,
  CircleCheckIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"

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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { useAcaoFormulario } from "@/hooks/use-acao-formulario"
import { NOMES_ESTADO_EQUIPAMENTO, type EstadoEquipamento } from "@/lib/recursos"
import { cn } from "@/lib/utils"
import { esquemaMudarEstado, type CamposMudarEstado, type DadosMudarEstado } from "@/lib/validacao/equipamentos"
import { mudarEstadoEquipamento } from "./acoes"

const ICONE_ESTADO: Record<EstadoEquipamento, LucideIcon> = {
  operacional: CircleCheckIcon,
  avariado: TriangleAlertIcon,
  em_reparacao: WrenchIcon,
  abatido: ArchiveIcon,
}

type Props = {
  equipamentoId: string
  nome: string
  estadoAtual: EstadoEquipamento
  /** Estados que se podem escolher (o chefe não abate). */
  estados: EstadoEquipamento[]
}

/**
 * "Mudar estado": botões grandes (para usar no campo) e uma nota opcional,
 * que fica acrescentada às notas do equipamento.
 */
export function MudarEstado({ equipamentoId, nome, estadoAtual, estados }: Props) {
  const [aberto, setAberto] = useState(false)
  // Ao sair da página (que fica guardada escondida), fechar a janela.
  useLayoutEffect(() => () => setAberto(false), [])

  const form = useForm<CamposMudarEstado, unknown, DadosMudarEstado>({
    resolver: zodResolver(esquemaMudarEstado),
    defaultValues: { estado: estadoAtual, nota: "" },
  })
  const { submeter, aGuardar } = useAcaoFormulario(form, (valores) => mudarEstadoEquipamento(equipamentoId, valores), {
    aoConcluir: () => {
      setAberto(false)
      form.reset({ estado: form.getValues("estado"), nota: "" })
    },
  })

  function abrirOuFechar(abrir: boolean) {
    if (aGuardar) return
    // Abre sempre com o estado atual e sem nota.
    if (abrir) form.reset({ estado: estadoAtual, nota: "" })
    setAberto(abrir)
  }

  return (
    <Dialog open={aberto} onOpenChange={abrirOuFechar}>
      <DialogTrigger asChild>
        <Button size="lg" variant="outline">
          <ArrowRightLeftIcon />
          Mudar estado
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mudar estado</DialogTitle>
          <DialogDescription>{nome}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={submeter} className="grid gap-4" noValidate>
            <FormField
              control={form.control}
              name="estado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <div
                    role="radiogroup"
                    aria-label="Estado do equipamento"
                    className={cn("grid gap-2", estados.length === 4 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3")}
                  >
                    {estados.map((estado) => {
                      const Icone = ICONE_ESTADO[estado]
                      const escolhido = field.value === estado
                      return (
                        <label
                          key={estado}
                          className={cn(
                            "flex h-14 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-base font-medium transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50 sm:flex-col sm:gap-1 sm:h-20 sm:text-sm",
                            escolhido ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
                          )}
                        >
                          <input
                            type="radio"
                            name={field.name}
                            value={estado}
                            checked={escolhido}
                            onChange={() => field.onChange(estado)}
                            className="sr-only"
                          />
                          <Icone className="size-5 shrink-0" aria-hidden="true" />
                          {NOMES_ESTADO_EQUIPAMENTO[estado]}
                          {estado === estadoAtual && <span className="text-xs font-normal opacity-80">(atual)</span>}
                        </label>
                      )
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nota"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nota</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Ex.: a corrente salta ao arrancar; levada à oficina." {...field} />
                  </FormControl>
                  <FormDescription>Opcional. Fica nas notas do equipamento, com a data e o seu nome.</FormDescription>
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
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
