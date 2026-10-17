import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  CameraIcon,
  ClipboardListIcon,
  ClockIcon,
  FlagIcon,
  MapPinIcon,
  NotebookPenIcon,
  PackageIcon,
  PencilIcon,
  SignatureIcon,
} from "lucide-react"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { ProvedorPicagem } from "@/components/horas/contexto-picagem"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { exigirSessao } from "@/lib/auth"
import { formatarDiaLongo } from "@/lib/datas"
import { dataEmLisboa } from "@/lib/horas"
import { formatarData, formatarDataHora, formatarDuracao, formatarHora, formatarNumero, hojeEmLisboa } from "@/lib/formatar"
import { formatarNumeroOrcamento } from "@/lib/orcamentos"
import { eGerente, eGerenteOuChefe } from "@/lib/perfis"
import { createClient } from "@/lib/supabase/server"
import {
  BUCKET_FOTOS,
  NOMES_ESTADO_TRABALHO,
  NOMES_ORIGEM_TRABALHO,
  NOMES_TIPO_TRABALHO,
  VARIANTE_ESTADO_TRABALHO,
} from "@/lib/trabalhos"
import { idObrigatorio } from "@/lib/validacao/comum"
import { Assinatura } from "./_componentes/assinatura"
import { CartaoLocal } from "./_componentes/cartao-local"
import { EsqueletoTrabalho } from "./_componentes/esqueleto"
import { EstadoTrabalhoBotoes } from "./_componentes/estado-trabalho"
import { Fotos, type FotoGaleria } from "./_componentes/fotos"
import { HorasTrabalho } from "./_componentes/horas-trabalho"
import { Materiais } from "./_componentes/materiais"
import { RegistoDia } from "./_componentes/registo-dia"
import { Secao } from "./_componentes/secao"

export const metadata = { title: "Trabalho" }

/** Validade dos URLs das fotos e da assinatura (segundos). */
const VALIDADE_URLS = 60 * 60

export default function PaginaTrabalho(props: PageProps<"/trabalhos/[id]">) {
  return (
    <Suspense fallback={<EsqueletoTrabalho />}>
      <FichaTrabalho params={props.params} />
    </Suspense>
  )
}

