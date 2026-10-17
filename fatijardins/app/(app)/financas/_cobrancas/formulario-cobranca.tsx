"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { FileTextIcon, LoaderCircleIcon, MapPinIcon } from "lucide-react"

import type { OpcaoLocal } from "@/app/(app)/trabalhos/_componentes/formulario-trabalho"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { formatarMoeda } from "@/lib/formatar"
import {
  DIAS_VENCIMENTO,
  esquemaCobranca,
  type CamposCobranca,
  type DadosCobranca,
} from "@/lib/validacao/cobrancas"
import { atualizarCobranca, criarCobranca } from "./acoes"
import { InputEuros, valorParaCampo } from "./campos"

/** Orçamento aceite de onde vem a cobrança (cliente e local só de leitura). */
export type OrcamentoCobranca = {
  id: string
  numero: string
  titulo: string
  total: number
  /** Soma das cobranças já criadas para este orçamento. */
  jaCobrado: number
  cliente: string
  local: string | null
}

type Props = {
  valoresIniciais: CamposCobranca
  /** Nova cobrança avulsa: clientes e locais para escolher. */
  clientes?: { id: string; nome: string }[]
  locais?: OpcaoLocal[]
  orcamento?: OrcamentoCobranca | null
  /** Ao editar: a cobrança e o que já não se altera (cliente, local, origem). */
  edicao?: { cobrancaId: string; resumo: React.ReactNode }
  cancelarHref: string
}

const LIGACAO = "font-medium text-primary underline-offset-4 hover:underline"

