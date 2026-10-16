"use client"

import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircleIcon } from "lucide-react"
import { toast } from "sonner"

import { Opcoes } from "@/app/(app)/orcamentos/[id]/_componentes/opcoes"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAcaoFormulario } from "@/hooks/use-acao-formulario"
import { DATA_MAXIMA, DATA_MINIMA } from "@/lib/datas"
import { formatarData } from "@/lib/formatar"
import { NOMES_TIPO_MANUTENCAO, TIPOS_MANUTENCAO, type TipoManutencao } from "@/lib/recursos"
import { paraCampo } from "@/lib/validacao/comum"
import {
  eTipoComPrazo,
  esquemaManutencao,
  type CamposManutencao,
  type DadosManutencao,
  type TipoComPrazo,
} from "@/lib/validacao/equipamentos"
import { atualizarManutencao, criarManutencao } from "./acoes"

export type Manutencao = {
  id: string
  data: string
  tipo: TipoManutencao
  descricao: string | null
  custo: number | null
  contador: number | null
  autor: string | null
  updated_at: string
}

/** Datas atuais do equipamento (para mostrar o que a nova data substitui). */
export type PrazosEquipamento = Record<TipoComPrazo, string | null>

type Props = {
  equipamentoId: string
  /** Viaturas: contador em km e manutenções de IPO. */
  viatura: boolean
  prazos: PrazosEquipamento
  hoje: string
  /** Ao editar: a manutenção (sem ela, o formulário regista uma nova). */
  manutencao?: Manutencao
  aoTerminar: () => void
}

const ROTULO_NOVA_DATA: Record<TipoComPrazo, string> = {
  revisao: "Próxima revisão em",
  ipo: "IPO válida até",
  seguro: "Seguro válido até",
}

function valoresIniciais(manutencao: Manutencao | undefined, hoje: string): CamposManutencao {
  return {
    data: manutencao?.data ?? hoje,
    tipo: manutencao?.tipo ?? "revisao",
    descricao: manutencao?.descricao ?? "",
    custo: manutencao?.custo === null || manutencao?.custo === undefined ? "" : manutencao.custo.toFixed(2).replace(".", ","),
    contador: paraCampo(manutencao?.contador),
    nova_data: "",
  }
}

/** Registar ou editar uma manutenção (largo e com botões grandes, para o telemóvel). */
export function FormularioManutencao({ equipamentoId, viatura, prazos, hoje, manutencao, aoTerminar }: Props) {
  const form = useForm<CamposManutencao, unknown, DadosManutencao>({
    resolver: zodResolver(esquemaManutencao),
    defaultValues: valoresIniciais(manutencao, hoje),
  })

  const { submeter, aGuardar } = useAcaoFormulario(
    form,
    (valores) =>
      manutencao
        ? atualizarManutencao(equipamentoId, manutencao.id, valores)
        : criarManutencao(equipamentoId, valores),
    {
      // A mensagem diz também se a data do equipamento foi atualizada (ou não).
      semNotificacao: true,
      aoConcluir: (resultado) => {
        if (resultado.dados?.aviso) toast.warning(resultado.mensagem, { duration: 10_000 })
        else toast.success(resultado.mensagem ?? "Guardado.")
        aoTerminar()
      },
    }
  )

  const tipo = useWatch({ control: form.control, name: "tipo" })
  // A IPO só existe nas viaturas (fica a opção se já for o tipo desta manutenção).
  const opcoesTipo = TIPOS_MANUTENCAO.filter((t) => t !== "ipo" || viatura || manutencao?.tipo === "ipo").map((t) => ({
    valor: t,
    nome: NOMES_TIPO_MANUTENCAO[t],
  }))
  const comPrazo = eTipoComPrazo(tipo) && (tipo !== "ipo" || viatura)
  const titulo = manutencao ? "Editar manutenção" : "Registar manutenção"

  return (
    <Form {...form}>
      <form
        onSubmit={submeter}
        noValidate
        aria-label={titulo}
        className="grid gap-4 rounded-xl border border-primary/40 bg-accent/30 p-4"
      >
        <p className="font-semibold">{titulo}</p>
        <FormField
          control={form.control}
          name="tipo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo</FormLabel>
              <Opcoes
                nome={field.name}
                rotulo="Tipo de manutenção"
                valor={field.value}
                opcoes={opcoesTipo}
                aoMudar={(valor) => field.onChange(valor)}
                className={opcoesTipo.length === 5 ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4"}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="data"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data *</FormLabel>
                <FormControl>
                  <Input type="date" min={DATA_MINIMA} max={DATA_MAXIMA} className="bg-background" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {comPrazo && (
            <FormField
              control={form.control}
              name="nova_data"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{ROTULO_NOVA_DATA[tipo as TipoComPrazo]}</FormLabel>
                  <FormControl>
                    <Input type="date" min={DATA_MINIMA} max={DATA_MAXIMA} className="bg-background" {...field} />
                  </FormControl>
                  <FormDescription>
                    Opcional: atualiza também o equipamento
                    {prazos[tipo as TipoComPrazo] ? ` (agora: ${formatarData(prazos[tipo as TipoComPrazo])})` : ""}.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
        <FormField
          control={form.control}
          name="descricao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Textarea
                  rows={2}
                  className="min-h-16 bg-background"
                  placeholder={
                    tipo === "reparacao"
                      ? "Ex.: substituição do carburador na oficina Silva"
                      : tipo === "seguro"
                        ? "Ex.: renovação anual, apólice n.º 123456"
                        : "Ex.: óleo, filtros e pastilhas"
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
            name="custo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Custo</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="Ex.: 85,50"
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
            name="contador"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{viatura ? "Quilómetros" : "Horas de uso"}</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder={viatura ? "Ex.: 152 340" : "Ex.: 210"}
                      className="bg-background pr-10"
                      {...field}
                    />
                  </FormControl>
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
                  >
                    {viatura ? "km" : "h"}
                  </span>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="lg" onClick={aoTerminar} disabled={aGuardar}>
            Cancelar
          </Button>
          <Button type="submit" size="lg" disabled={aGuardar}>
            {aGuardar && <LoaderCircleIcon className="animate-spin" />}
            {manutencao ? "Guardar manutenção" : "Registar manutenção"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
