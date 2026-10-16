"use client"

import Link from "next/link"
import { useForm, useWatch } from "react-hook-form"
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
import { NativeSelect } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAcaoFormulario } from "@/hooks/use-acao-formulario"
import { paraCampo } from "@/lib/validacao/comum"
import {
  esquemaConsumivel,
  NOMES_UNIDADE,
  type CamposConsumivel,
  type DadosConsumivel,
} from "@/lib/validacao/consumiveis"
import { UNIDADES_MATERIAL } from "@/lib/validacao/registos"
import { atualizarConsumivel, criarConsumivel } from "./acoes"

export type ConsumivelEditar = {
  id: string
  nome: string
  categoria: string | null
  unidade: string
  stock_minimo: number
  ativo: boolean
  notas: string | null
  preco_unitario: number | null
}

type Props = {
  /** Consumível a editar; sem ele o formulário cria um novo. */
  consumivel?: ConsumivelEditar
  /** Categorias já usadas (sugestões). */
  categorias: string[]
  /** Já há movimentos de stock: a unidade não se pode mudar. */
  unidadeBloqueada?: boolean
}

function valoresIniciais(consumivel?: ConsumivelEditar): CamposConsumivel {
  return {
    nome: paraCampo(consumivel?.nome),
    categoria: paraCampo(consumivel?.categoria),
    unidade: (consumivel?.unidade ?? "un") as CamposConsumivel["unidade"],
    stock_minimo: paraCampo(consumivel?.stock_minimo ?? null),
    preco_unitario:
      consumivel?.preco_unitario === null || consumivel?.preco_unitario === undefined
        ? ""
        : consumivel.preco_unitario.toFixed(2).replace(".", ","),
    notas: paraCampo(consumivel?.notas),
    ativo: consumivel?.ativo ?? true,
    stock_inicial: "",
  }
}

/** Sufixo dentro do campo (unidade ou €). */
function Sufixo({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
    >
      {children}
    </span>
  )
}

export function FormularioConsumivel({ consumivel, categorias, unidadeBloqueada = false }: Props) {
  const form = useForm<CamposConsumivel, unknown, DadosConsumivel>({
    resolver: zodResolver(esquemaConsumivel),
    defaultValues: valoresIniciais(consumivel),
  })

  const { submeter, aGuardar } = useAcaoFormulario(
    form,
    (valores) => (consumivel ? atualizarConsumivel(consumivel.id, valores) : criarConsumivel(valores)),
    {
      // A página fica guardada (Activity) depois de navegar: o "Novo consumível" volta a abrir vazio.
      aoConcluir: () => {
        if (!consumivel) form.reset()
      },
    }
  )

  const unidade = useWatch({ control: form.control, name: "unidade" })
  // A unidade gravada pode já não estar na lista (dados antigos): mostrá-la na mesma.
  const unidades: string[] = [...UNIDADES_MATERIAL]
  if (consumivel && !unidades.includes(consumivel.unidade)) unidades.unshift(consumivel.unidade)

  return (
    <Form {...form}>
      <form onSubmit={submeter} className="grid gap-6" noValidate>
        <fieldset className="grid items-start gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-base font-semibold">Artigo</legend>
          <FormField
            control={form.control}
            name="nome"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Nome *</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="off"
                    autoFocus={!consumivel}
                    placeholder="Ex.: Fio de roçadora 3 mm"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="categoria"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria</FormLabel>
                <FormControl>
                  <Input autoComplete="off" list="categorias-consumiveis" placeholder="Ex.: Adubos" {...field} />
                </FormControl>
                <datalist id="categorias-consumiveis">
                  {categorias.map((categoria) => (
                    <option key={categoria} value={categoria} />
                  ))}
                </datalist>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="unidade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unidade *</FormLabel>
                <FormControl>
                  <NativeSelect {...field} disabled={unidadeBloqueada}>
                    {unidades.map((opcao) => (
                      <option key={opcao} value={opcao}>
                        {NOMES_UNIDADE[opcao as keyof typeof NOMES_UNIDADE] ?? opcao}
                      </option>
                    ))}
                  </NativeSelect>
                </FormControl>
                {unidadeBloqueada && (
                  <FormDescription>
                    Já há movimentos de stock nesta unidade, por isso não se pode mudar. Se estiver errada, crie um
                    consumível novo e desative este.
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <fieldset className="grid items-start gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-base font-semibold">Stock e preço</legend>
          <FormField
            control={form.control}
            name="stock_minimo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stock mínimo</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input inputMode="decimal" autoComplete="off" placeholder="Ex.: 10" className="pr-16" {...field} />
                  </FormControl>
                  <Sufixo>{unidade}</Sufixo>
                </div>
                <FormDescription>Abaixo ou igual a este valor, aparece o alerta de stock baixo.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="preco_unitario"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preço unitário (compra)</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input inputMode="decimal" autoComplete="off" placeholder="Ex.: 1,85" className="pr-16" {...field} />
                  </FormControl>
                  <Sufixo>€/{unidade}</Sufixo>
                </div>
                <FormDescription>Só o gerente o vê. Serve para o valor em stock.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {!consumivel && (
            <FormField
              control={form.control}
              name="stock_inicial"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stock inicial</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input inputMode="decimal" autoComplete="off" placeholder="Ex.: 25" className="pr-16" {...field} />
                    </FormControl>
                    <Sufixo>{unidade}</Sufixo>
                  </div>
                  <FormDescription>Opcional: o que já existe no armazém (fica registado como entrada).</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </fieldset>

        <FormField
          control={form.control}
          name="notas"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas</FormLabel>
              <FormControl>
                <Textarea rows={3} placeholder="Ex.: fornecedor habitual, onde está guardado…" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {consumivel && (
          <FormField
            control={form.control}
            name="ativo"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div className="grid gap-1">
                  <FormLabel>Ativo</FormLabel>
                  <FormDescription>
                    Desativado, deixa de aparecer na escolha de materiais dos trabalhos. O histórico mantém-se.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button asChild type="button" variant="outline" size="lg">
            <Link href={consumivel ? `/recursos/consumiveis/${consumivel.id}` : "/recursos/consumiveis"}>Cancelar</Link>
          </Button>
          <Button type="submit" size="lg" disabled={aGuardar}>
            {aGuardar && <LoaderCircleIcon className="animate-spin" />}
            {consumivel ? "Guardar" : "Criar consumível"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
