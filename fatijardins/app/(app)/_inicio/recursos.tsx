import Link from "next/link"
import { ChevronRightIcon, PackageIcon, TriangleAlertIcon } from "lucide-react"

import { temAlerta, urgenciaEquipamento } from "@/app/(app)/recursos/_equipamentos/alertas"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { Sessao } from "@/lib/auth"
import { hojeEmLisboa } from "@/lib/formatar"
import { eGerente } from "@/lib/perfis"
import {
  alertasEquipamento,
  descreverAlerta,
  eStockBaixo,
  formatarQuantidade,
  NOMES_ESTADO_EQUIPAMENTO,
  type EstadoEquipamento,
} from "@/lib/recursos"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

/** Quantos se mostram em cada cartão (o resto fica no "Ver todos"). */
const MAXIMO = 6

const COR_GRAVE = "text-destructive"
const COR_AVISO = "text-amber-700 dark:text-amber-400"

/** Rodapé dos cartões: "e mais N" e a ligação para a lista completa. */
function Rodape({ href, mais }: { href: string; mais: number }) {
  return (
    // mt-auto: lado a lado (PC), os rodapés dos dois cartões ficam alinhados em baixo.
    <CardFooter className="mt-auto justify-between gap-3 border-t pt-4 [.border-t]:pt-4">
      <span className="text-sm text-muted-foreground">{mais > 0 && `e mais ${mais}`}</span>
      <Button asChild variant="ghost" size="sm" className="-mr-2 h-10">
        <Link href={href}>
          Ver todos
          <ChevronRightIcon />
        </Link>
      </Button>
    </CardFooter>
  )
}

// ---------------------------------------------------------------------
// Equipamentos a precisar de atenção
// ---------------------------------------------------------------------

const ESTADOS_ATENCAO: EstadoEquipamento[] = ["avariado", "em_reparacao"]

/**
 * Prazos de revisão, seguro e IPO a 30 dias ou vencidos e equipamentos
 * avariados ou em reparação. O gerente vê todos; o chefe os das equipas
 * que chefia e os sem equipa (os que pode mudar). Sem nada, não aparece.
 */
