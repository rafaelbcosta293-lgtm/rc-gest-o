"use client"

import Link from "next/link"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarSyncIcon, LoaderCircleIcon, MapPinIcon, TriangleAlertIcon } from "lucide-react"

import type { OpcaoLocal } from "@/app/(app)/trabalhos/_componentes/formulario-trabalho"
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
import {
  ESTADOS_CONTRATO,
  FREQUENCIAS_CONTRATO,
  NOMES_ESTADO_CONTRATO,
  NOMES_FREQUENCIA_CONTRATO,
  SEMANAS_AGENDADAS,
  TAXAS_IVA_CONTRATO,
  valorMensalComIva,
} from "@/lib/financas"
import { formatarDuracao, formatarMoeda } from "@/lib/formatar"
import { cn } from "@/lib/utils"
import { numeroOpcional } from "@/lib/validacao/comum"
import {
  DIAS_COBRANCA,
  esquemaContrato,
  TITULO_SUGERIDO,
  type CamposContrato,
  type DadosContrato,
} from "@/lib/validacao/contratos"
import { DURACOES_MIN } from "@/lib/validacao/trabalhos"
import { atualizarContrato, criarContrato } from "./acoes"

type Props = {
  valoresIniciais: CamposContrato
  clientes: { id: string; nome: string }[]
  locais: OpcaoLocal[]
  equipas: { id: string; nome: string }[]
  /** Ao editar: o contrato (sem ele, o formulário cria). */
  contratoId?: string
  cancelarHref: string
}

const valorEmEuros = numeroOpcional({ min: 0 })

/** Escolha entre poucas opções com botões grandes (como o tipo nos trabalhos). */
function Opcoes<T extends string>({
  nome,
  rotulo,
  opcoes,
  valor,
  aoEscolher,
  aoSair,
  className,
}: {
  nome: string
  rotulo: string
  opcoes: { valor: T; nome: string }[]
  valor: string
  aoEscolher: (valor: T) => void
  aoSair: () => void
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className={cn("grid gap-2", className)}>
      {opcoes.map((opcao) => (
        <label
          key={opcao.valor}
          className={cn(
            "flex min-h-12 cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-center text-sm font-medium transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
            valor === opcao.valor ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
          )}
        >
          <input
            type="radio"
            name={nome}
            value={opcao.valor}
            checked={valor === opcao.valor}
            onChange={() => aoEscolher(opcao.valor)}
            onBlur={aoSair}
            className="sr-only"
          />
          {opcao.nome}
        </label>
      ))}
    </div>
  )
}

