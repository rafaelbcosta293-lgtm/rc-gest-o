import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { FileDownIcon, FlagIcon, ListIcon } from "lucide-react"

import { BotaoApagar } from "@/app/(app)/clientes/botao-apagar"
import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { exigirPerfil } from "@/lib/auth"
import { formatarData, formatarMoeda, hojeEmLisboa } from "@/lib/formatar"
import { moradaCompleta } from "@/lib/mapas"
import { eEditavel, estaExpirado, formatarNumeroOrcamento } from "@/lib/orcamentos"
import { eGerente } from "@/lib/perfis"
import { createClient } from "@/lib/supabase/server"
import { idObrigatorio } from "@/lib/validacao/comum"
import type { CamposOrcamento } from "@/lib/validacao/orcamentos"
import { apagarOrcamento } from "../_componentes/acoes"
import { BadgeEstadoOrcamento, BadgeExpirado } from "../_componentes/badges"
import { carregarOpcoesOrcamento, proximoDiaUtil, visitaOrigem } from "../_componentes/dados"
import { EsqueletoOrcamento } from "../_componentes/esqueletos"
import { BotoesEstado } from "./_componentes/botoes-estado"
import { ConverterTrabalho } from "./_componentes/converter-trabalho"
import { DadosOrcamento } from "./_componentes/dados-orcamento"
import { LinhasOrcamento } from "./_componentes/linhas-orcamento"

export const metadata = { title: "Orçamento" }

export default function PaginaOrcamento(props: PageProps<"/orcamentos/[id]">) {
  return (
    <Suspense fallback={<EsqueletoOrcamento />}>
      <FichaOrcamento params={props.params} />
    </Suspense>
  )
}

const LIGACAO = "font-medium text-primary underline-offset-4 hover:underline"

