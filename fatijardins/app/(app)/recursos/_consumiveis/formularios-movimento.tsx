"use client"

import { useForm, useWatch, type FieldValues, type UseFormReturn } from "react-hook-form"
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
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { useAcaoFormulario } from "@/hooks/use-acao-formulario"
import { DATA_MAXIMA, DATA_MINIMA } from "@/lib/datas"
import { formatarData, formatarMoeda } from "@/lib/formatar"
import { formatarQuantidade } from "@/lib/recursos"
import { paraCampo } from "@/lib/validacao/comum"
import {
  esquemaAcerto,
  esquemaEditarAcerto,
  esquemaEntrada,
  esquemaSaida,
  type CamposAcerto,
  type CamposEditarAcerto,
  type CamposEntrada,
  type CamposSaida,
  type DadosAcerto,
  type DadosEditarAcerto,
  type DadosEntrada,
  type DadosSaida,
} from "@/lib/validacao/consumiveis"
import { atualizarAcerto, atualizarEntrada, atualizarSaida, registarAcerto, registarEntrada, registarSaida } from "./acoes"
import type { MovimentoLista, OpcaoTrabalho } from "./tipos"

/** Quantidade sem sinal, com vírgula ("2,5"). */
function campoQuantidade(quantidade: number) {
  return paraCampo(Math.abs(quantidade))
}

/** Quantidade com sinal e unidade: "+200 m", "−15 m". */
export function quantidadeComSinal(quantidade: number, unidade: string) {
  return `${quantidade > 0 ? "+" : "−"}${formatarQuantidade(Math.abs(quantidade), unidade)}`
}

/** Painel do formulário (largo e com botões grandes, para o telemóvel). */
function Painel<T extends FieldValues>({
  form,
  titulo,
  submeter,
  aGuardar,
  textoGuardar,
  aoTerminar,
  children,
}: {
  form: UseFormReturn<T, unknown, unknown>
  titulo: string
  submeter: () => void
  aGuardar: boolean
  textoGuardar: string
  aoTerminar: () => void
  children: React.ReactNode
}) {
  return (
    <Form {...form}>
      <form
        onSubmit={submeter}
        noValidate
        aria-label={titulo}
        className="grid gap-4 rounded-xl border border-primary/40 bg-accent/30 p-4"
      >
        <p className="font-semibold">{titulo}</p>
        {children}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="lg" onClick={aoTerminar} disabled={aGuardar}>
            Cancelar
          </Button>
          <Button type="submit" size="lg" disabled={aGuardar}>
            {aGuardar && <LoaderCircleIcon className="animate-spin" />}
            {textoGuardar}
          </Button>
        </div>
      </form>
    </Form>
  )
}

/** Campo numérico com a unidade (ou €) dentro, à direita. */
function InputComSufixo({ sufixo, ...props }: React.ComponentProps<typeof Input> & { sufixo: string }) {
  return (
    <div className="relative">
      <Input inputMode="decimal" autoComplete="off" className="bg-background pr-16" {...props} />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
      >
        {sufixo}
      </span>
    </div>
  )
}

/** Stock que vai ficar (enquanto se escreve). */
function StockDepois({ stock, unidade }: { stock: number | null; unidade: string }) {
  return (
    <p className="text-sm" aria-live="polite">
      Stock depois: <strong className="tabular-nums">{stock === null ? "—" : formatarQuantidade(stock, unidade)}</strong>
    </p>
  )
}

function arredondar(valor: number) {
  return Math.round(valor * 1000) / 1000
}

// ---------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------

type PropsEntrada = {
  consumivelId: string
  unidade: string
  hoje: string
  /** Stock atual (para mostrar o que vai ficar; só ao registar). */
  stock: number
  /** Preço atual do consumível (sugestão). */
  precoAtual: number | null
  /** Ao editar: a entrada (sem ela, regista uma nova). */
  movimento?: MovimentoLista
  aoTerminar: () => void
}

