"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircleIcon, MailCheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useAcaoFormulario } from "@/hooks/use-acao-formulario"
import { esquemaRecuperar, type CamposRecuperar } from "@/lib/validacao/auth"
import { pedirRecuperacao } from "../acoes"

export function FormularioRecuperar() {
  const [enviado, setEnviado] = useState<string | null>(null)
  const form = useForm<CamposRecuperar>({
    resolver: zodResolver(esquemaRecuperar),
    defaultValues: { email: "" },
  })
  const { submeter, aGuardar } = useAcaoFormulario(form, pedirRecuperacao, {
    semNotificacao: true,
    aoConcluir: (resultado) => setEnviado(resultado.mensagem ?? ""),
  })

  if (enviado !== null) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg bg-accent p-4 text-center text-sm">
        <MailCheckIcon className="size-8 text-primary" />
        <p>{enviado}</p>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={submeter} className="grid gap-4" noValidate>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" inputMode="email" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" disabled={aGuardar} className="w-full">
          {aGuardar && <LoaderCircleIcon className="animate-spin" />}
          Enviar ligação
        </Button>
      </form>
    </Form>
  )
}
