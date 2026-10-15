import Link from "next/link"
import {
  CameraIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  FilePlusIcon,
  FileTextIcon,
  HammerIcon,
  PlusIcon,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatarData, formatarHora, formatarMoeda, hojeEmLisboa } from "@/lib/formatar"
import {
  estaExpirado,
  formatarNumeroOrcamento,
  NOMES_ESTADO_ORCAMENTO,
  VARIANTE_ESTADO_ORCAMENTO,
} from "@/lib/orcamentos"
import { createClient } from "@/lib/supabase/server"
import { NOMES_ESTADO_TRABALHO, VARIANTE_ESTADO_TRABALHO } from "@/lib/trabalhos"
import { formatarQuandoVisita } from "@/lib/visitas"

/**
 * Histórico na ficha do cliente (gerente e chefe de equipa): trabalhos,
 * visitas e orçamentos. Cada cartão carrega à parte.
 */

/** Quantos se mostram em cada cartão. */
const LIMITE = 5

function CartaoHistorico({
  id,
  titulo,
  icone: Icone,
  descricao,
  acao,
  children,
}: {
  id: string
  titulo: string
  icone: LucideIcon
  descricao?: React.ReactNode
  acao?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card aria-labelledby={id} role="region">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icone className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <h3 id={id}>{titulo}</h3>
        </CardTitle>
        {descricao && <CardDescription>{descricao}</CardDescription>}
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4">
        {children}
        {/* No fim do cartão (no cabeçalho não cabe no telemóvel). */}
        {acao && <div className="flex flex-wrap gap-2">{acao}</div>}
      </CardContent>
    </Card>
  )
}

/** Linha de uma lista do histórico (ligação para a ficha). */
function Linha({
  href,
  titulo,
  detalhes,
  fim,
}: {
  href: string
  titulo: React.ReactNode
  detalhes: React.ReactNode
  fim?: React.ReactNode
}) {
  return (
    <li>
      <Link href={href} className="flex min-h-14 items-center gap-3 py-2.5 transition-colors hover:text-primary">
        <span className="min-w-0 flex-1">
          <span className="block font-medium break-words">{titulo}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {detalhes}
          </span>
        </span>
        {fim}
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  )
}

