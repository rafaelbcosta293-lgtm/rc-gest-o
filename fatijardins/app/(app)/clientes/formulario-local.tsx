"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircleIcon, LocateFixedIcon } from "lucide-react"

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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAcaoFormulario } from "@/hooks/use-acao-formulario"
import type { Tables } from "@/lib/supabase/database.types"
import { paraCampo } from "@/lib/validacao/comum"
import { esquemaLocal, type CamposLocal, type DadosLocal } from "@/lib/validacao/clientes"
import { atualizarLocal, criarLocal } from "./acoes"

type Props = {
  clienteId: string
  /** Local a editar; sem local o formulário cria um novo. */
  local?: Tables<"locais">
  /** Ao criar: morada do cliente para pré-preencher. */
  moradaCliente?: { morada: string | null; codigo_postal: string | null; localidade: string | null }
}

type EstadoLocalizacao =
  | { estado: "inativo" }
  | { estado: "a_obter" }
  | { estado: "obtida"; precisao: number }
  | { estado: "erro"; mensagem: string }

/** Precisão (em metros) a partir da qual avisamos que a posição pode estar longe. */
const PRECISAO_FRACA = 50

function valoresIniciais(local: Props["local"], moradaCliente: Props["moradaCliente"]): CamposLocal {
  return {
    nome: paraCampo(local?.nome),
    morada: paraCampo(local ? local.morada : moradaCliente?.morada),
    codigo_postal: paraCampo(local ? local.codigo_postal : moradaCliente?.codigo_postal),
    localidade: paraCampo(local ? local.localidade : moradaCliente?.localidade),
    latitude: paraCampo(local?.latitude),
    longitude: paraCampo(local?.longitude),
    area_m2: paraCampo(local?.area_m2),
    notas: paraCampo(local?.notas),
    ativo: local?.ativo ?? true,
  }
}

function mensagemErroLocalizacao(erro: GeolocationPositionError): string {
  switch (erro.code) {
    case erro.PERMISSION_DENIED:
      return "Não foi dada permissão para usar a localização. Autorize o acesso à localização nas definições do browser e tente de novo."
    case erro.POSITION_UNAVAILABLE:
      return "Não foi possível determinar a localização. Verifique se o GPS/localização do telemóvel está ligado."
    case erro.TIMEOUT:
      return "A localização demorou demasiado. Tente de novo, de preferência ao ar livre."
    default:
      return "Não foi possível obter a localização."
  }
}

/** Coordenada com 6 casas decimais, escrita à portuguesa (vírgula), como os outros números. */
function formatarCoordenada(valor: number): string {
  return valor.toFixed(6).replace(".", ",")
}

export function FormularioLocal({ clienteId, local, moradaCliente }: Props) {
  const form = useForm<CamposLocal, unknown, DadosLocal>({
    resolver: zodResolver(esquemaLocal),
    defaultValues: valoresIniciais(local, moradaCliente),
  })
  const [localizacao, setLocalizacao] = useState<EstadoLocalizacao>({ estado: "inativo" })

  const { submeter, aGuardar } = useAcaoFormulario(
    form,
    (valores) => (local ? atualizarLocal(clienteId, local.id, valores) : criarLocal(clienteId, valores)),
    {
      // A página fica guardada (Activity) depois de navegar: o "Novo local" volta a abrir limpo.
      aoConcluir: () => {
        setLocalizacao({ estado: "inativo" })
        if (!local) form.reset()
      },
    }
  )

  function usarMinhaLocalizacao() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocalizacao({ estado: "erro", mensagem: "Este dispositivo ou browser não permite obter a localização." })
      return
    }
    if (!window.isSecureContext) {
      setLocalizacao({
        estado: "erro",
        mensagem: "A localização só funciona numa ligação segura (https).",
      })
      return
    }
    setLocalizacao({ estado: "a_obter" })
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        const opcoes = { shouldDirty: true, shouldValidate: true } as const
        form.setValue("latitude", formatarCoordenada(posicao.coords.latitude), opcoes)
        form.setValue("longitude", formatarCoordenada(posicao.coords.longitude), opcoes)
        setLocalizacao({ estado: "obtida", precisao: Math.round(posicao.coords.accuracy) })
      },
      (erro) => setLocalizacao({ estado: "erro", mensagem: mensagemErroLocalizacao(erro) }),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 }
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={submeter} className="grid gap-6" noValidate>
        <fieldset className="grid items-start gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-base font-semibold">Local</legend>
          <FormField
            control={form.control}
            name="nome"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Nome do local *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Ex.: Moradia, Jardim do condomínio"
                    autoComplete="off"
                    autoFocus={!local}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="morada"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Morada *</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="codigo_postal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código postal</FormLabel>
                <FormControl>
                  <Input inputMode="numeric" placeholder="0000-000" maxLength={8} autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="localidade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Localidade</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="area_m2"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Área (m²)</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" autoComplete="off" placeholder="Ex.: 250" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <fieldset className="grid items-start gap-4 sm:grid-cols-2">
          <legend className="mb-1 text-base font-semibold">Coordenadas GPS</legend>
          <p className="text-sm text-muted-foreground sm:col-span-2">
            Opcional. Com coordenadas, o Google Maps e o Waze levam a equipa ao sítio exato (útil
            em quintas e terrenos sem número de porta).
          </p>
          <div className="grid gap-2 sm:col-span-2">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full sm:w-fit"
              onClick={usarMinhaLocalizacao}
              disabled={localizacao.estado === "a_obter"}
            >
              {localizacao.estado === "a_obter" ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : (
                <LocateFixedIcon />
              )}
              {localizacao.estado === "a_obter" ? "A obter a localização…" : "Usar a minha localização"}
            </Button>
            <div aria-live="polite" className="text-sm">
              {localizacao.estado === "obtida" && (
                <p className="text-muted-foreground">
                  Localização obtida com uma precisão de cerca de {localizacao.precisao} m.
                  {localizacao.precisao > PRECISAO_FRACA &&
                    " A precisão é fraca: se puder, tente de novo ao ar livre."}
                </p>
              )}
              {localizacao.estado === "erro" && <p className="text-destructive">{localizacao.mensagem}</p>}
            </div>
          </div>
          <FormField
            control={form.control}
            name="latitude"
            rules={{ deps: ["longitude"] }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Latitude</FormLabel>
                <FormControl>
                  <Input inputMode="text" autoComplete="off" placeholder="Ex.: 38,722252" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="longitude"
            rules={{ deps: ["latitude"] }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Longitude</FormLabel>
                <FormControl>
                  <Input inputMode="text" autoComplete="off" placeholder="Ex.: -9,139337" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <FormField
          control={form.control}
          name="notas"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas para a equipa</FormLabel>
              <FormControl>
                <Textarea rows={4} placeholder="Acessos, chaves, animais, rega…" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {local && (
          <FormField
            control={form.control}
            name="ativo"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div className="grid gap-1">
                  <FormLabel>Local ativo</FormLabel>
                  <FormDescription>Desative os locais onde já não se trabalha.</FormDescription>
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
            <Link href={`/clientes/${clienteId}`}>Cancelar</Link>
          </Button>
          <Button type="submit" size="lg" disabled={aGuardar}>
            {aGuardar && <LoaderCircleIcon className="animate-spin" />}
            {local ? "Guardar" : "Criar local"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
