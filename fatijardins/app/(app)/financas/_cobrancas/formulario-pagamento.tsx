"use client"

import { useId } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
import { useAcaoFormulario } from "@/hooks/use-acao-formulario"
import { DATA_MAXIMA, DATA_MINIMA } from "@/lib/datas"
import { METODOS_PAGAMENTO, NOMES_METODO_PAGAMENTO, type MetodoPagamento } from "@/lib/financas"
import { formatarMoeda } from "@/lib/formatar"
import { cn } from "@/lib/utils"
import { esquemaPagamento, type CamposPagamento, type DadosPagamento } from "@/lib/validacao/cobrancas"
import { atualizarPagamento, registarPagamento } from "./acoes"
import { InputEuros, valorParaCampo } from "./campos"

/** Um pagamento como a ficha da cobrança o mostra. */
export type PagamentoLista = {
  id: string
  data: string
  valor: number
  metodo: MetodoPagamento
  referencia: string | null
  notas: string | null
  autor: string | null
  updatedAt: string
}

type Props = {
  cobrancaId: string
  hoje: string
  /** Em dívida (valor proposto ao registar). */
  emDivida: number
  /** Ao editar: o pagamento (sem ele, regista um novo). */
  pagamento?: PagamentoLista
  aoTerminar: () => void
}

/** Registar ou corrigir um pagamento (largo e com botões grandes, para o telemóvel). */
export function FormularioPagamento({ cobrancaId, hoje, emDivida, pagamento, aoTerminar }: Props) {
  const form = useForm<CamposPagamento, unknown, DadosPagamento>({
    resolver: zodResolver(esquemaPagamento),
    defaultValues: {
      data: pagamento?.data ?? hoje,
      valor: valorParaCampo(pagamento?.valor ?? emDivida),
      metodo: pagamento?.metodo ?? "transferencia",
      referencia: pagamento?.referencia ?? "",
      notas: pagamento?.notas ?? "",
    },
  })
  const { submeter, aGuardar } = useAcaoFormulario(
    form,
    (valores) => (pagamento ? atualizarPagamento(pagamento.id, valores) : registarPagamento(cobrancaId, valores)),
    {
      aoConcluir: () => {
        form.reset()
        aoTerminar()
      },
    }
  )
  const titulo = pagamento ? "Editar pagamento" : "Registar pagamento"
  const idMetodo = useId()

  return (
    <Form {...form}>
      <form
        onSubmit={submeter}
        noValidate
        aria-label={titulo}
        className="grid gap-4 rounded-xl border border-primary/40 bg-accent/30 p-4"
      >
        <p className="font-semibold">{titulo}</p>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="valor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor recebido *</FormLabel>
                <FormControl>
                  <InputEuros className="bg-background" autoFocus {...field} />
                </FormControl>
                {!pagamento && <FormDescription>Em dívida: {formatarMoeda(emDivida)}.</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="data"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data *</FormLabel>
                <FormControl>
                  <Input type="date" min={DATA_MINIMA} max={DATA_MAXIMA} className="bg-background" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="metodo"
          render={({ field }) => (
            <FormItem>
              <p id={idMetodo} className="text-sm leading-none font-medium">
                Como pagou *
              </p>
              <FormControl>
                <div role="radiogroup" aria-labelledby={idMetodo} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {METODOS_PAGAMENTO.map((metodo) => {
                    const escolhido = field.value === metodo
                    return (
                      <button
                        key={metodo}
                        type="button"
                        role="radio"
                        aria-checked={escolhido}
                        onClick={() => field.onChange(metodo)}
                        className={cn(
                          "flex h-12 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors md:h-10",
                          escolhido
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-background hover:bg-accent"
                        )}
                      >
                        {NOMES_METODO_PAGAMENTO[metodo]}
                      </button>
                    )
                  })}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="referencia"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Referência</FormLabel>
                <FormControl>
                  <Input autoComplete="off" className="bg-background" placeholder="Ex.: n.º da transferência, recibo" {...field} />
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
                  <Textarea rows={1} className="min-h-11 bg-background md:min-h-10" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="lg" onClick={aoTerminar} disabled={aGuardar}>
            Cancelar
          </Button>
          <Button type="submit" size="lg" disabled={aGuardar}>
            {aGuardar && <LoaderCircleIcon className="animate-spin" />}
            {pagamento ? "Guardar" : "Registar pagamento"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