function SemRegistos({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

export function EsqueletoCartaoHistorico() {
  return (
    <div aria-busy="true" aria-live="polite" className="grid gap-4 rounded-xl border p-5">
      <span className="sr-only">A carregar…</span>
      <Skeleton className="h-5 w-40" />
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------
// Trabalhos
// ---------------------------------------------------------------------

type TrabalhoHistorico = {
  id: string
  titulo: string
  data: string
  hora_inicio: string | null
  estado: keyof typeof NOMES_ESTADO_TRABALHO
  local: { nome: string } | null
  equipa: { nome: string } | null
}

function ListaTrabalhos({ trabalhos }: { trabalhos: TrabalhoHistorico[] }) {
  return (
    <ul className="-my-2.5 min-w-0 divide-y">
      {trabalhos.map((trabalho) => (
        <Linha
          key={trabalho.id}
          href={`/trabalhos/${trabalho.id}`}
          titulo={trabalho.titulo}
          detalhes={
            <>
              <span className="font-medium text-foreground tabular-nums">
                {formatarData(trabalho.data)}
                {trabalho.hora_inicio && `, ${formatarHora(trabalho.hora_inicio)}`}
              </span>
              {trabalho.local && <span>{trabalho.local.nome}</span>}
              <span>{trabalho.equipa?.nome ?? "Por atribuir"}</span>
            </>
          }
          fim={
            <Badge variant={VARIANTE_ESTADO_TRABALHO[trabalho.estado]} className="shrink-0">
              {NOMES_ESTADO_TRABALHO[trabalho.estado]}
            </Badge>
          }
        />
      ))}
    </ul>
  )
}

/** Os próximos trabalhos (sem os cancelados) e os últimos. O chefe só vê os das equipas que chefia (RLS). */
export async function TrabalhosCliente({ clienteId, chefe }: { clienteId: string; chefe: boolean }) {
  const supabase = await createClient()
  const hoje = hojeEmLisboa()
  const colunas = "id, titulo, data, hora_inicio, estado, local:locais(nome), equipa:equipas(nome)"
  const [proximosR, ultimosR] = await Promise.all([
    supabase
      .from("trabalhos")
      .select(colunas, { count: "exact" })
      .eq("cliente_id", clienteId)
      .gte("data", hoje)
      .neq("estado", "cancelado")
      .order("data")
      .order("hora_inicio", { nullsFirst: false })
      .limit(LIMITE),
    supabase
      .from("trabalhos")
      .select(colunas, { count: "exact" })
      .eq("cliente_id", clienteId)
      .lt("data", hoje)
      .order("data", { ascending: false })
      .order("hora_inicio", { ascending: false, nullsFirst: false })
      .limit(LIMITE),
  ])
  if (proximosR.error) throw new Error(`Erro ao carregar os trabalhos: ${proximosR.error.message}`)
  if (ultimosR.error) throw new Error(`Erro ao carregar os trabalhos: ${ultimosR.error.message}`)
  const totalProximos = proximosR.count ?? proximosR.data.length
  const totalUltimos = ultimosR.count ?? ultimosR.data.length

  return (
    <CartaoHistorico
      id="titulo-trabalhos-cliente"
      titulo="Trabalhos"
      icone={HammerIcon}
      descricao={chefe ? "Só aparecem os trabalhos das equipas que chefia." : undefined}
    >
      {totalProximos === 0 && totalUltimos === 0 ? (
        <SemRegistos>Ainda não há trabalhos deste cliente.</SemRegistos>
      ) : (
        <>
          <div className="grid gap-2">
            <h4 className="text-sm font-semibold text-muted-foreground">
              Próximos{" "}
              <span className="font-normal">
                ({totalProximos > LIMITE ? `${LIMITE} de ${totalProximos}` : totalProximos})
              </span>
            </h4>
            {proximosR.data.length === 0 ? (
              <SemRegistos>Não há trabalhos marcados.</SemRegistos>
            ) : (
              <ListaTrabalhos trabalhos={proximosR.data} />
            )}
          </div>
          {totalUltimos > 0 && (
            <div className="grid gap-2">
              <h4 className="text-sm font-semibold text-muted-foreground">
                Últimos{" "}
                <span className="font-normal">
                  ({totalUltimos > LIMITE ? `${LIMITE} de ${totalUltimos}` : totalUltimos})
                </span>
              </h4>
              <ListaTrabalhos trabalhos={ultimosR.data} />
            </div>
          )}
        </>
      )}
    </CartaoHistorico>
  )
}

// ---------------------------------------------------------------------
// Visitas
// ---------------------------------------------------------------------

/** As últimas visitas (as marcadas para os próximos dias aparecem primeiro). */
export async function VisitasCliente({ clienteId, nomeCliente }: { clienteId: string; nomeCliente: string }) {
  const supabase = await createClient()
  const { data, count, error } = await supabase
    .from("visitas")
    .select("id, data, hora, local:locais(nome), fotos(count), orcamentos(count)", { count: "exact" })
    .eq("cliente_id", clienteId)
    .order("data", { ascending: false })
    .order("hora", { ascending: false, nullsFirst: false })
    .limit(LIMITE)
  if (error) throw new Error(`Erro ao carregar as visitas: ${error.message}`)
  const total = count ?? data.length
  const hoje = hojeEmLisboa()

  return (
    <CartaoHistorico
      id="titulo-visitas-cliente"
      titulo="Visitas"
      icone={ClipboardListIcon}
      descricao={total > LIMITE ? `As ${LIMITE} mais recentes de ${total}.` : undefined}
      acao={
        <>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-fit">
            <Link href={`/orcamentos/visitas/nova?cliente=${clienteId}`}>
              <PlusIcon />
              Nova visita
            </Link>
          </Button>
          {total > LIMITE && (
            <Button asChild variant="ghost" size="lg" className="w-full sm:w-fit">
              <Link href={`/orcamentos/visitas?${new URLSearchParams({ q: nomeCliente })}`}>
                Ver todas as visitas
                <ChevronRightIcon />
              </Link>
            </Button>
          )}
        </>
      }
    >
      {data.length === 0 ? (
        <SemRegistos>Ainda não há visitas a este cliente.</SemRegistos>
      ) : (
        <ul className="-my-2.5 min-w-0 divide-y">
          {data.map((visita) => {
            const fotos = visita.fotos[0]?.count ?? 0
            const orcamentos = visita.orcamentos[0]?.count ?? 0
            return (
              <Linha
                key={visita.id}
                href={`/orcamentos/visitas/${visita.id}`}
                titulo={
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="tabular-nums">{formatarQuandoVisita(visita.data, visita.hora)}</span>
                    {visita.data === hoje ? (
                      <Badge>Hoje</Badge>
                    ) : (
                      visita.data > hoje && <Badge variant="secondary">Próxima</Badge>
                    )}
                  </span>
                }
                detalhes={
                  <>
                    {visita.local && <span>{visita.local.nome}</span>}
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <CameraIcon className="size-3.5" aria-hidden="true" />
                      {fotos === 1 ? "1 foto" : `${fotos} fotos`}
                    </span>
                    {orcamentos > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <FileTextIcon className="size-3.5" aria-hidden="true" />
                        {orcamentos === 1 ? "Com orçamento" : `${orcamentos} orçamentos`}
                      </span>
                    )}
                  </>
                }
              />
            )
          })}
        </ul>
      )}
    </CartaoHistorico>
  )
}

// ---------------------------------------------------------------------
// Orçamentos
// ---------------------------------------------------------------------

/** Os últimos orçamentos (do número mais recente para o mais antigo). */
export async function OrcamentosCliente({ clienteId }: { clienteId: string }) {
  const supabase = await createClient()
  const { data, count, error } = await supabase
    .from("orcamentos")
    .select("id, ano, numero, titulo, estado, total, validade", { count: "exact" })
    .eq("cliente_id", clienteId)
    .order("ano", { ascending: false })
    .order("numero", { ascending: false })
    .limit(LIMITE)
  if (error) throw new Error(`Erro ao carregar os orçamentos: ${error.message}`)
  const total = count ?? data.length
  const hoje = hojeEmLisboa()

  return (
    <CartaoHistorico
      id="titulo-orcamentos-cliente"
      titulo="Orçamentos"
      icone={FileTextIcon}
      descricao={total > LIMITE ? `Os ${LIMITE} mais recentes de ${total}.` : undefined}
      acao={
        <Button asChild size="lg" variant="outline" className="w-full sm:w-fit">
          <Link href={`/orcamentos/novo?cliente=${clienteId}`}>
            <FilePlusIcon />
            Novo orçamento
          </Link>
        </Button>
      }
    >
      {data.length === 0 ? (
        <SemRegistos>Ainda não há orçamentos para este cliente.</SemRegistos>
      ) : (
        <ul className="-my-2.5 min-w-0 divide-y">
          {data.map((orcamento) => (
            <Linha
              key={orcamento.id}
              href={`/orcamentos/${orcamento.id}`}
              titulo={orcamento.titulo}
              detalhes={
                <>
                  <span className="tabular-nums">Nº {formatarNumeroOrcamento(orcamento.ano, orcamento.numero)}</span>
                  <Badge variant={VARIANTE_ESTADO_ORCAMENTO[orcamento.estado]}>
                    {NOMES_ESTADO_ORCAMENTO[orcamento.estado]}
                  </Badge>
                  {estaExpirado(orcamento, hoje) && (
                    <Badge variant="outline" className="text-destructive">
                      Expirado
                    </Badge>
                  )}
                </>
              }
              fim={<span className="shrink-0 font-semibold tabular-nums">{formatarMoeda(orcamento.total)}</span>}
            />
          ))}
        </ul>
      )}
    </CartaoHistorico>
  )
}
