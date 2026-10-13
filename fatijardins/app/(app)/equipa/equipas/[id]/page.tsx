import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRightIcon, PencilIcon, Trash2Icon, UserRoundIcon, UsersRoundIcon } from "lucide-react"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { exigirSessao } from "@/lib/auth"
import { eGerente } from "@/lib/perfis"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { idObrigatorio } from "@/lib/validacao/comum"
import { BadgePerfil } from "../../_componentes/badge-perfil"
import { ConfirmarAcao } from "../../_componentes/confirmar-acao"
import { PontoCor } from "../../_componentes/ponto-cor"
import { iniciais } from "../../_componentes/utilitarios"
import { apagarEquipa } from "../../acoes"
import { EsqueletoFicha } from "../../_componentes/esqueletos"

type Props = PageProps<"/equipa/equipas/[id]">

export const metadata = { title: "Equipa" }

export default function PaginaEquipa(props: Props) {
  return (
    <Suspense fallback={<EsqueletoFicha />}>
      <DetalheEquipa params={props.params} />
    </Suspense>
  )
}

async function DetalheEquipa({ params }: { params: Props["params"] }) {
  const sessao = await exigirSessao()
  const { id } = await params
  if (!idObrigatorio.safeParse(id).success) notFound()

  const gerente = eGerente(sessao.colaborador.perfil)
  const supabase = await createClient()
  const [equipaRes, membrosRes] = await Promise.all([
    supabase
      .from("equipas")
      .select(
        "id, nome, cor, ativa, notas, chefe:colaboradores!equipas_chefe_id_fkey(id, nome, funcao, ativo)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("colaboradores")
      .select("id, nome, funcao, perfil, ativo")
      .eq("equipa_id", id)
      .order("ativo", { ascending: false })
      .order("nome"),
  ])
  if (equipaRes.error) throw new Error(`Erro ao ler a equipa: ${equipaRes.error.message}`)
  if (membrosRes.error) throw new Error(`Erro ao ler os membros: ${membrosRes.error.message}`)
  const equipa = equipaRes.data
  if (!equipa) notFound()

  const membros = membrosRes.data
  const ativos = membros.filter((m) => m.ativo).length

  return (
    <>
      <CabecalhoPagina
        titulo={equipa.nome}
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            <PontoCor cor={equipa.cor} className="size-3" />
            {ativos} {ativos === 1 ? "membro ativo" : "membros ativos"}
            {!equipa.ativa && <Badge variant="muted">Inativa</Badge>}
          </span>
        }
        voltar={{ href: "/equipa/equipas", texto: "Equipas" }}
        acoes={
          gerente && (
            <>
              <Button asChild variant="outline" size="lg">
                <Link href={`/equipa/equipas/${equipa.id}/editar`}>
                  <PencilIcon />
                  Editar
                </Link>
              </Button>
              <ConfirmarAcao
                gatilho={
                  <Button variant="outline" size="lg" className="text-destructive hover:text-destructive">
                    <Trash2Icon />
                    Apagar
                  </Button>
                }
                titulo={`Apagar a ${equipa.nome}?`}
                descricao={
                  membros.length > 0
                    ? `${membros.length === 1 ? "O membro desta equipa fica" : `Os ${membros.length} membros desta equipa ficam`} sem equipa. Esta ação não pode ser anulada.`
                    : "Esta ação não pode ser anulada."
                }
                confirmar="Apagar equipa"
                acao={apagarEquipa.bind(null, equipa.id)}
              />
            </>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Chefe de equipa</CardTitle>
            </CardHeader>
            <CardContent>
              {equipa.chefe ? (
                <Link
                  href={`/equipa/colaboradores/${equipa.chefe.id}`}
                  className="flex items-center gap-3 rounded-lg p-2 -m-2 transition-colors hover:bg-accent/50"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                    {iniciais(equipa.chefe.nome)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{equipa.chefe.nome}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {equipa.chefe.funcao || "—"}
                    </span>
                  </span>
                  {!equipa.chefe.ativo && <Badge variant="destructive">Inativo</Badge>}
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <UserRoundIcon className="size-4" />
                  Sem chefe definido.
                </p>
              )}
            </CardContent>
          </Card>

          {equipa.notas && (
            <Card>
              <CardHeader>
                <CardTitle>Notas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line">{equipa.notas}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Membros</CardTitle>
          </CardHeader>
          <CardContent>
            {membros.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <UsersRoundIcon className="size-4" />
                Ainda não há membros nesta equipa.
                {gerente && " Atribua a equipa na ficha de cada colaborador."}
              </p>
            ) : (
              <ul className="-my-1 divide-y">
                {membros.map((membro) => (
                  <li key={membro.id}>
                    <Link
                      href={`/equipa/colaboradores/${membro.id}`}
                      className={cn(
                        "-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-accent/50",
                        !membro.ativo && "text-muted-foreground"
                      )}
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                        {iniciais(membro.nome)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {membro.nome}
                          {membro.id === equipa.chefe?.id && (
                            <span className="font-normal text-muted-foreground"> (chefe)</span>
                          )}
                        </span>
                        <span className="block truncate text-sm text-muted-foreground">
                          {membro.funcao || "—"}
                        </span>
                        {/* No telemóvel os badges ficam por baixo do nome. */}
                        <span className="mt-1.5 flex flex-wrap gap-1.5 sm:hidden">
                          {!membro.ativo && <Badge variant="destructive">Inativo</Badge>}
                          <BadgePerfil perfil={membro.perfil} />
                        </span>
                      </span>
                      <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                        {!membro.ativo && <Badge variant="destructive">Inativo</Badge>}
                        <BadgePerfil perfil={membro.perfil} />
                      </span>
                      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