async function FichaTrabalho({ params }: { params: PageProps<"/trabalhos/[id]">["params"] }) {
  const sessao = await exigirSessao()
  const { id } = await params
  if (!idObrigatorio.safeParse(id).success) notFound()

  // A RLS decide quem vê: gerente, chefe da equipa, colaborador da equipa no próprio dia.
  const supabase = await createClient()
  const { data: trabalho, error } = await supabase
    .from("trabalhos")
    .select(
      `id, titulo, descricao, tipo, origem, data, hora_inicio, duracao_prevista_min, estado,
       equipa:equipas(id, nome, cor),
       orcamento:orcamentos!trabalhos_orcamento_id_fkey(id, ano, numero),
       contrato:contratos(id, titulo),
       local:locais(nome, morada, codigo_postal, localidade, latitude, longitude, area_m2, notas),
       cliente:clientes(id, nome, pessoa_contacto, telemovel, telefone)`
    )
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`Não foi possível carregar o trabalho: ${error.message}`)
  if (!trabalho) notFound()

  const [registoR, fotosR, horasR, abertoR, catalogoR] = await Promise.all([
    supabase
      .from("registos_trabalho")
      .select(
        `id, tarefas_feitas, notas, assinatura_caminho, assinatura_nome, assinado_em, updated_at,
         autor:colaboradores(nome),
         materiais:registo_materiais(id, descricao, quantidade, unidade, consumivel_id, created_at)`
      )
      .eq("trabalho_id", id)
      .maybeSingle(),
    supabase
      .from("fotos")
      .select("id, momento, caminho, largura, altura, colaborador_id, created_at, autor:colaboradores(nome)")
      .eq("trabalho_id", id)
      .order("created_at"),
    supabase
      .from("registos_horas")
      .select("id, entrada, saida, a_rever, colaborador:colaboradores(nome)")
      .eq("trabalho_id", id)
      .order("entrada"),
    // Entrada em aberto da própria pessoa (para o botão "Picar aqui").
    supabase
      .from("registos_horas")
      .select("entrada, trabalho_id")
      .eq("colaborador_id", sessao.colaborador.id)
      .is("saida", null)
      .maybeSingle(),
    // Catálogo para o formulário dos materiais: só os consumíveis ativos (sem preços nem stock).
    supabase
      .from("consumiveis")
      .select("id, nome, categoria, unidade")
      .eq("ativo", true)
      .order("categoria", { nullsFirst: false })
      .order("nome"),
  ])
  for (const resultado of [registoR, fotosR, horasR, abertoR, catalogoR]) {
    if (resultado.error) throw new Error(`Não foi possível carregar o trabalho: ${resultado.error.message}`)
  }
  const registo = registoR.data
  const fotos = fotosR.data ?? []
  const horas = horasR.data ?? []

  // URLs temporários para as fotos e a assinatura (o bucket é privado).
  const caminhos = fotos.map((foto) => foto.caminho)
  if (registo?.assinatura_caminho) caminhos.push(registo.assinatura_caminho)
  const urls = new Map<string, string>()
  if (caminhos.length > 0) {
    const { data: assinados } = await supabase.storage.from(BUCKET_FOTOS).createSignedUrls(caminhos, VALIDADE_URLS)
    for (const item of assinados ?? []) {
      if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl)
    }
  }

  // Hora atual depois do createClient() (pedido dinâmico).
  const agora = new Date()
  const hoje = hojeEmLisboa(agora)
  const perfil = sessao.colaborador.perfil
  const podeGerir = eGerenteOuChefe(perfil)
  // Contrato de origem: só o gerente (a RLS também não o mostra aos outros).
  const contrato = eGerente(perfil) ? trabalho.contrato : null
  // Picar aqui: só nos trabalhos de hoje ainda por fazer (a função da BD confirma a equipa).
  const aberto = abertoR.data
  const abertoHoje = aberto !== null && dataEmLisboa(aberto.entrada) === hoje
  const podePicar = trabalho.data === hoje && (trabalho.estado === "agendado" || trabalho.estado === "em_curso")
  const picagem = podePicar
    ? { atual: abertoHoje && aberto?.trabalho_id === trabalho.id, aTrabalhar: abertoHoje }
    : null

  const fotosGaleria: FotoGaleria[] = fotos.map((foto) => ({
    id: foto.id,
    momento: foto.momento,
    url: urls.get(foto.caminho) ?? null,
    largura: foto.largura,
    altura: foto.altura,
    autor: foto.autor?.nome ?? null,
    quando: formatarDataHora(foto.created_at),
    podeApagar: podeGerir || foto.colaborador_id === sessao.colaborador.id,
  }))

  const materiais = [...(registo?.materiais ?? [])]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((material) => ({
      id: material.id,
      descricao: material.descricao,
      quantidade: formatarNumero(material.quantidade),
      unidade: material.unidade,
      doStock: material.consumivel_id !== null,
    }))
  const catalogo = catalogoR.data ?? []

  let atualizado: string | null = null
  if (registo) {
    const quem = registo.autor?.nome ? `por ${registo.autor.nome} ` : ""
    const dia = hojeEmLisboa(new Date(registo.updated_at))
    atualizado =
      dia === hoje
        ? `Atualizado ${quem}às ${formatarHora(registo.updated_at)}`
        : `Atualizado ${quem}em ${formatarData(registo.updated_at)} às ${formatarHora(registo.updated_at)}`
  }

  const assinatura =
    registo?.assinatura_caminho && registo.assinado_em
      ? {
          url: urls.get(registo.assinatura_caminho) ?? null,
          nome: registo.assinatura_nome,
          quando: formatarDataHora(registo.assinado_em),
        }
      : null

  const dataExtenso = formatarDiaLongo(trabalho.data)
  const voltar = podeGerir ? { href: "/agenda", texto: "Agenda" } : { href: "/", texto: "Início" }

  return (
    <>
      <CabecalhoPagina
        titulo={trabalho.titulo}
        voltar={voltar}
        descricao={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Badge variant={VARIANTE_ESTADO_TRABALHO[trabalho.estado]}>{NOMES_ESTADO_TRABALHO[trabalho.estado]}</Badge>
            <span>{NOMES_TIPO_TRABALHO[trabalho.tipo]}</span>
            <span className="font-medium text-foreground">
              {dataExtenso.charAt(0).toUpperCase() + dataExtenso.slice(1)}
              {trabalho.hora_inicio && `, ${formatarHora(trabalho.hora_inicio)}`}
            </span>
            <span className="flex items-center gap-1.5">
              {trabalho.equipa ? (
                <>
                  <span
                    aria-hidden="true"
                    className="inline-block size-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: trabalho.equipa.cor }}
                  />
                  {trabalho.equipa.nome}
                </>
              ) : (
                "Equipa por atribuir"
              )}
            </span>
          </span>
        }
        acoes={
          podeGerir && (
            <Button asChild variant="outline" size="lg">
              <Link href={`/trabalhos/${trabalho.id}/editar`}>
                <PencilIcon />
                Editar
              </Link>
            </Button>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="grid gap-4">
          <Secao id="titulo-estado" titulo="Estado" icone={FlagIcon}>
            <ProvedorPicagem colaboradorId={sessao.colaborador.id}>
              <EstadoTrabalhoBotoes
                trabalhoId={trabalho.id}
                estado={trabalho.estado}
                podeGerir={podeGerir}
                picagem={picagem}
              />
            </ProvedorPicagem>
          </Secao>

          <Secao id="titulo-local" titulo="Local" icone={MapPinIcon}>
            <CartaoLocal local={trabalho.local} cliente={trabalho.cliente} ligarAoCliente={podeGerir} />
          </Secao>

          <Secao
            id="titulo-previstas"
            titulo="Tarefas previstas"
            icone={ClipboardListIcon}
            descricao={[
              // Com o orçamento ou o contrato de origem visível, a ligação abaixo já diz a origem.
              !((podeGerir && trabalho.orcamento) || contrato) && NOMES_ORIGEM_TRABALHO[trabalho.origem],
              trabalho.duracao_prevista_min && `duração prevista ${formatarDuracao(trabalho.duracao_prevista_min)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          >
            {/* Orçamento de origem: só gerente e chefe (o colaborador não vê orçamentos; a RLS também não os mostra). */}
            {podeGerir && trabalho.orcamento && (
              <p className="text-sm">
                Origem:{" "}
                <Link
                  href={`/orcamentos/${trabalho.orcamento.id}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Orçamento {formatarNumeroOrcamento(trabalho.orcamento.ano, trabalho.orcamento.numero)}
                </Link>
              </p>
            )}
            {contrato && (
              <p className="text-sm">
                Origem:{" "}
                <Link
                  href={`/financas/contratos/${contrato.id}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Contrato {contrato.titulo}
                </Link>
              </p>
            )}
            {trabalho.descricao ? (
              <p className="text-sm whitespace-pre-line">{trabalho.descricao}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Sem tarefas previstas.</p>
            )}
          </Secao>
        </div>

        <div className="grid gap-4">
          <Secao id="titulo-registo" titulo="Registo do dia" icone={NotebookPenIcon}>
            <RegistoDia
              trabalhoId={trabalho.id}
              tarefasFeitas={registo?.tarefas_feitas ?? null}
              notas={registo?.notas ?? null}
              versao={registo?.updated_at ?? null}
              atualizado={atualizado}
            />
          </Secao>

          <Secao id="titulo-materiais" titulo="Materiais gastos" icone={PackageIcon}>
            <Materiais trabalhoId={trabalho.id} materiais={materiais} catalogo={catalogo} />
          </Secao>
        </div>
      </div>

      <Secao id="titulo-fotos" titulo="Fotos" icone={CameraIcon} className="mt-4">
        <Fotos trabalhoId={trabalho.id} fotos={fotosGaleria} urlsGeradosEm={agora.getTime()} />
      </Secao>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-start">
        <Secao
          id="titulo-assinatura"
          titulo="Assinatura do cliente"
          icone={SignatureIcon}
          descricao={assinatura ? undefined : "Opcional."}
        >
          <Assinatura trabalhoId={trabalho.id} assinatura={assinatura} podeApagar={podeGerir} />
        </Secao>

        <Secao
          id="titulo-horas"
          titulo="Horas neste trabalho"
          icone={ClockIcon}
          descricao={perfil === "colaborador" ? "Só aparecem as suas horas." : undefined}
        >
          <HorasTrabalho registos={horas} dataTrabalho={trabalho.data} agora={agora.getTime()} />
        </Secao>
      </div>

    </>
  )
}
