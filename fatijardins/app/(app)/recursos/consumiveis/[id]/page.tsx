import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronDownIcon, HistoryIcon, InfoIcon, PackageIcon, PencilIcon, TriangleAlertIcon } from "lucide-react"

import { BotaoApagar } from "@/app/(app)/clientes/botao-apagar"
import { Secao } from "@/app/(app)/trabalhos/[id]/_componentes/secao"
import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { exigirPerfil } from "@/lib/auth"
import { formatarMoeda, hojeEmLisboa } from "@/lib/formatar"
import { eGerente } from "@/lib/perfis"
import { eStockBaixo, formatarQuantidade } from "@/lib/recursos"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { idObrigatorio } from "@/lib/validacao/comum"
import { NOMES_UNIDADE } from "@/lib/validacao/consumiveis"
import { apagarConsumivel } from "../../_consumiveis/acoes"
import { AcoesStock } from "../../_consumiveis/acoes-stock"
import { BotaoEstadoConsumivel } from "../../_consumiveis/botao-estado-consumivel"
import { carregarTrabalhosRecentes, descreverTrabalho, MOVIMENTOS_POR_PAGINA } from "../../_consumiveis/dados"
import { EsqueletoConsumivel } from "../../_consumiveis/esqueletos"
import { ListaMovimentos } from "../../_consumiveis/lista-movimentos"
import type { MovimentoLista } from "../../_consumiveis/tipos"

export const metadata = { title: "Consumível" }

type Props = PageProps<"/recursos/consumiveis/[id]">

export default function PaginaConsumivel(props: Props) {
  return (
    <Suspense fallback={<EsqueletoConsumivel />}>
      <FichaConsumivel params={props.params} searchParams={props.searchParams} />
    </Suspense>
  )
}

/** Quantos movimentos mostrar (?ver=100 depois de "Ver mais"). */
function lerLimite(valor: string | string[] | undefined): number {
  const numero = Number(Array.isArray(valor) ? valor[0] : valor)
  if (!Number.isInteger(numero) || numero <= MOVIMENTOS_POR_PAGINA) return MOVIMENTOS_POR_PAGINA
  return Math.min(numero, 5000)
}

