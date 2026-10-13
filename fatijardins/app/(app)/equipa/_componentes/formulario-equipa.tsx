"use client"

import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckIcon, LoaderCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { Textarea } from "@/components/ui/textarea"
import { useAcaoFormulario } from "@/hooks/use-acao-formulario"
import { NOMES_PERFIL, type Perfil } from "@/lib/perfis"
import { cn } from "@/lib/utils"
import { CORES_EQUIPA, esquemaEquipa, type CamposEquipa, type DadosEquipa } from "@/lib/validacao/equipa"
import { atualizarEquipa, criarEquipa } from "../acoes"

type Props = {
  /** Sem id → criar; com id → editar. */
  equipaId?: string
  valoresIniciais: CamposEquipa
  /** Colaboradores que podem chefiar (ativos, chefe de equipa ou gerente). */
  chefes: { id: string; nome: string; perfil: Perfil }[]
  cancelarHref: string
}

export function FormularioEquipa({ equipaId, valoresIniciais, chefes, cancelarHref }: Props) {
  const form = useForm<CamposEquipa, unknown, DadosEquipa>({
    resolver: zodResolver(esquemaEquipa),
    defaultValues: valoresIniciais,
  })
  const { submeter, aGuardar } = useAcaoFormulario(form, (valores) =>
    equipaId ? atualizarEquipa(equipaId, valores) : criarEquipa(valores)
  )

  return (
    <Form {...form}>
      <form onSubmit={submeter} className="grid gap-6" noValidate>
        <Card>
          <CardContent className="grid gap-5">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex.: Equipa Verde" autoComplete="off" autoFocus={!equipaId} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cor"
              render={({ field }) => {
                const atual = field.value.toLowerCase()
                return (
                  <FormItem>
                    <FormLabel>Cor</FormLabel>
                    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Cores sugeridas">
                      {CORES_EQUIPA.map((cor) => {
                        const escolhida = atual === cor.valor
                        return (
                          <button
                            key={cor.valor}
                            type="button"
                            onClick={() => field.onChange(cor.valor)}
                            aria-label={cor.nome}
                            aria-pressed={escolhida}
                            title={cor.nome}
                            className={cn(
                              "flex size-11 items-center justify-center rounded-full text-white shadow-xs ring-offset-2 ring-offset-background transition-shadow outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                              escolhida && "ring-2 ring-foreground"
                            )}
                            style={{ backgroundColor: cor.valor }}
                          >
                            {escolhida && <CheckIcon className="size-5" />}
                          </button>
                        )
                      })}
                      <FormControl>
                        <input
                          type="color"
                          title="Outra cor"
                          className="h-11 w-14 cursor-pointer rounded-md border bg-background p-1"
                          {...field}
                        />
                      </FormControl>
                    </div>
                    <FormDescription>Usada para identificar a equipa nas listas e no calendário.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />

            <FormField
              control={form.control}
              name="chefeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chefe de equipa</FormLabel>
                  <FormControl>
                    <NativeSelect {...field}>
                      <option value="">Sem chefe</option>
                      {chefes.map((chefe) => (
                        <option key={chefe.id} value={chefe.id}>
                          {chefe.nome} ({NOMES_PERFIL[chefe.perfil]})
                        </option>
                      ))}
                    </NativeSelect>
                  </FormControl>
                  <FormDescription>
                    Só aparecem colaboradores ativos com perfil de chefe de equipa ou gerente.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {equipaId && (
              <FormField
                control={form.control}
                name="ativa"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                      <div className="grid gap-1">
                        <FormLabel>Ativa</FormLabel>
                        <FormDescription>
                          Uma equipa inativa deixa de aparecer nas escolhas, mas mantém o histórico.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="notas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Ex.: zona de trabalho, viatura…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
