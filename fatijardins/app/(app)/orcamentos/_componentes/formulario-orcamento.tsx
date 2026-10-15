"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ClipboardListIcon, CopyIcon, LoaderCircleIcon, MapPinIcon, UnlinkIcon } from "lucide-react"
import { toast } from "sonner"

import type { OpcaoLocal } from "@/app/(app)/trabalhos/_componentes/formulario-trabalho"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { DATA_MAXIMA, DATA_MINIMA, eDataValida, somarDiasData } from "@/lib/datas"
import { formatarData } from "@/lib/formatar"
import { esquemaOrcamento, type CamposOrcamento, type DadosOrcamento } from "@/lib/validacao/orcamentos"
import { atualizarOrcamento, criarOrcamento } from "./acoes"

/** Visita ligada ao orçamento, como o formulário a mostra. */
export type VisitaOrigem = {
  id: string
  data: string
  localId: string
  /** Medidas, área e notas da visita (para copiar para a descrição), ou null. */
  resumo: string | null
}

type Props = {
  valoresIniciais: CamposOrcamento
  clientes: { id: string; nome: string }[]
  locais: OpcaoLocal[]
  /** Validade proposta pela empresa (dias depois da data). */
  validadeDias: number
  visita: VisitaOrigem | null
  /** Ao editar: o orçamento (sem ele, o formulário cria). */
  orcamentoId?: string
  /** Novo: para onde vai o "Cancelar". */
  cancelarHref?: string
  /** Edição na página do orçamento: fechar o formulário (cancelar ou depois de guardar). */
  aoTerminar?: () => void
}

function diasEntre(inicio: string, fim: string) {
  return Math.round((Date.parse(fim) - Date.parse(inicio)) / 86_400_000)
}

