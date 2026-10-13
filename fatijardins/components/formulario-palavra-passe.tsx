"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircleIcon } from "lucide-react"

import { atualizarPalavraPasse } from "@/app/(auth)/acoes"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useAcaoFormulario } from "@/hooks/use-acao-formulario"
import { esquemaNovaPalavraPasse, type CamposNovaPalavraPasse } from "@/lib/validacao/auth"

/** Formulário para definir uma nova palavra-passe (recuperação ou perfil). */
export function FormularioPalavraPasse({ redirecionar = true }: { redirecionar?: boolean }) {
  const form = useForm<CamposNovaPalavraPasse>({
    resolver: zodResolver(esquemaNovaPalavraPasse),
    defaultValues: { palavraPasse: "", confirmar: "" },
  })

  const { submeter, aGuardar } = useAcaoFormulario(
    form,
    async (valores) => {
      const resultado = await atualizarPalavraPasse(valores)
      return resultado.ok && !redirecionar ? { ...resultado, redirecionar: undefined } : resultado
    },
    { aoConcluir: () => form.reset() }
  )

  return (
    <Form {...form}>
      <form onSubmit={submeter} className="grid gap-4" noValidate>
        <FormField
          control={form.control}
          name="palavraPasse"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nova palavra-passe</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmar"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Repetir a palavra-passe</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" disabled={aGuardar} className="w-full sm:w-fit">
          {aGuardar && <LoaderCircleIcon className="animate-spin" />}
          Guardar palavra-passe
        </Button>
      </form>
    </Form>
  )
}
