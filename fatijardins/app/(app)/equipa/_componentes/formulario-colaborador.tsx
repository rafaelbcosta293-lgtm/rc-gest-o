"use client"

import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircleIcon } from "lucide-react"

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
import { Switch } from "@/components/ui/switch"
import { useAcaoFormulario } from "@/hooks/use-acao-formulario"
import { NOMES_PERFIL, PERFIS } from "@/lib/perfis"
import { esquemaColaborador, type CamposColaborador, type DadosColaborador } from "@/lib/validacao/equipa"
import { atualizarColaborador, criarColaborador } from "../acoes"

type Props = {
  /** Sem id → criar; com id → editar. */
  colaboradorId?: string
  valoresIniciais: CamposColaborador
  equipas: { id: string; nome: string; ativa: boolean }[]
  /** O gerente a editar a sua própria ficha (não pode mudar perfil nem desativar-se). */
  eProprio?: boolean
  cancelarHref: string
}

export function FormularioColaborador({
  colaboradorId,
  valoresIniciais,
  equipas,
  eProprio = false,
  cancelarHref,
}: Props) {
  const form = useForm<CamposColaborador, unknown, DadosColaborador>({
    resolver: zodResolver(esquemaColaborador),
    defaultValues: valoresIniciais,
  })

  const { submeter, aGuardar } = useAcaoFormulario(form, (valores) =>
    colaboradorId ? atualizarColaborador(colaboradorId, valores) : criarColaborador(valores)
  )

  return (
    <Form {...form}>
      <form onSubmit={submeter} className="grid gap-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Dados pessoais</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" autoCapitalize="words" autoFocus={!colaboradorId} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="funcao"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Função</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex.: Jardineiro" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="telemovel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telemóvel</FormLabel>
                  <FormControl>
                    <Input type="tel" inputMode="tel" autoComplete="off" placeholder="912 345 678" {...field} />
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
                    <Input type="email" inputMode="email" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Na empresa</CardTitle>
            <CardDescription>O perfil define o que a pessoa pode ver e fazer na app.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="perfil"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Perfil</FormLabel>
                  <FormControl>
                    <NativeSelect {...field} disabled={eProprio}>
                      {PERFIS.map((perfil) => (
                        <option key={perfil} value={perfil}>
                          {NOMES_PERFIL[perfil]}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormControl>
                  {eProprio && (
                    <FormDescription>Não pode retirar o seu próprio perfil de gerente.</FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="equipaId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Equipa</FormLabel>
                  <FormControl>
                    <NativeSelect {...field}>
                      <option value="">Sem equipa</option>
                      {equipas.map((equipa) => (
                        <option key={equipa.id} value={equipa.id}>
                          {equipa.ativa ? equipa.nome : `${equipa.nome} (inativa)`}
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
              name="custoHora"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Custo/hora</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input inputMode="decimal" autoComplete="off" placeholder="0,00" className="pr-12" {...field} />
                    </FormControl>
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                      €/h
                    </span>
                  </div>
                  <FormDescription>Só o gerente vê este valor.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {colaboradorId && (
              <FormField
                control={form.control}
                name="ativo"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                      <div className="grid gap-1">
                        <FormLabel>Ativo</FormLabel>
                        <FormDescription>
                          {eProprio
                            ? "Não se pode desativar a si próprio."
                            : "Quem está inativo deixa de aparecer nas listas e não consegue entrar na app."}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          disabled={eProprio}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button asChild variant="outline" size="lg">
            <Link href={cancelarHref}>Cancelar</Link>
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