export function FormularioOrcamento({
  valoresIniciais,
  clientes,
  locais,
  validadeDias,
  visita,
  orcamentoId,
  cancelarHref,
  aoTerminar,
}: Props) {
  const form = useForm<CamposOrcamento, unknown, DadosOrcamento>({
    resolver: zodResolver(esquemaOrcamento),
    defaultValues: valoresIniciais,
  })
  // A validade acompanha a data enquanto a pessoa não a mudar à mão.
  const validadeProposta = (data: string) => (eDataValida(data) ? somarDiasData(data, validadeDias) : "")
  const [validadeAutomatica, setValidadeAutomatica] = useState(
    () => valoresIniciais.validade === validadeProposta(valoresIniciais.data)
  )

  const { submeter, aGuardar } = useAcaoFormulario(
    form,
    (valores) => (orcamentoId ? atualizarOrcamento(orcamentoId, valores) : criarOrcamento(valores)),
    {
      aoConcluir: () => {
        if (orcamentoId) return aoTerminar?.()
        // A página "Novo orçamento" fica guardada pelo Next.js: limpar depois de criar.
        form.reset()
        setValidadeAutomatica(valoresIniciais.validade === validadeProposta(valoresIniciais.data))
      },
    }
  )

  const [clienteId, localId, visitaId, data, validade] = useWatch({
    control: form.control,
    name: ["cliente_id", "local_id", "visita_id", "data", "validade"],
  })
  const visitaLigada = visita && visitaId === visita.id ? visita : null

  // Locais do cliente (os desativados só aparecem se já forem os do orçamento).
  const locaisDoCliente = locais.filter(
    (local) => local.clienteId === clienteId && (local.ativo || local.id === valoresIniciais.local_id)
  )
  const localEscolhido = locais.find((local) => local.id === localId)
  const diasValidade = eDataValida(data) && eDataValida(validade) ? diasEntre(data, validade) : null

  function escolherCliente(novoCliente: string) {
    const opcoes = locais.filter((local) => local.clienteId === novoCliente && local.ativo)
    // Com um só local, fica escolhido.
    form.setValue("local_id", opcoes.length === 1 ? opcoes[0].id : "", {
      shouldValidate: form.formState.isSubmitted,
    })
  }

  function copiarDaVisita() {
    if (!visitaLigada?.resumo) return
    const atual = form.getValues("descricao").trim()
    form.setValue("descricao", atual ? `${atual}\n\n${visitaLigada.resumo}` : visitaLigada.resumo, {
      shouldDirty: true,
      shouldValidate: form.formState.isSubmitted,
    })
    toast.success("Medidas e notas da visita copiadas para a descrição.")
  }

  return (
    <Form {...form}>
      <form onSubmit={submeter} className="grid gap-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Cliente e local</CardTitle>
          </CardHeader>
          <CardContent className="grid items-start gap-4 sm:grid-cols-2">
            {visitaLigada && (
              <div className="grid gap-3 rounded-lg bg-accent/60 p-3 text-sm text-accent-foreground sm:col-span-2">
                <p className="flex items-start gap-2">
                  <ClipboardListIcon className="mt-0.5 size-4 shrink-0" />
                  <span>
                    A partir da{" "}
                    <Link
                      href={`/orcamentos/visitas/${visitaLigada.id}`}
                      className="font-medium underline underline-offset-4"
                    >
                      visita de {formatarData(visitaLigada.data)}
                    </Link>
                    . O cliente e o local são os da visita.
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {visitaLigada.resumo && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-auto min-h-10 max-w-full shrink bg-background py-2 text-left whitespace-normal"
                      onClick={copiarDaVisita}
                    >
                      <CopyIcon />
                      Copiar medidas e notas para a descrição
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => form.setValue("visita_id", "", { shouldDirty: true })}
                  >
                    <UnlinkIcon />
                    Desligar da visita
                  </Button>
                </div>
              </div>
            )}
            <FormField
              control={form.control}
              name="cliente_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente *</FormLabel>
                  <FormControl>
                    <NativeSelect
                      {...field}
                      disabled={!!visitaLigada}
                      onChange={(evento) => {
                        field.onChange(evento)
                        escolherCliente(evento.target.value)
                      }}
                    >
                      <option value="">Escolha o cliente</option>
                      {clientes.map((cliente) => (
                        <option key={cliente.id} value={cliente.id}>
                          {cliente.nome}
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
              name="local_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Local *</FormLabel>
                  <FormControl>
                    <NativeSelect {...field} disabled={!clienteId || !!visitaLigada}>
                      <option value="">
                        {!clienteId
                          ? "Escolha primeiro o cliente"
                          : locaisDoCliente.length === 0
                            ? "Este cliente não tem locais"
                            : "Escolha o local"}
                      </option>
                      {locaisDoCliente.map((local) => (
                        <option key={local.id} value={local.id}>
                          {local.nome}
                          {local.ativo ? "" : " (desativado)"}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormControl>
                  {localEscolhido && (
                    <FormDescription className="flex items-start gap-1.5">
                      <MapPinIcon className="mt-0.5 size-3.5 shrink-0" />
                      {localEscolhido.morada}
                    </FormDescription>
                  )}
                  {clienteId && locaisDoCliente.length === 0 && (
                    <FormDescription>
                      <Link
                        href={`/clientes/${clienteId}/locais/novo`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Acrescentar um local a este cliente
                      </Link>
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orçamento</CardTitle>
          </CardHeader>
          <CardContent className="grid items-start gap-4">
            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título *</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" placeholder="Ex.: Arranjo do jardim da entrada" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição / âmbito</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={5}
                      placeholder="O que inclui o trabalho (ex.: limpeza do terreno, plantação da sebe e instalação da rega)."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Aparece no PDF, antes das linhas.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datas e condições</CardTitle>
          </CardHeader>
          <CardContent className="grid items-start gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="data"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data *</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      min={DATA_MINIMA}
                      max={DATA_MAXIMA}
                      {...field}
                      onChange={(evento) => {
                        field.onChange(evento)
                        const nova = evento.target.value
                        if (validadeAutomatica && eDataValida(nova)) {
                          form.setValue("validade", validadeProposta(nova), {
                            shouldValidate: form.formState.isSubmitted,
                          })
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
              name="validade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Válido até *</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      min={eDataValida(data) ? data : DATA_MINIMA}
                      max={DATA_MAXIMA}
                      {...field}
                      onChange={(evento) => {
                        field.onChange(evento)
                        setValidadeAutomatica(false)
                      }}
                    />
                  </FormControl>
                  {diasValidade !== null && diasValidade >= 0 && (
                    <FormDescription>
                      {diasValidade === 1 ? "1 dia" : `${diasValidade} dias`} depois da data do orçamento.
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="condicoes"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Condições</FormLabel>
                  <FormControl>
                    <Textarea rows={4} placeholder="Pagamento, prazos de execução, garantia…" {...field} />
                  </FormControl>
                  <FormDescription>Aparecem no PDF.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notas_internas"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Notas internas</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Ex.: confirmar a pressão da água antes de começar." {...field} />
                  </FormControl>
                  <FormDescription>Só para a empresa: não aparecem no PDF.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          {orcamentoId ? (
            <Button type="button" variant="outline" size="lg" onClick={aoTerminar} disabled={aGuardar}>
              Cancelar
            </Button>
          ) : (
            <Button asChild type="button" variant="outline" size="lg">
              <Link href={cancelarHref ?? "/orcamentos"}>Cancelar</Link>
            </Button>
          )}
          <Button type="submit" size="lg" disabled={aGuardar}>
            {aGuardar && <LoaderCircleIcon className="animate-spin" />}
            {orcamentoId ? "Guardar" : "Criar orçamento"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