export async function EquipamentosAtencao({ sessao }: { sessao: Sessao }) {
  const supabase = await createClient()
  const hoje = hojeEmLisboa()
  const { data, error } = await supabase
    .from("equipamentos")
    .select("id, nome, estado, equipa_id, proxima_revisao, seguro_ate, ipo_ate, equipa:equipas(chefe_id)")
    .neq("estado", "abatido")
  if (error) throw new Error(`Não foi possível carregar os equipamentos: ${error.message}`)

  const gerente = eGerente(sessao.colaborador.perfil)
  const lista = data
    .filter((equipamento) => gerente || !equipamento.equipa_id || equipamento.equipa?.chefe_id === sessao.colaborador.id)
    .map((equipamento) => ({
      id: equipamento.id,
      nome: equipamento.nome,
      estado: equipamento.estado,
      alertas: alertasEquipamento(equipamento, hoje),
    }))
    .filter((equipamento) => temAlerta(equipamento.estado, equipamento.alertas))
    // A mesma ordem de /recursos?filtro=alertas.
    .sort(
      (a, b) =>
        urgenciaEquipamento(a.estado, a.alertas) - urgenciaEquipamento(b.estado, b.alertas) ||
        a.nome.localeCompare(b.nome, "pt")
    )
  if (lista.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Equipamentos a precisar de atenção</h2>
        </CardTitle>
        <CardDescription>
          {lista.length === 1 ? "1 equipamento" : `${lista.length} equipamentos`}
          {!gerente && " · da sua equipa ou sem equipa"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {lista.slice(0, MAXIMO).map((equipamento) => {
            const prazo = equipamento.alertas[0]
            const avariado = ESTADOS_ATENCAO.includes(equipamento.estado)
            const grave = equipamento.estado === "avariado" || prazo?.vencido
            const outros = equipamento.alertas.length - 1
            return (
              <li key={equipamento.id}>
                <Link href={`/recursos/equipamentos/${equipamento.id}`} className="flex min-h-12 items-center gap-3 py-2.5">
                  <TriangleAlertIcon
                    className={cn("size-4 shrink-0", grave ? COR_GRAVE : COR_AVISO)}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium break-words">{equipamento.nome}</span>
                    <span className="block text-sm text-muted-foreground">
                      {avariado && (
                        <span className={cn("font-medium", equipamento.estado === "avariado" ? COR_GRAVE : COR_AVISO)}>
                          {NOMES_ESTADO_EQUIPAMENTO[equipamento.estado]}
                        </span>
                      )}
                      {avariado && prazo && " · "}
                      {prazo && (
                        <span className={cn(prazo.vencido && ["font-medium", COR_GRAVE])}>{descreverAlerta(prazo)}</span>
                      )}
                      {outros > 0 && ` · ${outros === 1 ? "mais 1 prazo" : `mais ${outros} prazos`}`}
                    </span>
                  </span>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            )
          })}
        </ul>
      </CardContent>
      <Rodape href="/recursos?filtro=alertas" mais={lista.length - MAXIMO} />
    </Card>
  )
}

// ---------------------------------------------------------------------
// Stock baixo
// ---------------------------------------------------------------------

/**
 * Consumíveis ativos no stock mínimo ou abaixo dele (o stock vem da função
 * stock_consumiveis(), só para o gerente e os chefes). Sem nada, não aparece.
 */
export async function StockBaixo() {
  const supabase = await createClient()
  const [consumiveisR, stockR] = await Promise.all([
    supabase.from("consumiveis").select("id, nome, unidade, stock_minimo, ativo").eq("ativo", true).gt("stock_minimo", 0),
    supabase.rpc("stock_consumiveis"),
  ])
  if (consumiveisR.error) throw new Error(`Não foi possível carregar os consumíveis: ${consumiveisR.error.message}`)
  if (stockR.error) throw new Error(`Não foi possível carregar o stock: ${stockR.error.message}`)

  const stock = new Map(stockR.data.map((linha) => [linha.consumivel_id, Number(linha.stock)]))
  const lista = consumiveisR.data
    .map((consumivel) => ({ ...consumivel, stock: stock.get(consumivel.id) ?? 0 }))
    .filter((consumivel) => eStockBaixo(consumivel, consumivel.stock))
    // Os mais em falta primeiro (proporção do mínimo que ainda há).
    .sort(
      (a, b) => a.stock / a.stock_minimo - b.stock / b.stock_minimo || a.nome.localeCompare(b.nome, "pt")
    )
  if (lista.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Stock baixo</h2>
        </CardTitle>
        <CardDescription>
          {lista.length === 1 ? "1 artigo no mínimo ou abaixo" : `${lista.length} artigos no mínimo ou abaixo`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {lista.slice(0, MAXIMO).map((consumivel) => (
            <li key={consumivel.id}>
              <Link href={`/recursos/consumiveis/${consumivel.id}`} className="flex min-h-12 items-center gap-3 py-2.5">
                <PackageIcon
                  className={cn("size-4 shrink-0", consumivel.stock <= 0 ? COR_GRAVE : COR_AVISO)}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium break-words">{consumivel.nome}</span>
                  <span className="block text-sm text-muted-foreground">
                    Stock{" "}
                    <span className={cn("font-medium tabular-nums", consumivel.stock <= 0 ? COR_GRAVE : COR_AVISO)}>
                      {formatarQuantidade(consumivel.stock, consumivel.unidade)}
                    </span>
                    {" · "}mínimo{" "}
                    <span className="tabular-nums">{formatarQuantidade(consumivel.stock_minimo, consumivel.unidade)}</span>
                  </span>
                </span>
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
      <Rodape href="/recursos/consumiveis?filtro=stock-baixo" mais={lista.length - MAXIMO} />
    </Card>
  )
}
