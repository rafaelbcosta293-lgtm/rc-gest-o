import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  CalendarDaysIcon,
  ChevronRightIcon,
  EuroIcon,
  FileSignatureIcon,
  ListChecksIcon,
  PencilIcon,
  ReceiptTextIcon,
} from "lucide-react"

import { BotaoApagar } from "@/app/(app)/clientes/botao-apagar"
import { Secao } from "@/app/(app)/trabalhos/[id]/_componentes/secao"
import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { exigirPerfil } from "@/lib/auth"
import { formatarDiaCurto } from "@/lib/datas"
import {
  formatarMes,
  NOMES_ESTADO_CONTRATO,
  NOMES_ESTADO_COBRANCA,
  NOMES_FREQUENCIA_CONTRATO,
  SEMANAS_AGENDADAS,
  valorMensalComIva,
  VARIANTE_ESTADO_CONTRATO,
  VARIANTE_ESTADO_COBRANCA,
} from "@/lib/financas"
import { formatarData, formatarDuracao, formatarHora, formatarMoeda, hojeEmLisboa } from "@/lib/formatar"
import { createClient } from "@/lib/supabase/server"
import { NOMES_ESTADO_TRABALHO, VARIANTE_ESTADO_TRABALHO } from "@/lib/trabalhos"
import { idObrigatorio } from "@/lib/validacao/comum"
import { apagarContrato } from "../../_contratos/acoes"
import { AcoesEstadoContrato } from "../../_contratos/acoes-contrato"
import { EsqueletoContrato } from "../../_contratos/esqueletos"

export const metadata = { title: "Contrato" }

type Props = PageProps<"/financas/contratos/[id]">

const LIGACAO = "font-medium text-primary underline-offset-4 hover:underline"

export default function PaginaContrato(props: Props) {
  return (
    <Suspense fallback={<EsqueletoContrato />}>
      <FichaContrato params={props.params} />
    </Suspense>
  )
}

