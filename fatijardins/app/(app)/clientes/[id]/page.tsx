import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  HistoryIcon,
  MailIcon,
  MapPinIcon,
  MapPinPlusIcon,
  MessageSquareTextIcon,
  NavigationIcon,
  PencilIcon,
  PhoneIcon,
  StickyNoteIcon,
} from "lucide-react"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { EstadoVazio } from "@/components/estado-vazio"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { exigirPerfil } from "@/lib/auth"
import { formatarArea } from "@/lib/formatar"
import { moradaCompleta, urlGoogleMaps, urlWaze } from "@/lib/mapas"
import { eGerente } from "@/lib/perfis"
import type { Tables } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { idObrigatorio } from "@/lib/validacao/comum"
import { apagarCliente } from "../acoes"
import { BotaoApagar } from "../botao-apagar"
import { BotaoEstadoCliente } from "../botao-estado-cliente"
import { EsqueletoFicha } from "../esqueletos"
import { EsqueletoCartaoHistorico, OrcamentosCliente, TrabalhosCliente, VisitasCliente } from "./historico"

export const metadata = { title: "Cliente" }

/** Número só com algarismos e "+", para as ligações tel: e sms:. */
function numeroParaLigacao(numero: string) {
  return numero.replace(/[^\d+]/g, "")
}

export default function PaginaCliente(props: PageProps<"/clientes/[id]">) {
  return (
    <Suspense fallback={<EsqueletoFicha />}>
      <FichaCliente params={props.params} />
    </Suspense>
  )
}

