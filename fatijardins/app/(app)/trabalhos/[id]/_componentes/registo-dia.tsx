"use client"

import { useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CircleAlertIcon, LoaderCircleIcon, RotateCwIcon, SaveIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { useAcaoFormulario } from "@/hooks/use-acao-formulario"
import { paraCampo } from "@/lib/validacao/comum"
import {
  esquemaRegisto,
  MENSAGEM_CONFLITO_REGISTO,
  type CamposRegisto,
  type DadosRegisto,
} from "@/lib/validacao/registos"
import { guardarRegisto } from "../acoes"

type Props = {
  trabalhoId: string
  tarefasFeitas: string | null
  notas: string | null
  /** updated_at do registo (null se ainda não existe): a versão sobre a qual se grava. */
  versao: string | null
  /** Ex.: "Atualizado por Rui Carvalho às 10:42" (calculado no servidor). */
  atualizado: string | null
}

/** O registo como está no servidor numa versão. */
type VersaoRegisto = { versao: string | null; tarefasFeitas: string | null; notas: string | null }

/** Tarefas feitas e notas do dia (um só registo por trabalho). */
export function RegistoDia({ trabalhoId, tarefasFeitas, notas, versao, atualizado }: Props) {
  const valores = useMemo<CamposRegisto>(
    () => ({ tarefas_feitas: paraCampo(tarefasFeitas), notas: paraCampo(notas) }),
    [tarefasFeitas, notas]
  )
  const form = useForm<CamposRegisto, unknown, DadosRegisto>({
    resolver: zodResolver(esquemaRegisto),
    defaultValues: valores,
    // Quando os dados do servidor mudam (ex.: um colega guardou, ou foi
    // guardada a assinatura), os campos acompanham, exceto os que a pessoa
    // está a escrever: o texto ainda por guardar nunca se perde.
    values: valores,
    resetOptions: { keepDirtyValues: true },
  })

  // Versão em que se baseia o que está no formulário (o servidor só grava sobre ela).
  // Quando chega uma versão nova (a própria pessoa juntou um material, um colega
  // guardou…), a base só avança se ninguém mudou o texto de um campo que a pessoa
  // alterou; senão o texto do colega perdia-se e, ao guardar, o servidor avisa.
  const [base, setBase] = useState<VersaoRegisto>({ versao, tarefasFeitas, notas })
  const [ultimaVersao, setUltimaVersao] = useState(versao)
  if (versao !== ultimaVersao) {
    setUltimaVersao(versao)
    const escrito = form.getValues()
    const alteradoNosDois = (campo: keyof CamposRegisto, antes: string | null, agora: string | null) =>
      escrito[campo] !== paraCampo(antes) && agora !== antes
    if (
      !alteradoNosDois("tarefas_feitas", base.tarefasFeitas, tarefasFeitas) &&
      !alteradoNosDois("notas", base.notas, notas)
    ) {
      setBase({ versao, tarefasFeitas, notas })
    }
  }

  const [conflito, setConflito] = useState(false)
  // O que foi enviado na última gravação (para não perder o que se escreveu enquanto gravava).
  const enviados = useRef<CamposRegisto | null>(null)
  const { submeter, aGuardar } = useAcaoFormulario(
    form,
    async (campos) => {
      enviados.current = campos
      const resultado = await guardarRegisto(trabalhoId, base.versao, campos)
      setConflito(!resultado.ok && resultado.erro === MENSAGEM_CONFLITO_REGISTO)
      return resultado
    },
    {
      // A versão nova chega já com a resposta: pode voltar a guardar logo a seguir,
      // mesmo que a página (guardada escondida pelo Next) ainda não tenha atualizado.
      aoConcluir: ({ dados }) => {
        if (!dados) return
        setBase({ versao: dados.versao, tarefasFeitas: dados.tarefas_feitas, notas: dados.notas })
        // Os campos ficam com o que ficou gravado e deixam de contar como "por guardar"
        // (keepDirtyValues: false; senão uma versão nova de um colega não lhes chegava e
        // a gravação seguinte apagava-a sem aviso). O que a pessoa escreveu durante a
        // gravação volta a ser posto e continua por guardar.
        const atuais = form.getValues()
        form.reset(
          { tarefas_feitas: paraCampo(dados.tarefas_feitas), notas: paraCampo(dados.notas) },
          { keepDirtyValues: false }
        )
        for (const campo of ["tarefas_feitas", "notas"] as const) {
          if (enviados.current && atuais[campo] !== enviados.current[campo]) {
            form.setValue(campo, atuais[campo], { shouldDirty: true })
          }
        }
      },
    }
  )

  return (
    <Form {...form}>
      <form onSubmit={submeter} className="grid gap-4" noValidate>
        <FormField
          control={form.control}
          name="tarefas_feitas"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tarefas feitas</FormLabel>
              <FormControl>
                <Textarea rows={4} placeholder="Ex.: Relva cortada, sebes aparadas, folhas recolhidas." {...field} />
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
                <Textarea rows={3} placeholder="Avarias, pedidos do cliente, o que falta fazer…" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {conflito && (
          <div
            role="alert"
            className="grid gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <p className="flex items-start gap-2 font-medium">
              <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {MENSAGEM_CONFLITO_REGISTO}
            </p>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="sm:w-fit"
              onClick={() => window.location.reload()}
            >
              <RotateCwIcon />
              Recarregar a página
            </Button>
          </div>
        )}
        <div className="grid gap-2 sm:flex sm:items-center sm:gap-4">
          <Button type="submit" size="lg" disabled={aGuardar}>
            {aGuardar ? <LoaderCircleIcon className="animate-spin" /> : <SaveIcon />}
            Guardar registo
          </Button>
          {atualizado && <p className="text-sm text-muted-foreground">{atualizado}</p>}
        </div>
      </form>
    </Form>
  )
}
