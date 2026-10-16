import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarCheckIcon, CameraIcon, ChevronRightIcon, FilePlusIcon, FileTextIcon, MapPinIcon, PencilIcon } from "lucide-react"

import { BotaoApagar } from "@/app/(app)/clientes/botao-apagar"
import { CartaoLocal } from "@/app/(app)/trabalhos/[id]/_componentes/cartao-local"
import { Secao } from "@/app/(app)/trabalhos/[id]/_componentes/secao"
import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { exigirPerfil } from "@/lib/auth"
import { formatarDiaLongo } from "@/lib/datas"
import { formatarArea, formatarData, formatarDataHora, formatarHora, formatarMoeda, hojeEmLisboa } from "@/lib/formatar"
import { estaExpirado, formatarNumeroOrcamento } from "@/lib/orcamentos"
import { eGerente } from "@/lib/perfis"
import { createClient } from "@/lib/supabase/server"
import { BUCKET_FOTOS } from "@/lib/trabalhos"
import { idObrigatorio } from "@/lib/validacao/comum"
import { nomeSitioVisita } from "@/lib/visitas"
import { BadgeEstadoOrcamento, BadgeExpirado } from "../../_componentes/badges"
import { EsqueletoVisita } from "../_componentes/esqueletos"
import { apagarVisita } from "../acoes"
import { FotosVisita, type FotoVisita } from "./_componentes/fotos-visita"

export const metadata = { title: "Visita" }

/** Validade dos URLs das fotos (segundos). */
const VALIDADE_URLS = 60 * 60

export default function PaginaVisita(props: PageProps<"/orcamentos/visitas/[id]">) {
  return (
    <Suspense fallback={<EsqueletoVisita />}>
      <FichaVisita params={props.params} />
    </Suspense>
  )
}