async function FichaContrato({ params }: Pick<Props, "params">) {
  await exigirPerfil("gerente")
  const { id } = await params
  if (!idObrigatorio.safeParse(id).success) notFound()

  const supabase = await createClient()
  const hoje = hojeEmLisboa()
  const [contratoR, visitasR, feitasR, cobrancasR] = await Promise.all([
    supabase
      .from("contratos")
      .select("*, cliente:clientes(id, nome), local:locais(nome, localidade), equipa:equipas(nome, cor)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("trabalhos")
      .select("id, data, hora_inicio, estado, equipa:equipas(nome, cor)")
      .eq("contrato_id", id)
      .gte("data", hoje)
      .order("data")
      .order("hora_inicio", { nullsFirst: false }),
    supabase
      .from("trabalhos")
      .select("id", { count: "exact", head: true })
      .eq("contrato_id", id)
      .eq("estado", "concluido"),
    supabase
      .from("cobrancas_com_saldo")
      .select("id, periodo, valor, em_divida, estado, data_vencimento, fatura_referencia")
      .eq("contrato_id", id)
      .order("periodo", { ascending: false }),
  ])
  if (contratoR.error) throw new Error(`Não foi possível carregar o contrato: ${contratoR.error.message}`)
  for (const resultado of [visitasR, feitasR, cobrancasR]) {
    if (resultado.error) throw new Error(`Não foi possível carregar o contrato: ${resultado.error.message}`)
  }
  const contrato = contratoR.data
  if (!contrato) notFound()

  const visitas = visitasR.data ?? []
  const feitas = feitasR.count ?? 0
  const cobrancas = cobrancasR.data ?? []
  const valorSemIva = Number(contrato.valor_mensal)
  const taxaIva = Number(contrato.taxa_iva)
  const servicos = (contrato.servicos ?? "")
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean)
  const local = [contrato.local?.nome, contrato.local?.localidade].filter(Boolean).join(", ")

  return (
    <>
      <CabecalhoPagina
        titulo={contrato.titulo}
        voltar={{ href: "/financas/contratos", texto: "Contratos" }}
        descricao={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Badge variant={VARIANTE_ESTADO_CONTRATO[contrato.estado]}>{NOMES_ESTADO_CONTRATO[contrato.estado]}</Badge>
            {contrato.cliente && (
              <Link href={`/clientes/${contrato.cliente.id}`} className={LIGACAO}>
                {contrato.cliente.nome}
              </Link>
            )}
            <span>{local}</span>
          </span>
        }
        acoes={
          <>
            <Button asChild variant="outline" size="lg">
              <Link href={`/financas/contratos/${contrato.id}/editar`}>
                <PencilIcon />
                Editar
              </Link>
            </Button>
            <AcoesEstadoContrato id={contrato.id} titulo={contrato.titulo} estado={contrato.estado} />
            <BotaoApagar
              acao={apagarContrato.bind(null, contrato.id)}
              titulo="Apagar este contrato?"
              descricao={
                <>
                  Só para um contrato criado por engano: apaga <strong>{contrato.titulo}</strong>, as visitas
                  agendadas que ainda não começaram e as cobranças sem pagamentos nem fatura. Se já houver visitas
                  feitas ou cobranças pagas ou faturadas, termine o contrato em vez de o apagar.
                </>
              }
            />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="grid gap-4">
          <Secao id="titulo-contrato" titulo="Contrato" icone={FileSignatureIcon}>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Dado rotulo="Cliente">
                {contrato.cliente ? (
                  <Link href={`/clientes/${contrato.cliente.id}`} className={LIGACAO}>
                    {contrato.cliente.nome}
                  </Link>
                ) : (
                  "—"
                )}
              </Dado>
              <Dado rotulo="Local">{local || "—"}</Dado>
              <Dado rotulo="Frequência">{NOMES_FREQUENCIA_CONTRATO[contrato.frequencia]}</Dado>
              <Dado rotulo="Equipa">
                {contrato.equipa ? (
                  <span className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="inline-block size-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                      style={{ backgroundColor: contrato.equipa.cor }}
                    />
                    {contrato.equipa.nome}
                  </span>
                ) : (
                  "Por atribuir"
                )}
              </Dado>
              <Dado rotulo="Hora de início">{contrato.hora_inicio ? formatarHora(contrato.hora_inicio) : "—"}</Dado>
              <Dado rotulo="Duração prevista">
                {contrato.duracao_prevista_min ? formatarDuracao(contrato.duracao_prevista_min) : "—"}
              </Dado>
              <Dado rotulo="Primeira visita">{formatarData(contrato.data_inicio)}</Dado>
              <Dado rotulo="Fim">{contrato.data_fim ? formatarData(contrato.data_fim) : "Sem data de fim"}</Dado>
            </dl>
            {contrato.notas && (
              <div className="text-sm">
                <p className="text-muted-foreground">Notas</p>
                <p className="mt-0.5 break-words whitespace-pre-line">{contrato.notas}</p>
              </div>
            )}
          </Secao>

          <Secao id="titulo-servicos" titulo="Serviços incluídos" icone={ListChecksIcon}>
            {servicos.length > 0 ? (
              <ul className="grid list-disc gap-1 pl-5 text-sm">
                {servicos.map((servico, i) => (
                  <li key={i} className="break-words">
                    {servico}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sem serviços indicados.</p>
            )}
          </Secao>

          <Secao id="titulo-avenca" titulo="Avença" icone={EuroIcon}>
            <dl className="flex flex-wrap items-end gap-x-10 gap-y-4">
              <div>
                <dt className="text-sm text-muted-foreground">Por mês, com IVA</dt>
                <dd className="text-3xl font-semibold tracking-tight tabular-nums">
                  {formatarMoeda(valorMensalComIva(valorSemIva, taxaIva))}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Sem IVA</dt>
                <dd className="text-lg font-medium tabular-nums">{formatarMoeda(valorSemIva)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">IVA</dt>
                <dd className="text-lg font-medium tabular-nums">{taxaIva} %</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Vence no dia</dt>
                <dd className="text-lg font-medium tabular-nums">{contrato.dia_cobranca} de cada mês</dd>
              </div>
            </dl>
          </Secao>
        </div>

        <div className="grid gap-4">
          <Secao
            id="titulo-visitas"
            titulo="Próximas visitas"
            icone={CalendarDaysIcon}
            descricao={[
              contrato.estado === "ativo"
                ? `A agenda tem sempre as visitas das próximas ${SEMANAS_AGENDADAS} semanas.`
                : "Contrato sem visitas novas enquanto não estiver ativo.",
              feitas === 1 ? "1 visita feita até agora." : `${feitas} visitas feitas até agora.`,
            ].join(" ")}
          >
            {visitas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Não há visitas agendadas.</p>
            ) : (
              <ul className="-mx-2 divide-y">
                {visitas.map((visita) => (
                  <li key={visita.id}>
                    <Link
                      href={`/trabalhos/${visita.id}`}
                      className="flex min-h-12 items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent/50 active:bg-accent"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium capitalize tabular-nums">
                          {formatarDiaCurto(visita.data)}
                          {visita.hora_inicio && `, ${formatarHora(visita.hora_inicio)}`}
                        </span>
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          {visita.equipa ? (
                            <>
                              <span
                                aria-hidden="true"
                                className="inline-block size-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                                style={{ backgroundColor: visita.equipa.cor }}
                              />
                              {visita.equipa.nome}
                            </>
                          ) : (
                            "Equipa por atribuir"
                          )}
                        </span>
                      </span>
                      <Badge variant={VARIANTE_ESTADO_TRABALHO[visita.estado]}>
                        {NOMES_ESTADO_TRABALHO[visita.estado]}
                      </Badge>
                      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Secao>

          <Secao
            id="titulo-cobrancas"
            titulo="Cobranças"
            icone={ReceiptTextIcon}
            descricao="Uma por mês, criada no início do mês. Registe os pagamentos na ficha de cada cobrança."
          >
            {cobrancas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda não há cobranças.</p>
            ) : (
              <ul className="-mx-2 divide-y">
                {cobrancas.map((cobranca) => {
                  const emDivida = Number(cobranca.em_divida ?? 0)
                  return (
                    <li key={cobranca.id}>
                      <Link
                        href={`/financas/cobrancas/${cobranca.id}`}
                        className="flex min-h-12 items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent/50 active:bg-accent"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-medium first-letter:uppercase">
                              {cobranca.periodo ? formatarMes(cobranca.periodo) : "—"}
                            </span>
                            {cobranca.estado && (
                              <Badge variant={VARIANTE_ESTADO_COBRANCA[cobranca.estado]}>
                                {NOMES_ESTADO_COBRANCA[cobranca.estado]}
                              </Badge>
                            )}
                          </span>
                          <span className="block text-muted-foreground tabular-nums">
                            {[
                              cobranca.data_vencimento && `Vence a ${formatarData(cobranca.data_vencimento)}`,
                              cobranca.fatura_referencia,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <span className="shrink-0 text-right tabular-nums">
                          <span className="block font-semibold">{formatarMoeda(Number(cobranca.valor ?? 0))}</span>
                          {emDivida > 0 && (
                            <span className="block text-xs text-muted-foreground">
                              em dívida {formatarMoeda(emDivida)}
                            </span>
                          )}
                        </span>
                        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </Secao>
        </div>
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
