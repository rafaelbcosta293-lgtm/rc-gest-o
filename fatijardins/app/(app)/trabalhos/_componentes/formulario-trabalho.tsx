"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarRangeIcon, LoaderCircleIcon, MapPinIcon } from "lucide-react"

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
import { DATA_MAXIMA, DATA_MINIMA, eDataValida } from "@/lib/datas"
import { formatarData, formatarDuracao } from "@/lib/formatar"
import { datasDaSerie, NOMES_RECORRENCIA, NOMES_TIPO_TRABALHO } from "@/lib/trabalhos"
import { cn } from "@/lib/utils"
import {
  DURACOES_MIN,
  esquemaTrabalho,
  problemaDataFim,
  RECORRENCIAS,
  TIPOS_TRABALHO,
  TITULOS_SUGERIDOS,
  type CamposTrabalho,
  type DadosTrabalho,
} from "@/lib/validacao/trabalhos"
import { atualizarTrabalho, criarTrabalho } from "../acoes"

export type OpcaoLocal = {
  id: string
  clienteId: string
  nome: string
  morada: string
  ativo: boolean
}

type Props = {
  valoresIniciais: CamposTrabalho
  clientes: { id: string; nome: string }[]
  locais: OpcaoLocal[]
  equipas: { id: string; nome: string }[]
  /** O gerente pode deixar o trabalho "Por atribuir"; o chefe tem de escolher a equipa. */
  permitirSemEquipa: boolean
  /**
   * Ao editar: o trabalho (sem trabalho, o formulário cria). dataFixa: já tem
   * horas, registo ou fotos e não pode mudar de dia (a BD também o recusa).
   */
  trabalho?: { id: string; serie: boolean; dataFixa?: boolean }
  cancelarHref: string
}

type Aplicar = "este" | "seguintes"

