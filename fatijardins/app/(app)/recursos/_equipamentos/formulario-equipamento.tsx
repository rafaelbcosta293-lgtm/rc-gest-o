"use client"

import Link from "next/link"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircleIcon } from "lucide-react"

import { Opcoes } from "@/app/(app)/orcamentos/[id]/_componentes/opcoes"
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
import { Textarea } from "@/components/ui/textarea"
import { useAcaoFormulario } from "@/hooks/use-acao-formulario"
import { DATA_MAXIMA, DATA_MINIMA } from "@/lib/datas"
import {
  DIAS_AVISO,
  ESTADOS_EQUIPAMENTO,
  NOMES_ESTADO_EQUIPAMENTO,
  NOMES_TIPO_EQUIPAMENTO,
  normalizarMatricula,
  TIPOS_EQUIPAMENTO,
} from "@/lib/recursos"
import { esquemaEquipamento, type CamposEquipamento, type DadosEquipamento } from "@/lib/validacao/equipamentos"
import { atualizarEquipamento, criarEquipamento } from "./acoes"

type Opcao = { id: string; nome: string }

type Props = {
  valoresIniciais: CamposEquipamento
  equipas: Opcao[]
  colaboradores: Opcao[]
  /** Ao editar: o equipamento (sem ele, o formulário cria). */
  equipamentoId?: string
  cancelarHref: string
}

const OPCOES_TIPO = TIPOS_EQUIPAMENTO.map((tipo) => ({ valor: tipo, nome: NOMES_TIPO_EQUIPAMENTO[tipo] }))
const OPCOES_ESTADO = ESTADOS_EQUIPAMENTO.map((estado) => ({ valor: estado, nome: NOMES_ESTADO_EQUIPAMENTO[estado] }))

/** Criar ou editar um equipamento (só o gerente). */
export function FormularioEquipamento({ valoresIniciais, equipas, colaboradores, equipamentoId, cancelarHref }: Props) {
  const form = useForm<CamposEquipamento, unknown, DadosEquipamento>({
    resolver: zodResolver(esquemaEquipamento),
    defaultValues: valoresIniciais,
  })

  const { submeter, aGuardar } = useAcaoFormulario(
    form,
    (valores) => (equipamentoId ? atualizarEquipamento(equipamentoId, valores) : criarEquipamento(valores)),
    // A página "Novo equipamento" fica guardada pelo Next.js: limpar depois de criar.
    { aoConcluir: () => (equipamentoId ? undefined : form.reset()) }
  )

  const [tipo, matricula, ipo] = useWatch({ control: form.control, name: ["tipo", "matricula", "ipo_ate"] })
  const viatura = tipo === "viatura"

  return (
    <Form {...form}>
      <form onSubmit={submeter} className="grid gap-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Equipamento</CardTitle>
          </CardHeader>
          <CardContent className="grid items-start gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Tipo *</FormLabel>
                  <Opcoes
                    nome={field.name}
                    rotulo="Tipo de equipamento"
                    valor={field.value}
                    opcoes={OPCOES_TIPO}
                    aoMudar={(valor) => field.onChange(valor)}
                    className="grid-cols-2 sm:grid-cols-4"
                  />
                  {!viatura && (matricula.trim() || ipo) && (
                    <FormDescription>
                      Só as viaturas têm matrícula e IPO: ao guardar, deixam de ficar registadas neste equipamento.
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" placeholder="Ex.: Carrinha Ford Transit, Corta-relva Honda" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="marca"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Marca</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" placeholder="Ex.: Stihl" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="modelo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modelo</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" placeholder="Ex.: FS 131" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="numero_serie"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>N.º de série</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {viatura && (
              <FormField
                control={form.control}
                name="matricula"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Matrícula</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        placeholder="AA-12-BC"
                        className="font-mono uppercase placeholder:normal-case"
                        {...field}
                        onBlur={() => {
                          // "aa12bc" → "AA-12-BC" ao sair do campo.
                          if (field.value.trim()) field.onChange(normalizarMatricula(field.value))
                          field.onBlur()
                        }}
                      />
                    </FormControl>
                    <FormDescription>Pode escrever sem hífenes (ex.: AA12BC).</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{equipamentoId ? "Estado e atribuição" : "Atribuição"}</CardTitle>
            <CardDescription>Sem equipa nem pessoa, o equipamento fica no armazém.</CardDescription>
          </CardHeader>
          <CardContent className="grid items-start gap-4 sm:grid-cols-2">
            {equipamentoId && (
              <FormField
                control={form.control}
                name="estado"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Estado</FormLabel>
                    <Opcoes
                      nome={field.name}
                      rotulo="Estado do equipamento"
                      valor={field.value}
                      opcoes={OPCOES_ESTADO}
                      aoMudar={(valor) => field.onChange(valor)}
                      className="grid-cols-2 sm:grid-cols-4"
                    />
                    <FormDescription>
                      Abatido: deixou de ser usado. Sai da lista dos ativos mas mantém o histórico.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="equipa_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Equipa</FormLabel>
                  <FormControl>
                    <NativeSelect {...field}>
                      <option value="">Nenhuma</option>
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
              name="colaborador_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pessoa</FormLabel>
                  <FormControl>
                    <NativeSelect {...field}>
                      <option value="">Nenhuma</option>
                      {colaboradores.map((colaborador) => (
                        <option key={colaborador.id} value={colaborador.id}>
                          {colaborador.nome}
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
            <CardTitle>Datas e prazos</CardTitle>
            <CardDescription>
              Os prazos aparecem como alerta {DIAS_AVISO} dias antes de vencerem.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid items-start gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="proxima_revisao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Próxima revisão</FormLabel>
                  <FormControl>
                    <Input type="date" min={DATA_MINIMA} max={DATA_MAXIMA} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="seguro_ate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Seguro válido até</FormLabel>
                  <FormControl>
                    <Input type="date" min={DATA_MINIMA} max={DATA_MAXIMA} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {viatura && (
              <FormField
                control={form.control}
                name="ipo_ate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IPO válida até</FormLabel>
                    <FormControl>
                      <Input type="date" min={DATA_MINIMA} max={DATA_MAXIMA} {...field} />
                    </FormControl>
                    <FormDescription>Inspeção periódica obrigatória.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="data_aquisicao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de aquisição</FormLabel>
                  <FormControl>
                    <Input type="date" min={DATA_MINIMA} max={DATA_MAXIMA} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="notas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Notas</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="Ex.: guardar na garagem; usa mistura a 2%; chave suplente no escritório"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button asChild type="button" variant="outline" size="lg">
            <Link href={cancelarHref}>{equipamentoId ? "Voltar" : "Cancelar"}</Link>
          </Button>
          <Button type="submit" size="lg" disabled={aGuardar}>
            {aGuardar && <LoaderCircleIcon className="animate-spin" />}
            {equipamentoId ? "Guardar" : "Criar equipamento"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