export function FormularioEntrada({ consumivelId, unidade, hoje, stock, precoAtual, movimento, aoTerminar }: PropsEntrada) {
  const form = useForm<CamposEntrada, unknown, DadosEntrada>({
    resolver: zodResolver(esquemaEntrada),
    defaultValues: {
      quantidade: movimento ? campoQuantidade(movimento.quantidade) : "",
      data: movimento?.data ?? hoje,
      preco_unitario: movimento?.precoUnitario != null ? movimento.precoUnitario.toFixed(2).replace(".", ",") : "",
      // Ao registar, o preço da compra passa a ser o do consumível (pode desmarcar).
      atualizar_preco: !movimento,
      notas: paraCampo(movimento?.notas),
    },
  })
  const { submeter, aGuardar } = useAcaoFormulario(
    form,
    (valores) => (movimento ? atualizarEntrada(movimento.id, valores) : registarEntrada(consumivelId, valores)),
    {
      aoConcluir: () => {
        form.reset()
        aoTerminar()
      },
    }
  )
  const [quantidade, preco] = useWatch({ control: form.control, name: ["quantidade", "preco_unitario"] })
  const q = esquemaEntrada.shape.quantidade.safeParse(quantidade)
  const temPreco = preco.trim() !== ""

  return (
    <Painel
      form={form}
      titulo={movimento ? "Editar entrada" : "Registar entrada"}
      submeter={submeter}
      aGuardar={aGuardar}
      textoGuardar={movimento ? "Guardar" : "Registar entrada"}
      aoTerminar={aoTerminar}
    >
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="quantidade"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quantidade *</FormLabel>
              <FormControl>
                <InputComSufixo sufixo={unidade} placeholder="Ex.: 25" autoFocus {...field} />
              </FormControl>
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
        <FormField
          control={form.control}
          name="preco_unitario"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Preço unitário</FormLabel>
              <FormControl>
                <InputComSufixo
                  sufixo={`€/${unidade}`}
                  placeholder={precoAtual === null ? "Ex.: 1,85" : `Atual: ${precoAtual.toFixed(2).replace(".", ",")}`}
                  {...field}
                />
              </FormControl>
              <FormDescription>Opcional: o preço desta compra.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {!movimento && temPreco && (
          <FormField
            control={form.control}
            name="atualizar_preco"
            render={({ field }) => (
              <FormItem className="sm:pt-7">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-background px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 accent-primary"
                    checked={field.value}
                    onChange={(evento) => field.onChange(evento.target.checked)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                  <span>
                    Atualizar o preço do consumível
                    {precoAtual !== null && (
                      <span className="block text-xs text-muted-foreground">Atual: {formatarMoeda(precoAtual)}</span>
                    )}
                  </span>
                </label>
              </FormItem>
            )}
          />
        )}
      </div>
      <FormField
        control={form.control}
        name="notas"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Notas</FormLabel>
            <FormControl>
              <Textarea rows={2} className="min-h-16 bg-background" placeholder="Ex.: Fornecedor, n.º da fatura" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {!movimento && <StockDepois stock={q.success ? arredondar(stock + q.data) : null} unidade={unidade} />}
    </Painel>
  )
}

// ---------------------------------------------------------------------
// Saída
// ---------------------------------------------------------------------

type PropsSaida = {
  consumivelId: string
  unidade: string
  hoje: string
  stock: number
  /** Trabalhos dos últimos 30 dias e dos próximos 7. */
  trabalhos: OpcaoTrabalho[]
  movimento?: MovimentoLista
  aoTerminar: () => void
}

export function FormularioSaida({ consumivelId, unidade, hoje, stock, trabalhos, movimento, aoTerminar }: PropsSaida) {
  const form = useForm<CamposSaida, unknown, DadosSaida>({
    resolver: zodResolver(esquemaSaida),
    defaultValues: {
      quantidade: movimento ? campoQuantidade(movimento.quantidade) : "",
      data: movimento?.data ?? hoje,
      trabalho_id: movimento?.trabalho?.id ?? "",
      notas: paraCampo(movimento?.notas),
    },
  })
  const { submeter, aGuardar } = useAcaoFormulario(
    form,
    (valores) => (movimento ? atualizarSaida(movimento.id, valores) : registarSaida(consumivelId, valores)),
    {
      aoConcluir: () => {
        form.reset()
        aoTerminar()
      },
    }
  )
  const quantidade = useWatch({ control: form.control, name: "quantidade" })
  const q = esquemaSaida.shape.quantidade.safeParse(quantidade)
  // O trabalho já ligado pode ser mais antigo do que a lista.
  const opcoes =
    movimento?.trabalho && !trabalhos.some((trabalho) => trabalho.id === movimento.trabalho?.id)
      ? [movimento.trabalho, ...trabalhos]
      : trabalhos

  return (
    <Painel
      form={form}
      titulo={movimento ? "Editar saída" : "Registar saída"}
      submeter={submeter}
      aGuardar={aGuardar}
      textoGuardar={movimento ? "Guardar" : "Registar saída"}
      aoTerminar={aoTerminar}
    >
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="quantidade"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quantidade *</FormLabel>
              <FormControl>
                <InputComSufixo sufixo={unidade} placeholder="Ex.: 5" autoFocus {...field} />
              </FormControl>
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
        name="trabalho_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Trabalho</FormLabel>
            <FormControl>
              <NativeSelect className="bg-background" {...field}>
                <option value="">Sem trabalho</option>
                {opcoes.map((trabalho) => (
                  <option key={trabalho.id} value={trabalho.id}>
                    {formatarData(trabalho.data)}
                    {trabalho.data === hoje ? " (hoje)" : ""} — {trabalho.descricao}
                  </option>
                ))}
              </NativeSelect>
            </FormControl>
            <FormDescription>
              Opcional: trabalhos dos últimos 30 dias e dos próximos 7. O material escolhido do stock na ficha do
              trabalho (marcado “Do stock”) já sai sozinho: registe aqui só o resto.
            </FormDescription>
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
              <Textarea
                rows={2}
                className="min-h-16 bg-background"
                placeholder="Ex.: Estragado, oferecido ao cliente"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {!movimento && <StockDepois stock={q.success ? arredondar(stock - q.data) : null} unidade={unidade} />}
    </Painel>
  )
}

// ---------------------------------------------------------------------
// Acerto de inventário
// ---------------------------------------------------------------------

type PropsAcerto = {
  consumivelId: string
  unidade: string
  hoje: string
  stock: number
  aoTerminar: () => void
}

/** O gerente indica o stock contado; grava-se a diferença para o stock da app. */
export function FormularioAcerto({ consumivelId, unidade, hoje, stock, aoTerminar }: PropsAcerto) {
  const form = useForm<CamposAcerto, unknown, DadosAcerto>({
    resolver: zodResolver(esquemaAcerto),
    defaultValues: { stock_contado: "", data: hoje, notas: "" },
  })
  const { submeter, aGuardar } = useAcaoFormulario(form, (valores) => registarAcerto(consumivelId, valores), {
    aoConcluir: () => {
      form.reset()
      aoTerminar()
    },
  })
  const contado = useWatch({ control: form.control, name: "stock_contado" })
  const c = esquemaAcerto.shape.stock_contado.safeParse(contado)
  const diferenca = c.success ? arredondar(c.data - stock) : null

  return (
    <Painel
      form={form}
      titulo="Acerto de inventário"
      submeter={submeter}
      aGuardar={aGuardar}
      textoGuardar="Registar acerto"
      aoTerminar={aoTerminar}
    >
      <p className="text-sm">
        Stock na app: <strong className="tabular-nums">{formatarQuantidade(stock, unidade)}</strong>. Indique quanto
        contou no armazém; a diferença fica registada como acerto.
      </p>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="stock_contado"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Stock contado *</FormLabel>
              <FormControl>
                <InputComSufixo sufixo={unidade} placeholder="Ex.: 40" autoFocus {...field} />
              </FormControl>
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
        name="notas"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Notas</FormLabel>
            <FormControl>
              <Textarea rows={2} className="min-h-16 bg-background" placeholder="Ex.: Inventário de outubro" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <p className="text-sm" aria-live="polite">
        {diferenca === null ? (
          <>
            Diferença: <strong>—</strong>
          </>
        ) : diferenca === 0 ? (
          <strong>O stock já está certo.</strong>
        ) : (
          <>
            Diferença: <strong className="tabular-nums">{quantidadeComSinal(diferenca, unidade)}</strong>
          </>
        )}
      </p>
    </Painel>
  )
}

/** Corrigir um acerto já gravado: a diferença com sinal. */
export function FormularioEditarAcerto({
  unidade,
  movimento,
  aoTerminar,
}: {
  unidade: string
  movimento: MovimentoLista
  aoTerminar: () => void
}) {
  const form = useForm<CamposEditarAcerto, unknown, DadosEditarAcerto>({
    resolver: zodResolver(esquemaEditarAcerto),
    defaultValues: {
      quantidade: paraCampo(movimento.quantidade),
      data: movimento.data,
      notas: paraCampo(movimento.notas),
    },
  })
  const { submeter, aGuardar } = useAcaoFormulario(form, (valores) => atualizarAcerto(movimento.id, valores), {
    aoConcluir: () => {
      form.reset()
      aoTerminar()
    },
  })

  return (
    <Painel
      form={form}
      titulo="Editar acerto"
      submeter={submeter}
      aGuardar={aGuardar}
      textoGuardar="Guardar"
      aoTerminar={aoTerminar}
    >
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="quantidade"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Diferença *</FormLabel>
              {/* Teclado de texto: o teclado decimal do iPhone não tem o sinal menos. */}
              <FormControl>
                <InputComSufixo sufixo={unidade} inputMode="text" placeholder="Ex.: -3" autoFocus {...field} />
              </FormControl>
              <FormDescription>Positiva soma ao stock; negativa (com -) tira.</FormDescription>
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
        name="notas"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Notas</FormLabel>
            <FormControl>
              <Textarea rows={2} className="min-h-16 bg-background" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Painel>
  )
}