async function FichaOrcamento({ params }: { params: PageProps<"/orcamentos/[id]">["params"] }) {
  const sessao = await exigirPerfil("gerente", "chefe_equipa")
  const { id } = await params
  if (!idObrigatorio.safeParse(id).success) notFound()

  const supabase = await createClient()
  const [orcamentoR, linhasR] = await Promise.all([
    supabase
      .from("orcamentos")
      .select(
        `id, ano, numero, titulo, descricao, data, validade, estado, condicoes, notas_internas, total,
         enviado_em, respondido_em, trabalho_id, criado_por, cliente_id, local_id, visita_id, updated_at,
         cliente:clientes(id, nome),
         local:locais(nome, morada, codigo_postal, localidade),
         visita:visitas(id, data, local_id, medidas, area_m2, notas),
         trabalho:trabalhos!orcamentos_trabalho_id_fkey(id, data),
         criador:colaboradores!orcamentos_criado_por_fkey(nome)`
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("orcamento_linhas")
      .select("id, tipo, descricao, quantidade, unidade, preco_unitario, taxa_iva, updated_at")
      .eq("orcamento_id", id)
      .order("ordem")
      .order("created_at"),
  ])
  if (orcamentoR.error) throw new Error(`Não foi possível carregar o orçamento: ${orcamentoR.error.message}`)
  if (linhasR.error) throw new Error(`Não foi possível carregar as linhas: ${linhasR.error.message}`)
  const orcamento = orcamentoR.data
  if (!orcamento) notFound()

  const gerente = eGerente(sessao.colaborador.perfil)
  const editavel = eEditavel(orcamento.estado)
  const convertido = orcamento.trabalho_id !== null
  const podeConverter = gerente && orcamento.estado === "aceite" && !convertido
  // Gerente: rascunhos e recusados; chefe: os rascunhos que criou (a BD também o garante).
  const podeApagar = gerente
    ? orcamento.estado === "rascunho" || orcamento.estado === "recusado"
    : orcamento.estado === "rascunho" && orcamento.criado_por === sessao.colaborador.id
  // Clientes, locais e equipas só quando há formulário (rascunho) ou conversão.
  const opcoes =
    editavel || podeConverter
      ? await carregarOpcoesOrcamento(supabase, sessao, {
          clienteId: orcamento.cliente_id,
          localId: orcamento.local_id,
        })
      : null

  const hoje = hojeEmLisboa()
  const expirado = estaExpirado(orcamento, hoje)
  const numero = formatarNumeroOrcamento(orcamento.ano, orcamento.numero)
  const total = formatarMoeda(orcamento.total)
  const morada = orcamento.local
    ? moradaCompleta({
        morada: orcamento.local.morada,
        codigoPostal: orcamento.local.codigo_postal,
        localidade: orcamento.local.localidade,
      })
    : ""

  const valoresIniciais: CamposOrcamento = {
    cliente_id: orcamento.cliente_id,
    local_id: orcamento.local_id,
    visita_id: orcamento.visita_id ?? "",
    titulo: orcamento.titulo,
    descricao: orcamento.descricao ?? "",
    data: orcamento.data,
    validade: orcamento.validade,
    condicoes: orcamento.condicoes ?? "",
    notas_internas: orcamento.notas_internas ?? "",
  }

  const ligacaoTrabalho = orcamento.trabalho && (
    <Link href={`/trabalhos/${orcamento.trabalho.id}`} className={LIGACAO}>
      Convertido no trabalho de {formatarData(orcamento.trabalho.data)}
    </Link>
  )

  return (
    <>
      <CabecalhoPagina
        titulo={orcamento.titulo}
        voltar={{ href: "/orcamentos", texto: "Orçamentos" }}
        descricao={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="font-medium text-foreground tabular-nums">N.º {numero}</span>
            <BadgeEstadoOrcamento estado={orcamento.estado} />
            {expirado && <BadgeExpirado />}
            {orcamento.cliente && (
              <span>
                <Link href={`/clientes/${orcamento.cliente.id}`} className={LIGACAO}>
                  {orcamento.cliente.nome}
                </Link>
                {orcamento.local && ` — ${orcamento.local.nome}`}
              </span>
            )}
          </span>
        }
        acoes={
          <>
            {/* O PDF abre num separador novo (route handler em /orcamentos/[id]/pdf). */}
            <Button asChild variant="outline" size="lg">
              <a href={`/orcamentos/${orcamento.id}/pdf`} target="_blank" rel="noopener noreferrer">
                <FileDownIcon />
                PDF
              </a>
            </Button>
            {podeApagar && (
              <BotaoApagar
                acao={apagarOrcamento.bind(null, orcamento.id)}
                titulo="Apagar este orçamento?"
                descricao={
                  <>
                    Vai apagar o orçamento <strong>{numero}</strong> ({orcamento.titulo}) e as suas linhas. Esta ação
                    não pode ser desfeita.
                  </>
                }
              />
            )}
          </>
        }
      />

      <div className="grid gap-4">
        <section aria-labelledby="titulo-estado">
          <Card>
            <CardHeader>
              <CardTitle id="titulo-estado" className="flex items-center gap-2 text-lg">
                <FlagIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                Estado
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {orcamento.estado === "rascunho" &&
                (gerente ? (
                  <p>
                    Em rascunho: pode alterar os dados e as linhas. Quando estiver pronto, marque-o como enviado.
                  </p>
                ) : (
                  <p>
                    <strong>Em rascunho</strong> — o gerente envia o orçamento ao cliente. Pode alterar os dados e as
                    linhas.
                  </p>
                ))}
              {orcamento.estado === "enviado" && (
                <p>
                  Enviado ao cliente em {formatarData(orcamento.enviado_em)}. Válido até{" "}
                  {formatarData(orcamento.validade)}
                  {expirado ? " — a validade já passou." : "."}
                </p>
              )}
              {orcamento.estado === "aceite" && (
                <p>
                  Aceite pelo cliente em {formatarData(orcamento.respondido_em)}.
                  {podeConverter && " Converta-o em trabalho para o pôr na agenda."}
                </p>
              )}
              {orcamento.estado === "recusado" && (
                <p>Recusado pelo cliente em {formatarData(orcamento.respondido_em)}.</p>
              )}
              {convertido && (
                <p>{ligacaoTrabalho || "Convertido em trabalho."}</p>
              )}
              {!editavel && !convertido && (
                <p className="text-muted-foreground">
                  {gerente
                    ? "Para alterar, volte a pô-lo em rascunho."
                    : "Para alterar, o gerente tem de o voltar a pôr em rascunho."}
                  {/* Do aceite só se volta a enviado (e daí a rascunho). */}
                  {orcamento.estado === "aceite" && " Primeiro, volte a marcá-lo como enviado."}
                </p>
              )}
              {gerente && !convertido && (
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {podeConverter && opcoes && (
                    <ConverterTrabalho
                      orcamentoId={orcamento.id}
                      equipas={opcoes.equipas}
                      diaSugerido={proximoDiaUtil(hoje)}
                    />
                  )}
                  <BotoesEstado
                    orcamentoId={orcamento.id}
                    estado={orcamento.estado}
                    convertido={convertido}
                    numero={numero}
                    total={total}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="titulo-linhas">
          <Card>
            <CardHeader>
              <CardTitle id="titulo-linhas" className="flex items-center gap-2 text-lg">
                <ListIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                Linhas
              </CardTitle>
              <CardDescription>
                {editavel
                  ? "Valores sem IVA; o IVA é somado por taxa no fim."
                  : "Só de leitura: o orçamento já não está em rascunho."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LinhasOrcamento orcamentoId={orcamento.id} linhas={linhasR.data} editavel={editavel} />
            </CardContent>
          </Card>
        </section>

        <DadosOrcamento
          versao={orcamento.updated_at}
          formulario={
            editavel && opcoes
              ? {
                  orcamentoId: orcamento.id,
                  valoresIniciais,
                  clientes: opcoes.clientes,
                  locais: opcoes.locais,
                  validadeDias: opcoes.validadeDias,
                  visita: orcamento.visita && visitaOrigem(orcamento.visita),
                }
              : null
          }
        >
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Dado rotulo="Cliente">
              {orcamento.cliente ? (
                <Link href={`/clientes/${orcamento.cliente.id}`} className={LIGACAO}>
                  {orcamento.cliente.nome}
                </Link>
              ) : (
                "—"
              )}
            </Dado>
            <Dado rotulo="Local">
              {orcamento.local?.nome ?? "—"}
              {morada && <span className="block font-normal text-muted-foreground">{morada}</span>}
            </Dado>
            <Dado rotulo="Data">{formatarData(orcamento.data)}</Dado>
            <Dado rotulo="Válido até">
              <span className="flex flex-wrap items-center gap-2">
                {formatarData(orcamento.validade)}
                {expirado && <BadgeExpirado />}
              </span>
            </Dado>
            {orcamento.enviado_em && <Dado rotulo="Enviado em">{formatarData(orcamento.enviado_em)}</Dado>}
            {orcamento.respondido_em && (
              <Dado rotulo={orcamento.estado === "aceite" ? "Aceite em" : "Recusado em"}>
                {formatarData(orcamento.respondido_em)}
              </Dado>
            )}
            {orcamento.visita && (
              <Dado rotulo="Visita de origem">
                <Link href={`/orcamentos/visitas/${orcamento.visita.id}`} className={LIGACAO}>
                  Visita de {formatarData(orcamento.visita.data)}
                </Link>
              </Dado>
            )}
            {convertido && <Dado rotulo="Trabalho">{ligacaoTrabalho || "Convertido em trabalho"}</Dado>}
            {orcamento.criador && <Dado rotulo="Criado por">{orcamento.criador.nome}</Dado>}
          </dl>
          <Texto rotulo="Descrição / âmbito" nota="Aparece no PDF." texto={orcamento.descricao} />
          <Texto rotulo="Condições" nota="Aparecem no PDF." texto={orcamento.condicoes} />
          <Texto rotulo="Notas internas" nota="Não aparecem no PDF." texto={orcamento.notas_internas} />
        </DadosOrcamento>
      </div>
    </>
  )
}

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="mt-0.5 font-medium break-words">{children}</dd>
    </div>
  )
}

function Texto({ rotulo, nota, texto }: { rotulo: string; nota: string; texto: string | null }) {
  return (
    <div className="text-sm">
      <p className="text-muted-foreground">
        {rotulo} <span className="text-xs">({nota.charAt(0).toLowerCase() + nota.slice(1, -1)})</span>
      </p>
      {texto ? (
        <p className="mt-0.5 break-words whitespace-pre-line">{texto}</p>
      ) : (
        <p className="mt-0.5 text-muted-foreground">—</p>
      )}
    </div>
  )
}
