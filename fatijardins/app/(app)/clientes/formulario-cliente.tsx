"use client"

import Link from "next/link"
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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAcaoFormulario } from "@/hooks/use-acao-formulario"
import type { Tables } from "@/lib/supabase/database.types"
import { paraCampo } from "@/lib/validacao/comum"
import { esquemaCliente, type CamposCliente, type DadosCliente } from "@/lib/validacao/clientes"
import { atualizarCliente, criarCliente } from "./acoes"

type Props = {
  /** Cliente a editar; sem cliente o formulário cria um novo. */
  cliente?: Tables<"clientes">
}

function valoresIniciais(cliente?: Tables<"clientes">): CamposCliente {
  return {
    nome: paraCampo(cliente?.nome),
    nif: paraCampo(cliente?.nif),
    pessoa_contacto: paraCampo(cliente?.pessoa_contacto),
    telemovel: paraCampo(cliente?.telemovel),
    telefone: paraCampo(cliente?.telefone),
    email: paraCampo(cliente?.email),
    morada: paraCampo(cliente?.morada),
    codigo_postal: paraCampo(cliente?.codigo_postal),
    localidade: paraCampo(cliente?.localidade),
    notas: paraCampo(cliente?.notas),
    ativo: cliente?.ativo ?? true,
  }
}

export function FormularioCliente({ cliente }: Props) {
  const form = useForm<CamposCliente, unknown, DadosCliente>({
    resolver: zodResolver(esquemaCliente),
    defaultValues: valoresIniciais(cliente),
  })

  const { submeter, aGuardar } = useAcaoFormulario(
    form,
    (valores) => (cliente ? atualizarCliente(cliente.id, valores) : criarCliente(valores)),
    {
      // A página fica guardada (Activity) depois de navegar: o "Novo cliente" volta a abrir vazio.
      aoConcluir: () => {
        if (!cliente) form.reset()
      },
    }
  )

  return (
    <Form {...form}>
      <form onSubmit={submeter} className="grid gap-6" noValidate>
        <fieldset className="grid items-start gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-base font-semibold">Dados do cliente</legend>
          <FormField
            control={form.control}
            name="nome"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Nome *</FormLabel>
                <FormControl>
                  <Input autoComplete="off" autoFocus={!cliente} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nif"
            render={({ field }) => (
              <FormItem>
                <FormLabel>NIF</FormLabel>
                <FormControl>
                  <Input inputMode="numeric" autoComplete="off" maxLength={11} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pessoa_contacto"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pessoa de contacto</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <fieldset className="grid items-start gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-base font-semibold">Contactos</legend>
          <FormField
            control={form.control}
            name="telemovel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telemóvel</FormLabel>
                <FormControl>
                  <Input type="tel" inputMode="tel" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="telefone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl>
                  <Input type="tel" inputMode="tel" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" inputMode="email" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <fieldset className="grid items-start gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-base font-semibold">Morada de faturação</legend>
          <FormField
            control={form.control}
            name="morada"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Morada</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="codigo_postal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código postal</FormLabel>
                <FormControl>
                  <Input inputMode="numeric" placeholder="0000-000" maxLength={8} autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="localidade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Localidade</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <FormField
          control={form.control}
          name="notas"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {cliente && (
          <FormField
            control={form.control}
            name="ativo"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div className="grid gap-1">
                  <FormLabel>Cliente ativo</FormLabel>
                  <FormDescription>Os clientes inativos não aparecem na lista por omissão.</FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button asChild type="button" variant="outline" size="lg">
            <Link href={cliente ? `/clientes/${cliente.id}` : "/clientes"}>Cancelar</Link>
          </Button>
          <Button type="submit" size="lg" disabled={aGuardar}>
            {aGuardar && <LoaderCircleIcon className="animate-spin" />}
            {cliente ? "Guardar" : "Criar cliente"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