export function FormularioTrabalho({
  valoresIniciais,
  clientes,
  locais,
  equipas,
  permitirSemEquipa,
  trabalho,
  cancelarHref,
}: Props) {
  const esquema = useMemo(() => esquemaTrabalho({ equipaObrigatoria: !permitirSemEquipa }), [permitirSemEquipa])
  const form = useForm<CamposTrabalho, unknown, DadosTrabalho>({
    resolver: zodResolver(esquema),
    defaultValues: valoresIniciais,
  })
  const [aplicar, setAplicar] = useState<Aplicar>("este")

  const { submeter, aGuardar } = useAcaoFormulario(
    form,
    (valores) =>
      trabalho ? atualizarTrabalho(trabalho.id, valores, aplicar === "seguintes") : criarTrabalho(valores),
    // A página "Novo trabalho" fica guardada pelo Next.js: limpar depois de criar.
    { aoConcluir: () => (trabalho ? undefined : form.reset()) }
  )

  const [clienteId, localId, data, repetir, ate] = useWatch({
    control: form.control,
    name: ["cliente_id", "local_id", "data", "repetir", "ate"],
  })

  // Locais do cliente (os desativados só aparecem se já forem os do trabalho).
  const locaisDoCliente = locais.filter(
    (local) => local.clienteId === clienteId && (local.ativo || local.id === valoresIniciais.local_id)
  )
  const localEscolhido = locais.find((local) => local.id === localId)

  const duracoes = DURACOES_MIN.includes(Number(valoresIniciais.duracao_prevista_min)) || !valoresIniciais.duracao_prevista_min
    ? DURACOES_MIN
    : [...DURACOES_MIN, Number(valoresIniciais.duracao_prevista_min)].sort((a, b) => a - b)

  const datasSerie =
    !trabalho && repetir !== "nao" && eDataValida(data) && !problemaDataFim(data, ate || null)
      ? datasDaSerie(data, repetir, ate)
      : null

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
                      <Link href={`/clientes/${clienteId}/locais/novo`} className="font-medium text-primary underline-offset-4 hover:underline">
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
            <CardTitle>Trabalho</CardTitle>
          </CardHeader>
          <CardContent className="grid items-start gap-4">
            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título *</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" placeholder="Ex.: Manutenção" {...field} />
                  </FormControl>
                  <div className="flex flex-wrap gap-2" aria-label="Sugestões de título">
                    {TITULOS_SUGERIDOS.map((sugestao) => (
                      <Button
                        key={sugestao}
                        type="button"
                        variant={field.value === sugestao ? "secondary" : "outline"}
                        size="sm"
                        className="h-10 rounded-full px-4"
                        onClick={() =>
                          form.setValue("titulo", sugestao, {
                            shouldDirty: true,
                            shouldValidate: form.formState.isSubmitted,
                          })
                        }
                      >
                        {sugestao}
                      </Button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <div role="radiogroup" aria-label="Tipo de trabalho" className="grid grid-cols-2 gap-2 sm:w-80">
                    {TIPOS_TRABALHO.map((tipo) => (
                      <label
                        key={tipo}
                        className={cn(
                          "flex h-12 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                          field.value === tipo ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
                        )}
                      >
                        <input
                          type="radio"
                          name={field.name}
                          value={tipo}
                          checked={field.value === tipo}
                          onChange={() => field.onChange(tipo)}
                          onBlur={field.onBlur}
                          className="sr-only"
                        />
                        {NOMES_TIPO_TRABALHO[tipo]}
                      </label>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tarefas previstas</FormLabel>
                  <FormControl>
                    <Textarea rows={4} placeholder="Ex.: cortar a relva, aparar a sebe, limpar os canteiros…" {...field} />
                  </FormControl>
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
                    <Input type="date" min={DATA_MINIMA} max={DATA_MAXIMA} {...field} disabled={trabalho?.dataFixa} />
                  </FormControl>
                  {trabalho?.dataFixa ? (
                    <FormDescription>
                      Já tem horas, registo ou fotos: não pode mudar de dia. Para outro dia, cancele-o e crie outro.
                    </FormDescription>
                  ) : (
                    trabalho?.serie &&
                    aplicar === "seguintes" && <FormDescription>A data só muda neste trabalho.</FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="hora_inicio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hora de início</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="duracao_prevista_min"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duração prevista</FormLabel>
                  <FormControl>
                    <NativeSelect {...field}>
                      <option value="">Sem duração prevista</option>
                      {duracoes.map((minutos) => (
                        <option key={minutos} value={String(minutos)}>
                          {formatarDuracao(minutos)}
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
              name="equipa_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Equipa{permitirSemEquipa ? "" : " *"}</FormLabel>
                  <FormControl>
                    <NativeSelect {...field}>
                      <option value="">{permitirSemEquipa ? "Por atribuir" : "Escolha a equipa"}</option>
                      {equipas.map((equipa) => (
                        <option key={equipa.id} value={equipa.id}>
                          {equipa.nome}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!trabalho && (
              <>
                <FormField
                  control={form.control}
                  name="repetir"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Repetir</FormLabel>
                      <FormControl>
                        <NativeSelect {...field}>
                          {RECORRENCIAS.map((recorrencia) => (
                            <option key={recorrencia} value={recorrencia}>
                              {NOMES_RECORRENCIA[recorrencia]}
                            </option>
                          ))}
                        </NativeSelect>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {repetir !== "nao" && (
                  <FormField
                    control={form.control}
                    name="ate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Até *</FormLabel>
                        <FormControl>
                          <Input type="date" min={eDataValida(data) ? data : undefined} {...field} />
                        </FormControl>
                        <FormDescription>No máximo um ano depois da data do trabalho.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {datasSerie && (
                  <p
                    className="flex items-start gap-2 rounded-lg bg-accent/60 p-3 text-sm text-accent-foreground sm:col-span-2"
                    aria-live="polite"
                  >
                    <CalendarRangeIcon className="mt-0.5 size-4 shrink-0" />
                    <span>
                      <strong>
                        Vai criar {datasSerie.length === 1 ? "1 trabalho" : `${datasSerie.length} trabalhos`}
                      </strong>
                      {datasSerie.length > 1 &&
                        `, de ${formatarData(datasSerie[0])} a ${formatarData(datasSerie[datasSerie.length - 1])}`}
                      .
                    </span>
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {trabalho?.serie && (
          <fieldset className="grid gap-2 rounded-xl border p-4">
            <legend className="px-1 text-base font-semibold">Aplicar as alterações a</legend>
            <p className="text-sm text-muted-foreground">
              Este trabalho faz parte de uma série. Título, tarefas, hora, duração, tipo e equipa podem
              passar também para os trabalhos seguintes que ainda estão agendados.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  { valor: "este", nome: "Só este trabalho" },
                  { valor: "seguintes", nome: "Este e os seguintes da série" },
                ] as const
              ).map((opcao) => (
                <label
                  key={opcao.valor}
                  className={cn(
                    "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2 text-sm font-medium transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                    aplicar === opcao.valor ? "border-primary bg-accent" : "hover:bg-accent/50"
                  )}
                >
                  <input
                    type="radio"
                    name="aplicar"
                    value={opcao.valor}
                    checked={aplicar === opcao.valor}
                    onChange={() => setAplicar(opcao.valor)}
                    className="size-4 accent-primary"
                  />
                  {opcao.nome}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          {/* Ao editar há também "Cancelar trabalho": aqui é só sair sem guardar. */}
          <Button asChild type="button" variant="outline" size="lg">
            <Link href={cancelarHref}>{trabalho ? "Voltar" : "Cancelar"}</Link>
          </Button>
          <Button type="submit" size="lg" disabled={aGuardar}>
            {aGuardar && <LoaderCircleIcon className="animate-spin" />}
            {trabalho
              ? "Guardar"
              : datasSerie && datasSerie.length > 1
                ? `Criar ${datasSerie.length} trabalhos`
                : "Criar trabalho"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
