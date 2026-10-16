"use client"

import { useId } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircleIcon, PackageIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { useAcaoFormulario } from "@/hooks/use-acao-formulario"
import {
  esquemaMaterial,
  MATERIAL_OUTRO,
  UNIDADES_MATERIAL,
  type CamposMaterial,
  type DadosMaterial,
} from "@/lib/validacao/registos"
import { adicionarMaterial, apagarMaterial } from "../acoes"
import { Confirmar } from "./confirmar"

export type MaterialGasto = {
  id: string
  descricao: string
  /** Quantidade já formatada à portuguesa ("2,5"). */
  quantidade: string
  unidade: string
  /** Artigo do catálogo (gerou uma saída de stock). */
  doStock: boolean
}

/** Artigo do catálogo (consumível ativo) que se pode escolher. */
export type ArtigoCatalogo = {
  id: string
  nome: string
  categoria: string | null
  unidade: string
}

const SEM_CATEGORIA = "Outros artigos"

/** Artigos agrupados por categoria (por ordem alfabética; os sem categoria no fim). */
function agruparPorCategoria(catalogo: ArtigoCatalogo[]) {
  const grupos = new Map<string | null, ArtigoCatalogo[]>()
  for (const artigo of catalogo) {
    const categoria = artigo.categoria?.trim() || null
    grupos.set(categoria, [...(grupos.get(categoria) ?? []), artigo])
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b, "pt")))
    .map(([categoria, artigos]) => ({
      categoria: categoria ?? SEM_CATEGORIA,
      artigos: artigos.sort((a, b) => a.nome.localeCompare(b.nome, "pt")),
    }))
}

/** Lista dos materiais gastos, com formulário para acrescentar (do catálogo ou "Outro"). */
export function Materiais({
  trabalhoId,
  materiais,
  catalogo,
}: {
  trabalhoId: string
  materiais: MaterialGasto[]
  catalogo: ArtigoCatalogo[]
}) {
  // Sem catálogo, o formulário é só o do material escrito à mão.
  const temCatalogo = catalogo.length > 0
  const vazio: CamposMaterial = {
    consumivel_id: temCatalogo ? "" : MATERIAL_OUTRO,
    descricao: "",
    quantidade: "",
    unidade: "un",
  }

  const form = useForm<CamposMaterial, unknown, DadosMaterial>({
    resolver: zodResolver(esquemaMaterial),
    defaultValues: vazio,
  })
  const escolha = useWatch({ control: form.control, name: "consumivel_id" })
  const artigo = catalogo.find((item) => item.id === escolha) ?? null
  const outro = escolha === MATERIAL_OUTRO
  const idUnidade = useId()

  const { submeter, aGuardar } = useAcaoFormulario(
    form,
    // Com artigo do catálogo, a descrição é o nome dele (o que se escreveu em "Outro" não conta).
    (campos) => adicionarMaterial(trabalhoId, campos.consumivel_id === MATERIAL_OUTRO ? campos : { ...campos, descricao: "" }),
    {
      // Fica pronto para o material seguinte.
      aoConcluir: () => form.reset(vazio),
    }
  )

  return (
    <div className="grid gap-5">
      {materiais.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ainda não foram registados materiais.</p>
      ) : (
        <ul className="divide-y rounded-lg border" aria-label="Materiais gastos">
          {materiais.map((material) => (
            <li key={material.id} className="flex items-center gap-3 py-1 pr-1 pl-3">
              <span className="min-w-16 shrink-0 font-semibold tabular-nums">
                {material.quantidade} {material.unidade}
              </span>
              <span className="min-w-0 flex-1 py-1.5">
                <span className="block break-words">{material.descricao}</span>
                {material.doStock && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <PackageIcon className="size-3.5 shrink-0" aria-hidden="true" />
                    Do stock
                  </span>
                )}
              </span>
              <Confirmar
                gatilho={
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Apagar ${material.descricao}`}
                  >
                    <Trash2Icon className="size-5" />
                  </Button>
                }
                titulo="Apagar este material?"
                descricao={
                  material.doStock
                    ? `${material.quantidade} ${material.unidade} de ${material.descricao}. A quantidade volta ao stock.`
                    : `${material.quantidade} ${material.unidade} de ${material.descricao}`
                }
                confirmar="Apagar"
                acao={() => apagarMaterial(trabalhoId, material.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <Form {...form}>
        <form onSubmit={submeter} className="grid gap-3" noValidate aria-label="Adicionar material">
          {temCatalogo && (
            <FormField
              control={form.control}
              name="consumivel_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Material *</FormLabel>
                  <FormControl>
                    <NativeSelect {...field}>
                      <option value="" disabled>
                        Escolha o material…
                      </option>
                      {agruparPorCategoria(catalogo).map((grupo) => (
                        <optgroup key={grupo.categoria} label={grupo.categoria}>
                          {grupo.artigos.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.nome} ({item.unidade})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                      <optgroup label="Fora do catálogo">
                        <option value={MATERIAL_OUTRO}>Outro (escrever)</option>
                      </optgroup>
                    </NativeSelect>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {outro && (
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{temCatalogo ? "Descrição *" : "Material *"}</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex.: Adubo granulado" autoComplete="off" {...field} />
                  </FormControl>
                  {temCatalogo && <FormDescription>Material que não está no catálogo (não conta no stock).</FormDescription>}
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <div className="grid grid-cols-2 items-start gap-3">
            <FormField
              control={form.control}
              name="quantidade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade *</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" placeholder="Ex.: 2,5" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {outro ? (
              <FormField
                control={form.control}
                name="unidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidade</FormLabel>
                    <FormControl>
                      <NativeSelect {...field}>
                        {UNIDADES_MATERIAL.map((unidade) => (
                          <option key={unidade} value={unidade}>
                            {unidade}
                          </option>
                        ))}
                      </NativeSelect>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              // A unidade do artigo do catálogo não se muda.
              <div className="grid gap-2">
                <Label htmlFor={idUnidade}>Unidade</Label>
                <Input
                  id={idUnidade}
                  readOnly
                  value={artigo?.unidade ?? "—"}
                  className="border-dashed bg-muted/50 text-muted-foreground shadow-none focus-visible:ring-0"
                />
              </div>
            )}
          </div>
          <Button type="submit" size="lg" variant="secondary" disabled={aGuardar} className="sm:w-fit">
            {aGuardar ? <LoaderCircleIcon className="animate-spin" /> : <PlusIcon />}
            Adicionar material
          </Button>
        </form>
      </Form>
    </div>
  )
}