async function FichaConsumivel({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const sessao = await exigirPerfil("gerente", "chefe_equipa")
  const { id } = await params
  if (!idObrigatorio.safeParse(id).success) notFound()
  const gerente = eGerente(sessao.colaborador.perfil)
  const limite = lerLimite((await searchParams).ver)

  const supabase = await createClient()
  const [consumivelR, stockR] = await Promise.all([
    supabase
      .from("consumiveis")
      .select("id, nome, categoria, unidade, stock_minimo, ativo, notas")
      .eq("id", id)
      .maybeSingle(),
    supabase.rpc("stock_consumiveis").eq("consumivel_id", id).maybeSingle(),
  ])
  if (consumivelR.error) throw new Error(`Não foi possível carregar o consumível: ${consumivelR.error.message}`)
  if (stockR.error) throw new Error(`Não foi possível carregar o stock: ${stockR.error.message}`)
  const consumivel = consumivelR.data
  if (!consumivel) notFound()

  const stock = Number(stockR.data?.stock ?? 0)
  const baixo = eStockBaixo(consumivel, stock)
  const hoje = hojeEmLisboa()
  const unidade = consumivel.unidade

  // Preço e movimentos: só o gerente (ao chefe nem se pedem).
  const gestao = gerente ? await carregarGestao(id, limite, hoje) : null
  const preco = gestao?.preco ?? null
  const valor = preco === null ? null : Math.max(0, stock) * preco
  const temMovimentos = (gestao?.movimentos.length ?? 0) > 0

  return (
    <>
      <CabecalhoPagina
        titulo={consumivel.nome}
        voltar={{ href: "/recursos/consumiveis", texto: "Consumíveis" }}
        descricao={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span>{consumivel.categoria ?? "Sem categoria"}</span>
            {baixo && <Badge variant="destructive">Stock baixo</Badge>}
            {!consumivel.ativo && <Badge variant="muted">Desativado</Badge>}
          </span>
        }
        acoes={
          gerente && (
            <>
              <Button asChild variant="outline" size="lg">
                <Link href={`/recursos/consumiveis/${consumivel.id}/editar`}>
                  <PencilIcon />
                  Editar
                </Link>
              </Button>
              {(temMovimentos || !consumivel.ativo) && (
                <BotaoEstadoConsumivel id={consumivel.id} ativo={consumivel.ativo} />
              )}
              {!temMovimentos && (
                <BotaoApagar
                  acao={apagarConsumivel.bind(null, consumivel.id)}
                  titulo="Apagar este consumível?"
                  descricao={
                    <>
                      Vai apagar <strong>{consumivel.nome}</strong> do catálogo. Esta ação não pode ser desfeita.
                    </>
                  }
                />
              )}
            </>
          )
        }
      />

      <div className="grid gap-4">
        <Secao id="titulo-stock" titulo="Stock" icone={PackageIcon}>
          <dl className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <dt className="text-sm text-muted-foreground">Stock atual</dt>
              <dd
                className={cn(
                  "text-4xl font-semibold tracking-tight tabular-nums",
                  (baixo || stock < 0) && "text-destructive"
                )}
              >
                {formatarQuantidade(stock, unidade)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Mínimo</dt>
              <dd className="text-lg font-medium tabular-nums">{formatarQuantidade(consumivel.stock_minimo, unidade)}</dd>
            </div>
            {gerente && (
              <>
                <div>
                  <dt className="text-sm text-muted-foreground">Preço unitário</dt>
                  <dd className="text-lg font-medium tabular-nums">
                    {preco === null ? "Sem preço" : `${formatarMoeda(preco)}/${unidade}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Valor em stock</dt>
                  <dd className="text-lg font-medium tabular-nums">{valor === null ? "—" : formatarMoeda(valor)}</dd>
                </div>
              </>
            )}
          </dl>

          {stock < 0 ? (
            <Aviso>
              O stock está negativo: saíram mais do que entraram.
              {gerente ? " Faça um acerto de inventário." : " Avise o gerente para fazer um acerto de inventário."}
            </Aviso>
          ) : (
            baixo && (
              <Aviso>
                Stock baixo: está no mínimo ou abaixo dele.{" "}
                {gerente ? "Registe a entrada quando comprar mais." : "Avise o gerente para encomendar."}
              </Aviso>
            )
          )}

          {gestao ? (
            <AcoesStock
              consumivelId={consumivel.id}
              unidade={unidade}
              hoje={hoje}
              stock={stock}
              precoAtual={preco}
              trabalhos={gestao.trabalhos}
            />
          ) : (
            <p className="flex gap-2 text-sm text-muted-foreground">
              <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              As entradas e os acertos são registados pelo gerente. Os materiais gastos nos trabalhos descontam no stock
              automaticamente.
            </p>
          )}
        </Secao>

        <Secao id="titulo-dados" titulo="Dados" icone={InfoIcon}>
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <Dado rotulo="Categoria">{consumivel.categoria ?? "—"}</Dado>
            <Dado rotulo="Unidade">{NOMES_UNIDADE[unidade as keyof typeof NOMES_UNIDADE] ?? unidade}</Dado>
            <Dado rotulo="Estado">
              {consumivel.ativo ? "Ativo" : "Desativado (não aparece na escolha de materiais dos trabalhos)"}
            </Dado>
          </dl>
          <div className="text-sm">
            <p className="text-muted-foreground">Notas</p>
            {consumivel.notas ? (
              <p className="mt-0.5 break-words whitespace-pre-line">{consumivel.notas}</p>
            ) : (
              <p className="mt-0.5 text-muted-foreground">—</p>
            )}
          </div>
        </Secao>

        {gestao && (
          <Secao
            id="titulo-movimentos"
            titulo="Movimentos"
            icone={HistoryIcon}
            descricao="Dos mais recentes para os mais antigos. As saídas dos materiais gastos nos trabalhos são registadas automaticamente."
          >
            <ListaMovimentos
              consumivelId={consumivel.id}
              unidade={unidade}
              hoje={hoje}
              stock={stock}
              precoAtual={preco}
              trabalhos={gestao.trabalhos}
              movimentos={gestao.movimentos}
            />
            {gestao.haMais && (
              <Button asChild variant="outline" size="lg" className="w-full sm:w-fit">
                <Link href={`/recursos/consumiveis/${consumivel.id}?ver=${limite + MOVIMENTOS_POR_PAGINA}`} scroll={false}>
                  <ChevronDownIcon />
                  Ver mais
                </Link>
              </Button>
            )}
          </Secao>
        )}
      </div>
    </>
  )
}

/** Preço, movimentos (os mais recentes primeiro) e trabalhos para as saídas: só o gerente. */
async function carregarGestao(id: string, limite: number, hoje: string) {
  const supabase = await createClient()
  const [precoR, movimentosR, trabalhos] = await Promise.all([
    supabase.from("consumiveis_precos").select("preco_unitario").eq("consumivel_id", id).maybeSingle(),
    supabase
      .from("movimentos_stock")
      .select(
        `id, tipo, quantidade, data, preco_unitario, notas, registo_material_id, updated_at,
         trabalho:trabalhos(id, data, titulo, cliente:clientes(nome), local:locais(nome)),
         autor:colaboradores(nome)`
      )
      .eq("consumivel_id", id)
      .order("data", { ascending: false })
      .order("created_at", { ascending: false })
      // Mais um do que os mostrados, para saber se há mais.
      .range(0, limite),
    carregarTrabalhosRecentes(supabase, hoje),
  ])
  if (precoR.error) throw new Error(`Não foi possível carregar o preço: ${precoR.error.message}`)
  if (movimentosR.error) throw new Error(`Não foi possível carregar os movimentos: ${movimentosR.error.message}`)

  const movimentos: MovimentoLista[] = movimentosR.data.slice(0, limite).map((movimento) => ({
    id: movimento.id,
    tipo: movimento.tipo,
    quantidade: Number(movimento.quantidade),
    data: movimento.data,
    precoUnitario: movimento.preco_unitario === null ? null : Number(movimento.preco_unitario),
    notas: movimento.notas,
    doMaterial: movimento.registo_material_id !== null,
    trabalho: movimento.trabalho
      ? { id: movimento.trabalho.id, data: movimento.trabalho.data, descricao: descreverTrabalho(movimento.trabalho) }
      : null,
    autor: movimento.autor?.nome ?? null,
    updatedAt: movimento.updated_at,
  }))

  return {
    preco: precoR.data ? Number(precoR.data.preco_unitario) : null,
    movimentos,
    haMais: movimentosR.data.length > limite,
    trabalhos,
  }
}

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="mt-0.5 font-medium break-words">{children}</dd>
    </div>
  )
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}