async function FichaVisita({ params }: { params: PageProps<"/orcamentos/visitas/[id]">["params"] }) {
  const sessao = await exigirPerfil("gerente", "chefe_equipa")
  const { id } = await params
  if (!idObrigatorio.safeParse(id).success) notFound()

  const supabase = await createClient()
  const { data: visita, error } = await supabase
    .from("visitas")
    .select(
      `id, data, hora, medidas, area_m2, notas, criado_por, created_at,
       responsavel:colaboradores!visitas_responsavel_id_fkey(nome),
       autor:colaboradores!visitas_criado_por_fkey(nome),
       local:locais(nome, morada, codigo_postal, localidade, latitude, longitude, area_m2, notas),
       cliente:clientes(id, nome, pessoa_contacto, telemovel, telefone)`
    )
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`Não foi possível carregar a visita: ${error.message}`)
  if (!visita) notFound()

  const [fotosR, orcamentosR] = await Promise.all([
    supabase
      .from("fotos")
      .select("id, caminho, legenda, largura, altura, created_at, autor:colaboradores(nome)")
      .eq("visita_id", visita.id)
      .order("created_at"),
    supabase
      .from("orcamentos")
      .select("id, ano, numero, titulo, estado, total, validade")
      .eq("visita_id", visita.id)
      .order("ano", { ascending: false })
      .order("numero", { ascending: false }),
  ])
  if (fotosR.error) throw new Error(`Não foi possível carregar as fotos: ${fotosR.error.message}`)
  if (orcamentosR.error) throw new Error(`Não foi possível carregar os orçamentos: ${orcamentosR.error.message}`)
  const fotos = fotosR.data
  const orcamentos = orcamentosR.data

  // URLs temporários para as fotos (o bucket é privado).
  const urls = new Map<string, string>()
  if (fotos.length > 0) {
    const { data: assinados } = await supabase.storage.from(BUCKET_FOTOS).createSignedUrls(
      fotos.map((foto) => foto.caminho),
      VALIDADE_URLS
    )
    for (const item of assinados ?? []) {
      if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl)
    }
  }
  const fotosVisita: FotoVisita[] = fotos.map((foto) => ({
    id: foto.id,
    url: urls.get(foto.caminho) ?? null,
    largura: foto.largura,
    altura: foto.altura,
    legenda: foto.legenda,
    autor: foto.autor?.nome ?? null,
    quando: formatarDataHora(foto.created_at),
  }))

  // Hora atual depois do createClient() (pedido dinâmico).
  const agora = new Date()
  const hoje = hojeEmLisboa(agora)
  const dataExtenso = formatarDiaLongo(visita.data)
  const sitio = nomeSitioVisita(visita.cliente?.nome, visita.local?.nome)

  // Apaga o gerente ou quem criou a visita; os orçamentos feitos a partir dela ficam sem visita.
  const podeApagar = eGerente(sessao.colaborador.perfil) || visita.criado_por === sessao.colaborador.id

  return (
    <>
      <CabecalhoPagina
        titulo={visita.cliente ? `Visita a ${visita.cliente.nome}` : "Visita"}
        voltar={{ href: "/orcamentos/visitas", texto: "Visitas" }}
        descricao={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {visita.data === hoje ? (
              <Badge>Hoje</Badge>
            ) : (
              visita.data > hoje && <Badge variant="secondary">Próxima</Badge>
            )}
            <span className="font-medium text-foreground">
              {dataExtenso.charAt(0).toUpperCase() + dataExtenso.slice(1)}
              {visita.hora && `, ${formatarHora(visita.hora)}`}
            </span>
            {visita.local && <span>{visita.local.nome}</span>}
          </span>
        }
        acoes={
          <>
            <Button asChild size="lg">
              <Link href={`/orcamentos/novo?visita=${visita.id}`}>
                <FilePlusIcon />
                Criar orçamento
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href={`/orcamentos/visitas/${visita.id}/editar`}>
                <PencilIcon />
                Editar
              </Link>
            </Button>
            {podeApagar && (
              <BotaoApagar
                acao={apagarVisita.bind(null, visita.id)}
                titulo="Apagar esta visita?"
                descricao={
                  <>
                    Vai apagar a visita de {formatarData(visita.data)} a <strong>{sitio}</strong>
                    {fotos.length > 0 && (fotos.length === 1 ? ", com a sua foto" : `, com as suas ${fotos.length} fotos`)}.
                    {orcamentos.length > 0 &&
                      (orcamentos.length === 1
                        ? " O orçamento feito a partir desta visita não é apagado: fica sem visita."
                        : ` Os ${orcamentos.length} orçamentos feitos a partir desta visita não são apagados: ficam sem visita.`)}{" "}
                    Esta ação não pode ser desfeita.
                  </>
                }
              />
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Secao id="titulo-visita" titulo="Visita" icone={CalendarCheckIcon}>
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <Dado rotulo="Responsável">{visita.responsavel?.nome ?? "Sem responsável"}</Dado>
            <Dado rotulo="Área">{formatarArea(visita.area_m2) || "—"}</Dado>
          </div>
          <Dado rotulo="Medidas">
            {visita.medidas ? (
              <span className="whitespace-pre-line">{visita.medidas}</span>
            ) : (
              <span className="font-normal text-muted-foreground">Sem medidas registadas.</span>
            )}
          </Dado>
          <Dado rotulo="Notas">
            {visita.notas ? (
              <span className="whitespace-pre-line">{visita.notas}</span>
            ) : (
              <span className="font-normal text-muted-foreground">Sem notas.</span>
            )}
          </Dado>
          <p className="text-xs text-muted-foreground">
            Registada {visita.autor ? `por ${visita.autor.nome} ` : ""}em {formatarDataHora(visita.created_at)}.
          </p>
        </Secao>

        <div className="grid gap-4">
          <Secao id="titulo-local" titulo="Local" icone={MapPinIcon}>
            <CartaoLocal local={visita.local} cliente={visita.cliente} ligarAoCliente />
          </Secao>

          <Secao
            id="titulo-orcamentos"
            titulo="Orçamentos"
            icone={FileTextIcon}
            descricao={orcamentos.length === 0 ? "Ainda não há orçamentos desta visita." : undefined}
          >
            {orcamentos.length > 0 && (
              <ul className="-my-2 min-w-0 divide-y">
                {orcamentos.map((orcamento) => (
                  <li key={orcamento.id}>
                    <Link
                      href={`/orcamentos/${orcamento.id}`}
                      className="flex min-h-14 items-center gap-3 py-2.5 transition-colors hover:text-primary"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium break-words">{orcamento.titulo}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                          <span className="tabular-nums">N.º {formatarNumeroOrcamento(orcamento.ano, orcamento.numero)}</span>
                          <BadgeEstadoOrcamento estado={orcamento.estado} />
                          {estaExpirado(orcamento, hoje) && <BadgeExpirado />}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{formatarMoeda(orcamento.total)}</span>
                      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Button asChild size="lg" variant={orcamentos.length === 0 ? "default" : "outline"} className="sm:w-fit">
              <Link href={`/orcamentos/novo?visita=${visita.id}`}>
                <FilePlusIcon />
                {orcamentos.length === 0 ? "Criar orçamento" : "Criar outro orçamento"}
              </Link>
            </Button>
          </Secao>
        </div>
      </div>

      <Secao
        id="titulo-fotos"
        titulo="Fotos"
        icone={CameraIcon}
        descricao={fotos.length > 0 ? (fotos.length === 1 ? "1 foto" : `${fotos.length} fotos`) : undefined}
        className="mt-4"
      >
        <FotosVisita visitaId={visita.id} fotos={fotosVisita} urlsGeradosEm={agora.getTime()} />
      </Secao>
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
