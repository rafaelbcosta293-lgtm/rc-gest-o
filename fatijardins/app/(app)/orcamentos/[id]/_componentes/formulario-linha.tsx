"use client"

import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAcaoFormulario } from "@/hooks/use-acao-formulario"
import { formatarMoeda } from "@/lib/formatar"
import {
  NOMES_TIPO_LINHA,
  nomeTaxaIva,
  TAXA_IVA_NORMAL,
  TAXAS_IVA,
  TIPOS_LINHA,
  totalLinha,
  UNIDADE_POR_TIPO,
  UNIDADES_SUGERIDAS,
  type TipoLinhaOrcamento,
} from "@/lib/orcamentos"
import { paraCampo } from "@/lib/validacao/comum"
import { esquemaLinha, type CamposLinha, type DadosLinha } from "@/lib/validacao/orcamentos"
import { atualizarLinha, criarLinha } from "../../_componentes/acoes"
import { Opcoes } from "./opcoes"

export type LinhaOrcamento = {
  id: string
  tipo: TipoLinhaOrcamento
  descricao: string
  quantidade: number
  unidade: string
  preco_unitario: number
  taxa_iva: number
  updated_at: string
}

type Props = {
  orcamentoId: string
  /** Ao editar: a linha (sem ela, o formulário acrescenta). */
  linha?: LinhaOrcamento
  /** Linha nova: o tipo e o IVA da última acrescentada (para encadear linhas parecidas). */
  tipoInicial?: TipoLinhaOrcamento
  taxaInicial?: number
  aoTerminar: () => void
  /** Linha nova acrescentada: o formulário fica aberto e limpo para a seguinte. */
  aoAcrescentar?: (tipo: TipoLinhaOrcamento, taxa: number) => void
}

function valoresIniciais(linha: LinhaOrcamento | undefined, tipo: TipoLinhaOrcamento, taxa: number): CamposLinha {
  if (linha) {
    return {
      tipo: linha.tipo,
      descricao: linha.descricao,
      quantidade: paraCampo(linha.quantidade),
      unidade: linha.unidade,
      preco_unitario: linha.preco_unitario.toFixed(2).replace(".", ","),
      taxa_iva: String(linha.taxa_iva),
    }
  }
  return {
    tipo,
    descricao: "",
    quantidade: "",
    unidade: UNIDADE_POR_TIPO[tipo],
    preco_unitario: "",
    taxa_iva: String(taxa),
  }
}

const OPCOES_TIPO = TIPOS_LINHA.map((tipo) => ({ valor: tipo, nome: NOMES_TIPO_LINHA[tipo] }))
const OPCOES_IVA = TAXAS_IVA.map((taxa) => ({ valor: String(taxa), nome: taxa === 0 ? "Isento" : nomeTaxaIva(taxa) }))