export function FormularioCobranca({ valoresIniciais, clientes = [], locais = [], orcamento, edicao, cancelarHref }: Props) {
  const form = useForm<CamposCobranca, unknown, DadosCobranca>({
    resolver: zodResolver(esquemaCobranca),
    defaultValues: valoresIniciais,
  })
  // O vencimento acompanha a emissão enquanto a pessoa não o mudar à mão.
  const vencimentoProposto = (data: string) => (eDataValida(data) ? somarDiasData(data, DIAS_VENCIMENTO) : "")
  const [vencimentoAutomatico, setVencimentoAutomatico] = useState(
    () => !edicao && valoresIniciais.data_vencimento === vencimentoProposto(valoresIniciais.data_emissao)
  )

  const { submeter, aGuardar } = useAcaoFormulario(
    form,
    (valores) => (edicao ? atualizarCobranca(edicao.cobrancaId, valores) : criarCobranca(valores)),
    {
      aoConcluir: () => {
        // A página "Nova cobrança" fica guardada pelo Next.js: limpar depois de criar.
        if (!edicao) form.reset()
      },
    }
  )

  const [clienteId, localId, dataEmissao] = useWatch({
    control: form.control,
    name: ["cliente_id", "local_id", "data_emissao"],
  })
  const locaisDoCliente = locais.filter(
    (local) => local.clienteId === clienteId && (local.ativo || local.id === valoresIniciais.local_id)
  )
  const localEscolhido = locais.find((local) => local.id === localId)
  const avulsaNova = !edicao && !orcamento

  function definirValor(valor: number) {
    form.setValue("valor", valorParaCampo(valor), { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
  }
  const falta = orcamento ? Math.round((orcamento.total - orcamento.jaCobrado) * 100) / 100 : 0

  return (
    <Form {...form}>
      <form onSubmit={submeter} className="grid gap-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle>{orcamento ? "Orçamento" : "Cliente"}</CardTitle>
            {orcamento && <CardDescription>O cliente e o local são os do orçamento.</CardDescription>}
          </CardHeader>
          <CardContent className="grid items-start gap-4 sm:grid-cols-2">
            {orcamento && (
              <dl className="grid gap-4 text-sm sm:col-span-2 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Orçamento</dt>
                  <dd className="mt-0.5 font-medium break-words">
                    <Link href={`/orcamentos/${orcamento.id}`} className={LIGACAO}>
                      {orcamento.numero} — {orcamento.titulo}
                    </Link>
                    <span className="block font-normal text-muted-foreground tabular-nums">
                      Total {formatarMoeda(orcamento.total)}
                      {orcamento.jaCobrado > 0 && ` · já há cobranças de ${formatarMoeda(orcamento.jaCobrado)}`}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Cliente</dt>
                  <dd className="mt-0.5 font-medium break-words">{orcamento.cliente}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Local</dt>
                  <dd className="mt-0.5 font-medium break-words">{orcamento.local ?? "—"}</dd>
                </div>
              </dl>
            )}
            {edicao && !orcamento && <div className="sm:col-span-2">{edicao.resumo}</div>}
            {avulsaNova && (
              <>
                <FormField
                  control={form.control}
                  name="cliente_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente *</FormLabel>
                      <FormControl>
                        <NativeSelect
                          {...field}
                          onChange={(evento) => {
                            field.onChange(evento)
                            form.setValue("local_id", "")
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
                      <FormLabel>Local</FormLabel>
                      <FormControl>
                        <NativeSelect {...field} disabled={!clienteId || locaisDoCliente.length === 0}>
                          <option value="">
                            {!clienteId
                              ? "Escolha primeiro o cliente"
                              : locaisDoCliente.length === 0
                                ? "Este cliente não tem locais"
                                : "Sem local (opcional)"}
                          </option>
                          {locaisDoCliente.map((local) => (
                            <option key={local.id} value={local.id}>
                              {local.nome}
                              {local.ativo ? "" : " (desativado)"}
                            </option>
                          ))}
                        </NativeSelect>
                      </FormControl>
                      {localEscolhido ? (
                        <FormDescription className="flex items-start gap-1.5">
                          <MapPinIcon className="mt-0.5 size-3.5 shrink-0" />
                          {localEscolhido.morada}
                        </FormDescription>
                      ) : (
                        <FormDescription>Opcional: o jardim a que se refere.</FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cobrança</CardTitle>
          </CardHeader>
          <CardContent className="grid items-start gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Descrição *</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" placeholder="Ex.: Revisão da rega e substituição de aspersores" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="valor"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Valor total, com IVA *</FormLabel>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,16rem)_1fr] sm:items-center">
                    <FormControl>
                      <InputEuros placeholder="Ex.: 553,50" {...field} />
                    </FormControl>
                    {orcamento && (
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" className="h-11 md:h-10" onClick={() => definirValor(orcamento.total)}>
                          100%
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 md:h-10"
                          onClick={() => definirValor(Math.round(orcamento.total * 50) / 100)}
                        >
                          50%
                        </Button>
                        {orcamento.jaCobrado > 0 && falta > 0 && (
                          <Button type="button" variant="outline" className="h-11 md:h-10" onClick={() => definirValor(falta)}>
                            O que falta ({formatarMoeda(falta)})
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <FormDescription>O total a receber do cliente (o da fatura).</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="data_emissao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de emissão *</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      min={DATA_MINIMA}
                      max={DATA_MAXIMA}
                      {...field}
                      onChange={(evento) => {
                        field.onChange(evento)
                        const nova = evento.target.value
                        if (vencimentoAutomatico && eDataValida(nova)) {
                          form.setValue("data_vencimento", vencimentoProposto(nova), {
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
              name="data_vencimento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vencimento *</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      min={eDataValida(dataEmissao) ? dataEmissao : DATA_MINIMA}
                      max={DATA_MAXIMA}
                      {...field}
                      onChange={(evento) => {
                        field.onChange(evento)
                        setVencimentoAutomatico(false)
                      }}
                    />
                  </FormControl>
                  {vencimentoAutomatico && <FormDescription>{DIAS_VENCIMENTO} dias depois da emissão.</FormDescription>}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notas"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Ex.: combinado pagar em duas vezes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileTextIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
              Fatura
            </CardTitle>
            <CardDescription>
              A fatura é emitida no programa de faturação certificado; aqui guarda-se só a referência.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid items-start gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="fatura_referencia"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>N.º da fatura</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" placeholder="Ex.: FT 2026/123" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fatura_data"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data da fatura</FormLabel>
                  <FormControl>
                    <Input type="date" min={DATA_MINIMA} max={DATA_MAXIMA} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button asChild type="button" variant="outline" size="lg">
            <Link href={cancelarHref}>Cancelar</Link>
          </Button>
          <Button type="submit" size="lg" disabled={aGuardar}>
            {aGuardar && <LoaderCircleIcon className="animate-spin" />}
            {edicao ? "Guardar" : "Criar cobrança"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
