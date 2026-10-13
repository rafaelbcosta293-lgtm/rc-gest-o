"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircleIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { esquemaLogin, type CamposLogin } from "@/lib/validacao/auth"
import { iniciarSessao } from "../acoes"

export function FormularioLogin() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [aEntrar, iniciar] = useTransition()
  const form = useForm<CamposLogin>({
    resolver: zodResolver(esquemaLogin),
    defaultValues: { email: "", palavraPasse: "" },
  })

  const ligacaoInvalida = searchParams.get("erro") === "ligacao"

  const submeter = form.handleSubmit(() => {
    iniciar(async () => {
      try {
        const resultado = await iniciarSessao(form.getValues(), searchParams.get("seguinte"))
        if (!resultado.ok) {
          toast.error(resultado.erro)
          return
        }
        // A página de login fica guardada (escondida) pelo Next.js: não deixar
        // lá o email e a palavra-passe depois de entrar.
        form.reset()
        router.replace(resultado.redirecionar ?? "/")
        router.refresh()
      } catch {
        toast.error("Sem ligação ao servidor. Verifique a internet e tente de novo.")
      }
    })
  })

  return (
    <Form {...form}>
      <form onSubmit={submeter} className="grid gap-4" noValidate>
        {ligacaoInvalida && (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            A ligação expirou ou já foi usada. Peça uma nova.
          </p>
        )}
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
        <FormField
          control={form.control}
          name="palavraPasse"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Palavra-passe</FormLabel>
                <Link
                  href="/recuperar-palavra-passe"
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  Esqueceu-se?
                </Link>
              </div>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" disabled={aEntrar} className="mt-2 w-full">
          {aEntrar && <LoaderCircleIcon className="animate-spin" />}
          Entrar
        </Button>
      </form>
    </Form>
  )
}
