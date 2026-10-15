"use client"

import Link from "next/link"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircleIcon, MapPinIcon } from "lucide-react"

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
import { DATA_MAXIMA, DATA_MINIMA } from "@/lib/datas"
import { esquemaVisita, type CamposVisita, type DadosVisita } from "@/lib/validacao/visitas"
import { atualizarVisita, criarVisita } from "../acoes"

export type OpcaoLocal = {
  id: string
  clienteId: string
  nome: string
  morada: string
  ativo: boolean
}

type Props = {
  valoresIniciais: CamposVisita
  clientes: { id: string; nome: string }[]
  locais: OpcaoLocal[]
  responsaveis: { id: string; nome: string }[]
  /** Ao editar: a visita (sem visita, o formulário cria). */
  visitaId?: string
  cancelarHref: string
}

export function FormularioVisita({ valoresIniciais, clientes, locais, responsaveis, visitaId, cancelarHref }: Props) {
  const form = useForm<CamposVisita, unknown, DadosVisita>({
    resolver: zodResolver(esquemaVisita),
    defaultValues: valoresIniciais,
  })

  const { submeter, aGuardar } = useAcaoFormulario(
    form,
    (valores) => (visitaId ? atualizarVisita(visitaId, valores) : criarVisita(valores)),
    // A página "Nova visita" fica guardada pelo Next.js: limpar depois de criar.
    { aoConcluir: () => (visitaId ? undefined : form.reset()) }
  )

  const [clienteId, localId] = useWatch({ control: form.control, name: ["cliente_id", "local_id"] })

  // Locais do cliente (os desativados só aparecem se já forem os da visita).
  const locaisDoCliente = locais.filter(
    (local) => local.clienteId === clienteId && (local.ativo || local.id === valoresIniciais.local_id)
  )
  const localEscolhido = locais.find((local) => local.id === localId)

  function escolherCliente(novoCliente: string) {
    const opcoes = locais.filter((local) => local.clienteId === novoCliente && local.ativo)
    // Com um só local, fica escolhido.
    form.setValue("local_id", opcoes.length === 1 ? opcoes[0].id : "", {
      shouldValidate: form.formState.isSubmitted,
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={submeter} className="grid gap-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Cliente e local</CardTitle>
          </CardHeader>
          <CardContent className="grid items-start gap-4 sm:grid-cols-2">
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
                    <NativeSelect {...field} disabled={!clienteId}>
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
            <CardTitle>Quando e quem</CardTitle>
          </CardHeader>
          <CardContent className="grid items-start gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="data"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data *</FormLabel>
                  <FormControl>
                    <Input type="date" min={DATA_MINIMA} max={DATA_MAXIMA} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="hora"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hora</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="responsavel_id"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Responsável *</FormLabel>
                  <FormControl>
                    <NativeSelect {...field}>
                      <option value="">Escolha quem faz a visita</option>
                      {responsaveis.map((responsavel) => (
                        <option key={responsavel.id} value={responsavel.id}>
                          {responsavel.nome}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Medidas e notas</CardTitle>
          </CardHeader>
          <CardContent className="grid items-start gap-4">
            <FormField
              control={form.control}
              name="area_m2"
              render={({ field }) => (
                <FormItem className="sm:max-w-60">
                  <FormLabel>Área (m²)</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" autoComplete="off" placeholder="Ex.: 120,5" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="medidas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medidas</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="Ex.: relvado 120 m², sebe 35 m, canteiro junto ao muro 4 × 1,5 m"
                      {...field}
                    />
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
                    <Textarea
                      rows={4}
                      placeholder="Ex.: o cliente quer rega automática; acesso pelo portão lateral"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>O que o cliente pediu, o estado do jardim e o que é preciso orçamentar.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button asChild type="button" variant="outline" size="lg">
            <Link href={cancelarHref}>{visitaId ? "Voltar" : "Cancelar"}</Link>
          </Button>
          <Button type="submit" size="lg" disabled={aGuardar}>
            {aGuardar && <LoaderCircleIcon className="animate-spin" />}
            {visitaId ? "Guardar" : "Criar visita"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