export function FormularioContrato({ valoresIniciais, clientes, locais, equipas, contratoId, cancelarHref }: Props) {
  const form = useForm<CamposContrato, unknown, DadosContrato>({
    resolver: zodResolver(esquemaContrato),
    defaultValues: valoresIniciais,
  })

  const { submeter, aGuardar } = useAcaoFormulario(
    form,
    (valores) => (contratoId ? atualizarContrato(contratoId, valores) : criarContrato(valores)),
    // A página "Novo contrato" fica guardada pelo Next.js: limpar depois de criar.
    { aoConcluir: () => (contratoId ? undefined : form.reset()) }
  )

  const [clienteId, localId, frequencia, dataInicio, valorMensal, taxaIva, titulo] = useWatch({
    control: form.control,
    name: ["cliente_id", "local_id", "frequencia", "data_inicio", "valor_mensal", "taxa_iva", "titulo"],
  })

  // Locais do cliente (os desativados só aparecem se já forem os do contrato).
  const locaisDoCliente = locais.filter(
    (local) => local.clienteId === clienteId && (local.ativo || local.id === valoresIniciais.local_id)
  )
  const localEscolhido = locais.find((local) => local.id === localId)

  const duracaoInicial = Number(valoresIniciais.duracao_prevista_min)
  const duracoes =
    !valoresIniciais.duracao_prevista_min || DURACOES_MIN.includes(duracaoInicial)
      ? DURACOES_MIN
      : [...DURACOES_MIN, duracaoInicial].sort((a, b) => a - b)

  const valor = valorEmEuros.safeParse(valorMensal.replace(/€/g, ""))
  const valorSemIva = valor.success ? valor.data : null
  const totalComIva = valorSemIva === null ? null : valorMensalComIva(valorSemIva, Number(taxaIva))
  const sugestao = TITULO_SUGERIDO[frequencia as keyof typeof TITULO_SUGERIDO] ?? TITULO_SUGERIDO.semanal

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
            <CardTitle>Contrato</CardTitle>
          </CardHeader>
          <CardContent className="grid items-start gap-4">
            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título *</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" placeholder={`Ex.: ${sugestao}`} {...field} />
                  </FormControl>
                  {titulo !== sugestao && (
                    <div className="flex flex-wrap gap-2" aria-label="Sugestão de título">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto min-h-10 max-w-full rounded-full px-4 py-2 whitespace-normal"
                        onClick={() =>
                          form.setValue("titulo", sugestao, {
                            shouldDirty: true,
                            shouldValidate: form.formState.isSubmitted,
                          })
                        }
                      >
                        {sugestao}
                      </Button>
                    </div>
                  )}
                  <FormDescription>É o título de cada visita na agenda.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="servicos"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serviços incluídos</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={5}
                      placeholder={"Corte de relva\nAparar sebes\nLimpeza de canteiros\nVerificação da rega"}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Um serviço por linha. Aparecem nas tarefas previstas de cada visita.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Visitas</CardTitle>
          </CardHeader>
          <CardContent className="grid items-start gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="frequencia"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Frequência *</FormLabel>
                  <Opcoes
                    nome={field.name}
                    rotulo="Frequência das visitas"
                    opcoes={FREQUENCIAS_CONTRATO.map((f) => ({ valor: f, nome: NOMES_FREQUENCIA_CONTRATO[f] }))}
                    valor={field.value}
                    aoEscolher={field.onChange}
                    aoSair={field.onBlur}
                    className="grid-cols-1 min-[400px]:grid-cols-3"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="data_inicio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Primeira visita *</FormLabel>
                  <FormControl>
                    <Input type="date" min={DATA_MINIMA} max={DATA_MAXIMA} {...field} />
                  </FormControl>
                  <FormDescription>
                    {frequencia === "mensal"
                      ? "As seguintes são no mesmo dia de cada mês (ou no último dia, nos meses mais curtos)."
                      : "As seguintes repetem-se a partir desta data."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="data_fim"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fim do contrato</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      min={eDataValida(dataInicio) ? dataInicio : DATA_MINIMA}
                      max={DATA_MAXIMA}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Opcional. Em branco, continua até ser terminado.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="equipa_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Equipa</FormLabel>
                  <FormControl>
                    <NativeSelect {...field}>
                      <option value="">Por atribuir</option>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Avença</CardTitle>
          </CardHeader>
          <CardContent className="grid items-start gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="valor_mensal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor mensal sem IVA *</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input inputMode="decimal" autoComplete="off" placeholder="0,00" className="pr-8" {...field} />
                    </FormControl>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
                    >
                      €
                    </span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="taxa_iva"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IVA</FormLabel>
                  <FormControl>
                    <NativeSelect {...field}>
                      {TAXAS_IVA_CONTRATO.map((taxa) => (
                        <option key={taxa} value={String(taxa)}>
                          {taxa} %
                        </option>
                      ))}
                    </NativeSelect>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <p className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-lg bg-muted p-3 text-sm sm:col-span-2" aria-live="polite">
              <span className="text-muted-foreground">Total por mês, com IVA</span>
              <span className="text-lg font-semibold tabular-nums">
                {totalComIva === null ? "—" : formatarMoeda(totalComIva)}
              </span>
            </p>
            <FormField
              control={form.control}
              name="dia_cobranca"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dia de cobrança</FormLabel>
                  <FormControl>
                    <NativeSelect {...field}>
                      {DIAS_COBRANCA.map((dia) => (
                        <option key={dia} value={String(dia)}>
                          Dia {dia}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormControl>
                  <FormDescription>Dia do mês em que a cobrança de cada mês vence.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{contratoId ? "Estado e notas" : "Notas"}</CardTitle>
          </CardHeader>
          <CardContent className="grid items-start gap-4">
            {contratoId && (
              <FormField
                control={form.control}
                name="estado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Opcoes
                      nome={field.name}
                      rotulo="Estado do contrato"
                      opcoes={ESTADOS_CONTRATO.map((e) => ({ valor: e, nome: NOMES_ESTADO_CONTRATO[e] }))}
                      valor={field.value}
                      aoEscolher={field.onChange}
                      aoSair={field.onBlur}
                      className="grid-cols-3 sm:w-96"
                    />
                    <FormDescription>
                      Suspenso ou terminado: as visitas futuras saem da agenda e deixa de ser cobrado.
                    </FormDescription>
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
                    <Textarea rows={3} placeholder="Notas internas (não aparecem nas visitas)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="grid gap-2 text-sm">
          <p className="flex items-start gap-2 rounded-lg bg-accent/60 p-3 text-accent-foreground">
            <CalendarSyncIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              As visitas das próximas {SEMANAS_AGENDADAS} semanas aparecem na agenda e a cobrança de cada mês é criada
              no início do mês.
            </span>
          </p>
          {contratoId && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-200">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                Mudar a frequência, as datas, a equipa ou a hora refaz as visitas futuras ainda por começar. Mudar o
                valor, o IVA ou o dia de cobrança só conta para as cobranças dos meses seguintes.
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button asChild type="button" variant="outline" size="lg">
            <Link href={cancelarHref}>Cancelar</Link>
          </Button>
          <Button type="submit" size="lg" disabled={aGuardar}>
            {aGuardar && <LoaderCircleIcon className="animate-spin" />}
            {contratoId ? "Guardar" : "Criar contrato"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