async function FichaCliente({ params }: { params: PageProps<"/clientes/[id]">["params"] }) {
  const sessao = await exigirPerfil("gerente", "chefe_equipa")
  const { id } = await params
  if (!idObrigatorio.safeParse(id).success) notFound()

  const supabase = await createClient()
  const [{ data: cliente }, { data: locais }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("locais")
      .select("*")
      .eq("cliente_id", id)
      .order("ativo", { ascending: false })
      .order("nome"),
  ])
  if (!cliente) notFound()

  const gerente = eGerente(sessao.colaborador.perfil)
  const morada = moradaCompleta({
    morada: cliente.morada,
    codigoPostal: cliente.codigo_postal,
    localidade: cliente.localidade,
  })
  const listaLocais = locais ?? []

  return (
    <>
      <CabecalhoPagina
        titulo={cliente.nome}
        voltar={{ href: "/clientes", texto: "Clientes" }}
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            {cliente.localidade && <span>{cliente.localidade}</span>}
            {!cliente.ativo && <Badge variant="muted">Inativo</Badge>}
          </span>
        }
        acoes={
          <>
            <Button asChild variant="outline" size="lg">
              <Link href={`/clientes/${cliente.id}/editar`}>
                <PencilIcon />
                Editar
              </Link>
            </Button>
            <BotaoEstadoCliente id={cliente.id} ativo={cliente.ativo} />
            {gerente && (
              <BotaoApagar
                acao={apagarCliente.bind(null, cliente.id)}
                titulo="Apagar este cliente?"
                descricao={
                  <>
                    Vai apagar <strong>{cliente.nome}</strong>
                    {listaLocais.length > 0 &&
                      ` e ${listaLocais.length === 1 ? "o seu local" : `os seus ${listaLocais.length} locais`}`}
                    . Esta ação não pode ser desfeita. Se o cliente apenas deixou de trabalhar
                    convosco, é preferível desativá-lo.
                  </>
                }
              />
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contactos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {!cliente.pessoa_contacto && !cliente.telemovel && !cliente.telefone && !cliente.email && (
              <p className="text-sm text-muted-foreground">Sem contactos registados.</p>
            )}
            {cliente.pessoa_contacto && (
              <Dado rotulo="Pessoa de contacto">{cliente.pessoa_contacto}</Dado>
            )}
            {cliente.telemovel && (
              <Dado rotulo="Telemóvel">
                <span className="tabular-nums">{cliente.telemovel}</span>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:flex">
                  <Button asChild size="lg">
                    <a href={`tel:${numeroParaLigacao(cliente.telemovel)}`}>
                      <PhoneIcon />
                      Ligar
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <a href={`sms:${numeroParaLigacao(cliente.telemovel)}`}>
                      <MessageSquareTextIcon />
                      SMS
                    </a>
                  </Button>
                </div>
              </Dado>
            )}
            {cliente.telefone && (
              <Dado rotulo="Telefone">
                <span className="tabular-nums">{cliente.telefone}</span>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:flex">
                  <Button asChild variant="outline" size="lg">
                    <a href={`tel:${numeroParaLigacao(cliente.telefone)}`}>
                      <PhoneIcon />
                      Ligar
                    </a>
                  </Button>
                </div>
              </Dado>
            )}
            {cliente.email && (
              <Dado rotulo="Email">
                <span className="break-all">{cliente.email}</span>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:flex">
                  <Button asChild variant="outline" size="lg">
                    <a href={`mailto:${cliente.email}`}>
                      <MailIcon />
                      Email
                    </a>
                  </Button>
                </div>
              </Dado>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dados de faturação</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Dado rotulo="NIF">
              <span className="tabular-nums">{cliente.nif ?? "—"}</span>
            </Dado>
            <Dado rotulo="Morada de faturação">{morada || "—"}</Dado>
            {cliente.notas && (
              <Dado rotulo="Notas">
                <span className="whitespace-pre-line">{cliente.notas}</span>
              </Dado>
            )}
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="titulo-locais" className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="titulo-locais" className="text-lg font-semibold">
            Locais / jardins
          </h2>
          <Button asChild size="lg">
            <Link href={`/clientes/${cliente.id}/locais/novo`}>
              <MapPinPlusIcon />
              Novo local
            </Link>
          </Button>
        </div>
        {listaLocais.length === 0 ? (
          <EstadoVazio
            icone={MapPinIcon}
            titulo="Ainda não há locais"
            descricao="Acrescente as moradas ou jardins onde a equipa trabalha para este cliente."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {listaLocais.map((local) => (
              <CartaoLocal key={local.id} local={local} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="titulo-historico" className="mt-8">
        <h2 id="titulo-historico" className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <HistoryIcon className="size-5" aria-hidden="true" />
          Histórico
        </h2>
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <div className="min-w-0 lg:col-span-2">
            <Suspense fallback={<EsqueletoCartaoHistorico />}>
              <TrabalhosCliente clienteId={cliente.id} chefe={!gerente} />
            </Suspense>
          </div>
          <div className="min-w-0">
            <Suspense fallback={<EsqueletoCartaoHistorico />}>
              <VisitasCliente clienteId={cliente.id} nomeCliente={cliente.nome} />
            </Suspense>
          </div>
          <div className="min-w-0">
            <Suspense fallback={<EsqueletoCartaoHistorico />}>
              <OrcamentosCliente clienteId={cliente.id} nomeCliente={cliente.nome} />
            </Suspense>
          </div>
        </div>
      </section>
    </>
  )
}

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="text-sm">
      <div className="text-muted-foreground">{rotulo}</div>
      <div className="mt-0.5 font-medium">{children}</div>
    </div>
  )
}

function CartaoLocal({ local }: { local: Tables<"locais"> }) {
  const destino = {
    latitude: local.latitude,
    longitude: local.longitude,
    morada: moradaCompleta({
      morada: local.morada,
      codigoPostal: local.codigo_postal,
      localidade: local.localidade,
    }),
  }
  const googleMaps = urlGoogleMaps(destino)
  const waze = urlWaze(destino)
  const cpLocalidade = [local.codigo_postal, local.localidade].filter(Boolean).join(" ")
  const area = formatarArea(local.area_m2)

  return (
    <Card className={local.ativo ? undefined : "opacity-75"}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {local.nome}
          {!local.ativo && <Badge variant="muted">Inativo</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div className="flex gap-2">
          <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <div>{local.morada}</div>
            {cpLocalidade && <div className="text-muted-foreground">{cpLocalidade}</div>}
            {area && <div className="text-muted-foreground">Área: {area}</div>}
          </div>
        </div>
        {local.notas && (
          <div className="flex gap-2 rounded-lg bg-accent/60 p-3 text-accent-foreground">
            <StickyNoteIcon className="mt-0.5 size-4 shrink-0" />
            <p className="whitespace-pre-line">{local.notas}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {googleMaps && (
            <Button asChild variant="outline" size="lg">
              <a href={googleMaps} target="_blank" rel="noopener noreferrer">
                <MapPinIcon />
                Google Maps
              </a>
            </Button>
          )}
          {waze && (
            <Button asChild variant="outline" size="lg">
              <a href={waze} target="_blank" rel="noopener noreferrer">
                <NavigationIcon />
                Waze
              </a>
            </Button>
          )}
          <Button asChild variant="ghost" size="lg" className="col-span-2">
            <Link href={`/clientes/${local.cliente_id}/locais/${local.id}/editar`}>
              <PencilIcon />
              Editar local
            </Link>
          </Button>
        </div>
        {local.latitude !== null && local.longitude !== null && (
          <p className="text-xs text-muted-foreground">
            Navegação pelas coordenadas GPS ({String(local.latitude).replace(".", ",")};{" "}
            {String(local.longitude).replace(".", ",")}).
          </p>
        )}
      </CardContent>
    </Card>
  )
}
