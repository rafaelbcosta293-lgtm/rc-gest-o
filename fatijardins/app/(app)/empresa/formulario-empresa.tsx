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
import { Textarea } from "@/components/ui/textarea"
import { useAcaoFormulario } from "@/hooks/use-acao-formulario"
import type { Tables } from "@/lib/supabase/database.types"
import { paraCampo } from "@/lib/validacao/comum"
import { esquemaEmpresa, type CamposEmpresa, type DadosEmpresa } from "@/lib/validacao/empresa"
import { guardarEmpresa } from "./acoes"

function valoresIniciais(empresa: Tables<"empresa">): CamposEmpresa {
  return {
    nome: paraCampo(empresa.nome),
    nif: paraCampo(empresa.nif),
    morada: paraCampo(empresa.morada),
    codigo_postal: paraCampo(empresa.codigo_postal),
    localidade: paraCampo(empresa.localidade),
    telefone: paraCampo(empresa.telefone),
    email: paraCampo(empresa.email),
    website: paraCampo(empresa.website),
    iban: paraCampo(empresa.iban),
    validade_orcamento_dias: paraCampo(empresa.validade_orcamento_dias),
    condicoes_orcamento: paraCampo(empresa.condicoes_orcamento),
  }
}

export function FormularioEmpresa({ empresa }: { empresa: Tables<"empresa"> }) {
  const form = useForm<CamposEmpresa, unknown, DadosEmpresa>({
    resolver: zodResolver(esquemaEmpresa),
    defaultValues: valoresIniciais(empresa),
  })

  // Fica na página: depois de gravar, a página volta a ler os dados e a
  // chave (updated_at) monta o formulário com os valores normalizados.
  const { submeter, aGuardar } = useAcaoFormulario(form, guardarEmpresa)

  return (
    <Form {...form}>
      <form onSubmit={submeter} className="grid gap-6" noValidate>
        <fieldset className="grid items-start gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-base font-semibold">Identificação</legend>
          <FormField
            control={form.control}
            name="nome"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Nome *</FormLabel>
                <FormControl>
                  <Input autoComplete="organization" {...field} />
                </FormControl>
                <FormDescription>Como aparece no topo do PDF (ex.: Fatijardins, Lda.).</FormDescription>
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
        </fieldset>

        <fieldset className="grid items-start gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-base font-semibold">Sede</legend>
          <FormField
            control={form.control}
            name="morada"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Morada</FormLabel>
                <FormControl>
                  <Input autoComplete="street-address" {...field} />
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
                  <Input inputMode="numeric" placeholder="0000-000" maxLength={8} autoComplete="postal-code" {...field} />
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
                  <Input autoComplete="address-level2" {...field} />
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
            name="telefone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl>
                  <Input type="tel" inputMode="tel" autoComplete="tel" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" inputMode="email" autoComplete="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input inputMode="url" placeholder="www.fatijardins.pt" autoComplete="url" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <fieldset className="grid items-start gap-4">
          <legend className="mb-3 text-base font-semibold">Pagamentos</legend>
          <FormField
            control={form.control}
            name="iban"
            render={({ field }) => (
              <FormItem>
                <FormLabel>IBAN</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder="PT50 0000 0000 0000 0000 0000 0"
                    maxLength={40}
                    {...field}
                  />
                </FormControl>
                <FormDescription>Opcional. Aparece nas condições do PDF, para o pagamento por transferência.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <fieldset className="grid items-start gap-4">
          <legend className="mb-1 text-base font-semibold">Orçamentos novos</legend>
          <p className="text-sm text-muted-foreground">
            Valores propostos ao criar um orçamento; em cada orçamento pode alterá-los. Os orçamentos já criados não
            mudam.
          </p>
          <FormField
            control={form.control}
            name="validade_orcamento_dias"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Validade (dias) *</FormLabel>
                <FormControl>
                  <Input inputMode="numeric" autoComplete="off" maxLength={3} className="sm:max-w-32" {...field} />
                </FormControl>
                <FormDescription>Dias a contar da data do orçamento (entre 1 e 365).</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="condicoes_orcamento"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Condições</FormLabel>
                <FormControl>
                  <Textarea rows={5} {...field} />
                </FormControl>
                <FormDescription>Pagamento, prazos, garantia… Uma condição por linha.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button asChild type="button" variant="outline" size="lg">
            <Link href="/perfil">Cancelar</Link>
          </Button>
          <Button type="submit" size="lg" disabled={aGuardar}>
            {aGuardar && <LoaderCircleIcon className="animate-spin" />}
            Guardar
          </Button>
        </div>
      </form>
    </Form>
  )
}
