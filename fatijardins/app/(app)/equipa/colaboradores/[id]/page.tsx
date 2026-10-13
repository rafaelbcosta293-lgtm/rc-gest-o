import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarOffIcon, MailIcon, PencilIcon, PhoneIcon, Trash2Icon } from "lucide-react"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { exigirSessao } from "@/lib/auth"
import { formatarData, formatarMoeda, hojeEmLisboa } from "@/lib/formatar"
import { eGerente } from "@/lib/perfis"
import { NOMES_TIPO_AUSENCIA } from "@/lib/rotulos"
import { criarClienteAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { idObrigatorio } from "@/lib/validacao/comum"
import { BadgePerfil } from "../../_componentes/badge-perfil"
import { ConfirmarAcao } from "../../_componentes/confirmar-acao"
import { PontoCor } from "../../_componentes/ponto-cor"
import { contarDias, ligacaoTelefone } from "../../_componentes/utilitarios"
import { apagarAusencia } from "../../acoes"
import { AcessoApp } from "./acesso-app"
import { MarcarAusencia } from "./marcar-ausencia"
import { EsqueletoFicha } from "../../_componentes/esqueletos"

type Props = PageProps<"/equipa/colaboradores/[id]">

export const metadata = { title: "Colaborador" }

export default function PaginaColaborador(props: Props) {
  return (
    <Suspense fallback={<EsqueletoFicha />}>
      <FichaColaborador params={props.params} />
    </Suspense>
  )
}

async function FichaColaborador({ params }: { params: Props["params"] }) {
  const sessao = await exigirSessao()
  const { id } = await params
  if (!idObrigatorio.safeParse(id).success) notFound()

  const gerente = eGerente(sessao.colaborador.perfil)
  const supabase = await createClient()

  const { data: colaborador, error } = await supabase
    .from("colaboradores")
    .select(
      "id, nome, funcao, perfil, telemovel, email, user_id, ativo, equipa:equipas!colaboradores_equipa_id_fkey(id, nome, cor, chefe_id)"
    )
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`Erro ao ler o colaborador: ${error.message}`)
  if (!colaborador) notFound()

  const eu = colaborador.id === sessao.colaborador.id
  // A RLS decide o que se vê; aqui só se evita mostrar uma lista vazia enganadora.
  // Mesma regra da RLS: o chefe só vê as ausências da equipa enquanto for chefe.
  const chefeDaEquipa =
    sessao.colaborador.perfil === "chefe_equipa" && colaborador.equipa?.chefe_id === sessao.colaborador.id
  const podeVerAusencias = gerente || eu || chefeDaEquipa

  const [custoRes, ausenciasRes] = await Promise.all([
    gerente
      ? supabase.from("colaboradores_custos").select("custo_hora").eq("colaborador_id", id).maybeSingle()
      : Promise.resolve(null),
    podeVerAusencias
      ? supabase
          .from("ausencias")
          .select("id, tipo, data_inicio, data_fim, notas")
          .eq("colaborador_id", id)
          .order("data_inicio", { ascending: false })
      : Promise.resolve(null),
  ])
  if (ausenciasRes?.error) throw new Error(`Erro ao ler as ausências: ${ausenciasRes.error.message}`)

  // Email da conta de acesso (pode ser diferente do email da ficha). Só gerente.
  const admin = gerente ? criarClienteAdmin() : null
  let emailAcesso: string | null = null
  if (gerente && colaborador.user_id) {
    const conta = admin ? await admin.auth.admin.getUserById(colaborador.user_id) : null
    emailAcesso = conta?.data.user?.email ?? colaborador.email ?? "(email desconhecido)"
  }

  const hoje = hojeEmLisboa()
  const ausencias = ausenciasRes?.data ?? []
  const custoHora = custoRes?.data?.custo_hora

  return (
    <>
      <CabecalhoPagina
        titulo={colaborador.nome}
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            {colaborador.funcao && <span>{colaborador.funcao}</span>}
            <BadgePerfil perfil={colaborador.perfil} />
            {!colaborador.ativo && <Badge variant="destructive">Inativo</Badge>}
          </span>
        }
        voltar={{ href: "/equipa", texto: "Colaboradores" }}
        acoes={
          gerente && (
            <Button asChild variant="outline" size="lg">
              <Link href={`/equipa/colaboradores/${colaborador.id}/editar`}>
                <PencilIcon />
                Editar
              </Link>
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dados</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Telemóvel</dt>
              <dd className="min-w-0">
                {colaborador.telemovel ? (
                  <a
                    href={ligacaoTelefone(colaborador.telemovel)}
                    className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
                  >
                    <PhoneIcon className="size-4" />
                    {colaborador.telemovel}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="min-w-0">
                {colaborador.email ? (
                  <a
                    href={`mailto:${colaborador.email}`}
                    className="inline-flex max-w-full items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
                  >
                    <MailIcon className="size-4 shrink-0" />
                    <span className="truncate">{colaborador.email}</span>
                  </a>
                ) : (
                  "—"
                )}
              </dd>
              <dt className="text-muted-foreground">Função</dt>
              <dd>{colaborador.funcao || "—"}</dd>
              <dt className="text-muted-foreground">Perfil</dt>
              <dd>
                <BadgePerfil perfil={colaborador.perfil} />
              </dd>
              <dt className="text-muted-foreground">Equipa</dt>
              <dd className="min-w-0">
                {colaborador.equipa ? (
                  <Link
                    href={`/equipa/equipas/${colaborador.equipa.id}`}
                    className="inline-flex items-center gap-1.5 font-medium underline-offset-4 hover:underline"
                  >
                    <PontoCor cor={colaborador.equipa.cor} />
                    {colaborador.equipa.nome}
                    {colaborador.equipa.chefe_id === colaborador.id && (
                      <span className="font-normal text-muted-foreground">(chefe)</span>
                    )}
                  </Link>
                ) : (
                  "Sem equipa"
                )}
              </dd>
              <dt className="text-muted-foreground">Estado</dt>
              <dd>
                {colaborador.ativo ? (
                  <Badge variant="outline">Ativo</Badge>
                ) : (
                  <Badge variant="destructive">Inativo</Badge>
                )}
              </dd>
              {gerente && (
                <>
                  <dt className="text-muted-foreground">Custo/hora</dt>
                  <dd className="font-medium tabular-nums" data-testid="custo-hora">
                    {custoHora === undefined ? "Não definido" : `${formatarMoeda(custoHora)}/h`}
                  </dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>

        {gerente && (
          <Card>
            <CardHeader>
              <CardTitle>Acesso à app</CardTitle>
            </CardHeader>
            <CardContent>
              <AcessoApp
                colaboradorId={colaborador.id}
                nome={colaborador.nome}
                ativo={colaborador.ativo}
                emailAcesso={emailAcesso}
                emailFicha={colaborador.email ?? ""}
                eProprio={eu}
                semChaveAdmin={!admin}
              />
            </CardContent>
          </Card>
        )}

        {podeVerAusencias && (
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="grid gap-1.5">
                <CardTitle>Ausências</CardTitle>
                <CardDescription>Férias, doença, formações e faltas.</CardDescription>
              </div>
              {gerente && <MarcarAusencia colaboradorId={colaborador.id} nome={colaborador.nome} hoje={hoje} />}
            </CardHeader>
            <CardContent>
              {ausencias.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarOffIcon className="size-4" />
                  Sem ausências registadas.
                </p>
              ) : (
                <ul className="grid gap-2">
                  {ausencias.map((ausencia) => {
                    const aDecorrer = ausencia.data_inicio <= hoje && ausencia.data_fim >= hoje
                    const passada = ausencia.data_fim < hoje
                    const dias = contarDias(ausencia.data_inicio, ausencia.data_fim)
                    return (
                      <li
                        key={ausencia.id}
                        data-testid="ausencia"
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-3",
                          aDecorrer && "border-primary/40 bg-accent/60",
                          passada && "text-muted-foreground"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={aDecorrer ? "default" : passada ? "muted" : "secondary"}>
                              {NOMES_TIPO_AUSENCIA[ausencia.tipo]}
                            </Badge>
                            {aDecorrer && <span className="text-xs font-semibold text-primary">A decorrer</span>}
                          </div>
                          <p className="mt-1.5 font-medium tabular-nums">
                            {ausencia.data_inicio === ausencia.data_fim
                              ? formatarData(ausencia.data_inicio)
                              : `${formatarData(ausencia.data_inicio)} a ${formatarData(ausencia.data_fim)}`}
                            <span className="font-normal whitespace-nowrap text-muted-foreground">
                              {" "}
                              · {dias} {dias === 1 ? "dia" : "dias"}
                            </span>
                          </p>
                          {ausencia.notas && (
                            <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">
                              {ausencia.notas}
                            </p>
                          )}
                        </div>
                        {gerente && (
                          <ConfirmarAcao
                            gatilho={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive"
                                aria-label="Apagar ausência"
                              >
                                <Trash2Icon />
                              </Button>
                            }
                            titulo="Apagar esta ausência?"
                            descricao={`${NOMES_TIPO_AUSENCIA[ausencia.tipo]} de ${formatarData(ausencia.data_inicio)} a ${formatarData(ausencia.data_fim)}. Esta ação não pode ser anulada.`}
                            confirmar="Apagar"
                            acao={apagarAusencia.bind(null, ausencia.id)}
                          />
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
