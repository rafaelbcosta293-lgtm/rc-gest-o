"use client"

import { createContext, use, useLayoutEffect, useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCheckIcon, LoaderCircleIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { useAcaoFormulario } from "@/hooks/use-acao-formulario"
import type { ResultadoAcao } from "@/lib/acoes"
import { esquemaPeriodo, type CamposPeriodo, type DadosPeriodo } from "@/lib/validacao/horas"
import { adicionarPeriodo, apagarPeriodo, editarPeriodo, marcarRevisto } from "../acoes"

/** Período tal como aparece no formulário (horas de Lisboa). */
export type PeriodoEditavel = {
  id: string
  data: string
  entrada: string
  /** "" se ainda estiver aberto. */
  saida: string
  trabalhoId: string | null
  /** Texto do trabalho atual (caso não esteja na lista dos trabalhos do mês). */
  trabalhoRotulo: string
  notas: string | null
}

/** Trabalho do mês que se pode associar a um período. */
export type TrabalhoDoMes = { id: string; data: string; rotulo: string }

type ValorContexto = { abrir: (periodo: PeriodoEditavel | null) => void }

const ContextoEditor = createContext<ValorContexto | null>(null)

function useEditor() {
  const valor = use(ContextoEditor)
  if (!valor) throw new Error("Os botões do editor têm de estar dentro de <EditorPeriodos>.")
  return valor
}

type Props = {
  colaboradorId: string
  nome: string
  trabalhos: TrabalhoDoMes[]
  /** Data proposta ao adicionar (hoje, se for o mês mostrado). */
  dataSugerida: string
  children: React.ReactNode
}

/**
 * Correções do gerente: um só diálogo para adicionar e editar períodos,
 * aberto pelos botões <BotaoAdicionarPeriodo> e <BotaoEditarPeriodo>.
 */
export function EditorPeriodos({ colaboradorId, nome, trabalhos, dataSugerida, children }: Props) {
  const [aberto, setAberto] = useState(false)
  const [periodo, setPeriodo] = useState<PeriodoEditavel | null>(null)
  const [confirmarApagar, setConfirmarApagar] = useState(false)
  const [aApagar, iniciarApagar] = useTransition()

  const vazio: CamposPeriodo = {
    colaboradorId,
    data: dataSugerida,
    entrada: "",
    saida: "",
    aberto: false,
    trabalhoId: "",
    notas: "",
  }
  const form = useForm<CamposPeriodo, unknown, DadosPeriodo>({
    resolver: zodResolver(esquemaPeriodo),
    defaultValues: vazio,
  })
  const { submeter, aGuardar } = useAcaoFormulario(
    form,
    (valores) => (periodo ? editarPeriodo(periodo.id, valores) : adicionarPeriodo(valores)),
    { aoConcluir: () => setAberto(false) }
  )
  const data = useWatch({ control: form.control, name: "data" })
  const periodoAberto = useWatch({ control: form.control, name: "aberto" })

  // Diálogos passageiros: fechados se a página ficar escondida (navegação).
  useLayoutEffect(() => {
    return () => {
      setAberto(false)
      setConfirmarApagar(false)
    }
  }, [])

  function abrir(escolhido: PeriodoEditavel | null) {
    setPeriodo(escolhido)
    form.reset(
      escolhido
        ? {
            colaboradorId,
            data: escolhido.data,
            entrada: escolhido.entrada,
            saida: escolhido.saida,
            aberto: escolhido.saida === "",
            trabalhoId: escolhido.trabalhoId ?? "",
            notas: escolhido.notas ?? "",
          }
        : vazio
    )
    setAberto(true)
  }

  const opcoes = trabalhos.filter((trabalho) => trabalho.data === data)
  if (periodo?.trabalhoId && periodo.data === data && !opcoes.some((opcao) => opcao.id === periodo.trabalhoId)) {
    opcoes.unshift({ id: periodo.trabalhoId, data, rotulo: periodo.trabalhoRotulo })
  }

  function apagar() {
    if (!periodo) return
    iniciarApagar(async () => {
      let resultado: ResultadoAcao
      try {
        resultado = await apagarPeriodo(periodo.id)
      } catch {
        toast.error("Não foi possível comunicar com o servidor. Verifique a ligação à internet.")
        return
      }
      if (!resultado.ok) {
        toast.error(resultado.erro)
        return
      }
      toast.success(resultado.mensagem ?? "Apagado.")
      setConfirmarApagar(false)
      setAberto(false)
    })
  }

  const ocupado = aGuardar || aApagar

  return (
    <ContextoEditor value={{ abrir }}>
      {children}

      <Dialog open={aberto} onOpenChange={(abrirDialogo) => !ocupado && setAberto(abrirDialogo)}>
        <DialogContent>
          <Form {...form}>
            <form onSubmit={submeter} className="grid gap-4" noValidate>
              <DialogHeader>
                <DialogTitle>{periodo ? "Editar período" : "Adicionar período"}</DialogTitle>
                <DialogDescription>{nome} · horas de Portugal continental</DialogDescription>
              </DialogHeader>

              <FormField
                control={form.control}
                name="data"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e)
                          // O trabalho tem de ser desse dia.
                          const trabalhoId = form.getValues("trabalhoId")
                          if (trabalhoId && !trabalhos.some((t) => t.id === trabalhoId && t.data === e.target.value)) {
                            form.setValue("trabalhoId", "")
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="entrada"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entrada</FormLabel>
                      <FormControl>
                        <Input type="time" step={60} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="saida"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Saída</FormLabel>
                      <FormControl>
                        <Input type="time" step={60} {...field} />
                      </FormControl>
                      {periodoAberto && <FormDescription>Vazio = ainda a trabalhar.</FormDescription>}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="trabalhoId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trabalho</FormLabel>
                    <FormControl>
                      <NativeSelect {...field}>
                        <option value="">Sem trabalho (armazém, deslocação…)</option>
                        {opcoes.map((opcao) => (
                          <option key={opcao.id} value={opcao.id}>
                            {opcao.rotulo}
                          </option>
                        ))}
                      </NativeSelect>
                    </FormControl>
                    {opcoes.length === 0 && <FormDescription>Não há trabalhos nesse dia.</FormDescription>}
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
                      <Textarea rows={2} placeholder="Opcional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2 sm:justify-between">
                {periodo ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmarApagar(true)}
                    disabled={ocupado}
                  >
                    <Trash2Icon />
                    Apagar
                  </Button>
                ) : (
                  <span className="hidden sm:block" />
                )}
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <Button type="button" variant="outline" size="lg" onClick={() => setAberto(false)} disabled={ocupado}>
                    Cancelar
                  </Button>
                  <Button type="submit" size="lg" disabled={ocupado}>
                    {aGuardar && <LoaderCircleIcon className="animate-spin" />}
                    Guardar
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarApagar} onOpenChange={(abrirDialogo) => !aApagar && setConfirmarApagar(abrirDialogo)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar este período?</AlertDialogTitle>
            <AlertDialogDescription>
              {periodo &&
                `${periodo.entrada}${periodo.saida ? `–${periodo.saida}` : ""} de ${periodo.data.split("-").reverse().join("/")}. Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={aApagar} className="h-12">
              Cancelar
            </AlertDialogCancel>
            <Button variant="destructive" size="lg" onClick={apagar} disabled={aApagar}>
              {aApagar && <LoaderCircleIcon className="animate-spin" />}
              Apagar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ContextoEditor>
  )
}

export function BotaoAdicionarPeriodo() {
  const { abrir } = useEditor()
  return (
    <Button size="lg" onClick={() => abrir(null)}>
      <PlusIcon />
      Adicionar período
    </Button>
  )
}

export function BotaoEditarPeriodo({ periodo }: { periodo: PeriodoEditavel }) {
  const { abrir } = useEditor()
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-11 shrink-0 text-muted-foreground"
      onClick={() => abrir(periodo)}
      aria-label={`Editar o período ${periodo.entrada}${periodo.saida ? `–${periodo.saida}` : ""}`}
    >
      <PencilIcon />
    </Button>
  )
}

/** "Marcar como revisto": o gerente confirma um período a rever sem o alterar. */
export function BotaoRevisto({ id }: { id: string }) {
  const [aCorrer, iniciar] = useTransition()

  function marcar() {
    iniciar(async () => {
      let resultado: ResultadoAcao
      try {
        resultado = await marcarRevisto(id)
      } catch {
        toast.error("Não foi possível comunicar com o servidor. Verifique a ligação à internet.")
        return
      }
      if (resultado.ok) toast.success(resultado.mensagem ?? "Marcado como revisto.")
      else toast.error(resultado.erro)
    })
  }

  return (
    <Button variant="outline" size="sm" className="h-11" onClick={marcar} disabled={aCorrer}>
      {aCorrer ? <LoaderCircleIcon className="animate-spin" /> : <CheckCheckIcon />}
      Marcar como revisto
    </Button>
  )
}