/** Acrescentar ou editar uma linha do orçamento (largo e com botões grandes, para o telemóvel). */
export function FormularioLinha({
  orcamentoId,
  linha,
  tipoInicial = "mao_de_obra",
  taxaInicial = TAXA_IVA_NORMAL,
  aoTerminar,
  aoAcrescentar,
}: Props) {
  const form = useForm<CamposLinha, unknown, DadosLinha>({
    resolver: zodResolver(esquemaLinha),
    defaultValues: valoresIniciais(linha, tipoInicial, taxaInicial),
  })

  const { submeter, aGuardar } = useAcaoFormulario(
    form,
    (valores) => (linha ? atualizarLinha(orcamentoId, linha.id, valores) : criarLinha(orcamentoId, valores)),
    {
      aoConcluir: () => {
        if (linha) return aoTerminar()
        // Fica aberto para a linha seguinte, com o mesmo tipo e IVA.
        const { tipo, taxa_iva } = form.getValues()
        const taxa = Number(taxa_iva)
        form.reset(valoresIniciais(undefined, tipo, taxa))
        aoAcrescentar?.(tipo, taxa)
        form.setFocus("descricao")
      },
    }
  )

  const [tipo, quantidade, unidade, preco, taxa] = useWatch({
    control: form.control,
    name: ["tipo", "quantidade", "unidade", "preco_unitario", "taxa_iva"],
  })

  // Total da linha enquanto se escreve (as mesmas contas da BD).
  const q = esquemaLinha.shape.quantidade.safeParse(quantidade)
  const p = esquemaLinha.shape.preco_unitario.safeParse(preco)
  const total = q.success && p.success ? totalLinha({ quantidade: q.data, preco_unitario: p.data, taxa_iva: Number(taxa) }) : null

  function mudarTipo(novo: TipoLinhaOrcamento) {
    // A unidade acompanha o tipo enquanto for a proposta para o tipo anterior.
    if (form.getValues("unidade") === UNIDADE_POR_TIPO[form.getValues("tipo")]) {
      form.setValue("unidade", UNIDADE_POR_TIPO[novo], { shouldValidate: form.formState.isSubmitted })
    }
    form.setValue("tipo", novo, { shouldDirty: true })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={submeter}
        noValidate
        aria-label={linha ? "Editar linha" : "Nova linha"}
        className="grid gap-4 rounded-xl border border-primary/40 bg-accent/30 p-4"
      >
        <p className="font-semibold">{linha ? "Editar linha" : "Nova linha"}</p>
        <FormField
          control={form.control}
          name="tipo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo</FormLabel>
              <Opcoes
                nome={field.name}
                rotulo="Tipo de linha"
                valor={field.value}
                opcoes={OPCOES_TIPO}
                aoMudar={mudarTipo}
                className="grid-cols-2 sm:grid-cols-4"
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="descricao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição *</FormLabel>
              <FormControl>
                <Textarea
                  rows={2}
                  className="min-h-16 bg-background"
                  placeholder={
                    tipo === "mao_de_obra"
                      ? "Ex.: Corte e limpeza da sebe"
                      : tipo === "material"
                        ? "Ex.: Terra vegetal (saco de 50 L)"
                        : tipo === "equipamento"
                          ? "Ex.: Aluguer de mini-escavadora"
                          : "Ex.: Transporte dos verdes para o ecocentro"
                  }
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 items-start gap-3">
          <FormField
            control={form.control}
            name="quantidade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantidade *</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" autoComplete="off" placeholder="Ex.: 2,5" className="bg-background" {...field} />
                </FormControl>
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
                  <Input autoComplete="off" placeholder="Ex.: h" className="bg-background" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="-mt-1 flex flex-wrap gap-1.5" aria-label="Unidades sugeridas">
          {UNIDADES_SUGERIDAS.map((sugestao) => (
            <Button
              key={sugestao}
              type="button"
              variant={unidade === sugestao ? "secondary" : "outline"}
              className="h-9 min-w-11 rounded-full px-3"
              onClick={() =>
                form.setValue("unidade", sugestao, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
              }
            >
              {sugestao}
            </Button>
          ))}
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="preco_unitario"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preço unitário (sem IVA) *</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="Ex.: 25,00"
                      className="bg-background pr-8"
                      {...field}
                    />
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
                <Opcoes
                  nome={field.name}
                  rotulo="Taxa de IVA"
                  valor={field.value}
                  opcoes={OPCOES_IVA}
                  aoMudar={(valor) => field.onChange(valor)}
                  className="grid-cols-4"
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <p className="text-sm" aria-live="polite">
          Total da linha (sem IVA):{" "}
          <strong className="tabular-nums">{total === null ? "—" : formatarMoeda(total)}</strong>
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="lg" onClick={aoTerminar} disabled={aGuardar}>
            {linha ? "Cancelar" : "Fechar"}
          </Button>
          <Button type="submit" size="lg" disabled={aGuardar}>
            {aGuardar && <LoaderCircleIcon className="animate-spin" />}
            {linha ? "Guardar linha" : "Acrescentar linha"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
