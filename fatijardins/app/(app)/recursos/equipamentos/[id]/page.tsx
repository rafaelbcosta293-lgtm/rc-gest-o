import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  CalendarClockIcon,
  PencilIcon,
  StickyNoteIcon,
  TriangleAlertIcon,
  UsersRoundIcon,
  WrenchIcon,
} from "lucide-react"

import { BotaoApagar } from "@/app/(app)/clientes/botao-apagar"
import { Secao } from "@/app/(app)/trabalhos/[id]/_componentes/secao"
import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { Button } from "@/components/ui/button"
import { exigirPerfil } from "@/lib/auth"
import { formatarData, hojeEmLisboa } from "@/lib/formatar"
import { eGerente } from "@/lib/perfis"
import {
  alertasEquipamento,
  descreverAlerta,
  diasEntre,
  ESTADOS_CHEFE,
  ESTADOS_EQUIPAMENTO,
  NOMES_TIPO_EQUIPAMENTO,
  type AlertaPrazo,
  type TipoPrazo,
} from "@/lib/recursos"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { idObrigatorio } from "@/lib/validacao/comum"
import { apagarEquipamento } from "../../_equipamentos/acoes"
import { EsqueletoEquipamento } from "../../_equipamentos/esqueletos"
import type { Manutencao } from "../../_equipamentos/formulario-manutencao"
import { Manutencoes } from "../../_equipamentos/manutencoes"
import { MudarEstado } from "../../_equipamentos/mudar-estado"
import {
  Atribuicao,
  BadgeEstadoEquipamento,
  COR_ALERTA,
  ICONE_TIPO_EQUIPAMENTO,
  Matricula,
} from "../../_equipamentos/visual"

export const metadata = { title: "Equipamento" }

type Parametros = PageProps<"/recursos/equipamentos/[id]">["params"]

const ROTULO_PRAZO: Record<TipoPrazo, string> = {
  revisao: "Próxima revisão",
  seguro: "Seguro válido até",
  ipo: "IPO válida até",
}

/** O que o gerente faz para o alerta desaparecer. */
const DICA_PRAZO: Record<TipoPrazo, string> = {
  revisao: "Ao registar a revisão nas manutenções, indique a data da próxima.",
  seguro: "Ao registar a renovação do seguro nas manutenções, indique a nova validade.",
  ipo: "Ao registar a inspeção nas manutenções, indique a nova validade da IPO.",
}

export default function PaginaEquipamento(props: PageProps<"/recursos/equipamentos/[id]">) {
  return (
    <Suspense fallback={<EsqueletoEquipamento />}>
      <FichaEquipamento params={props.params} />
    </Suspense>
  )
}

async function FichaEquipamento({ params }: { params: Parametros }) {
  const sessao = await exigirPerfil("gerente", "chefe_equipa")
  const { id } = await params
  if (!idObrigatorio.safeParse(id).success) notFound()
  const gerente = eGerente(sessao.colaborador.perfil)

  const supabase = await createClient()
  // As manutenções (com custos) são só do gerente: para o chefe nem se pedem.
  const [equipamentoR, manutencoesR] = await Promise.all([
    supabase
      .from("equipamentos")
      .select("*, equipa:equipas(id, nome, cor, chefe_id), pessoa:colaboradores(id, nome)")
      .eq("id", id)
      .maybeSingle(),
    gerente
      ? supabase
          .from("manutencoes_equipamento")
          .select("id, data, tipo, descricao, custo, contador, updated_at, autor:colaboradores(nome)")
          .eq("equipamento_id", id)
          .order("data", { ascending: false })
          .order("created_at", { ascending: false })
      : null,
  ])
  if (equipamentoR.error) throw new Error(`Não foi possível carregar o equipamento: ${equipamentoR.error.message}`)
  if (manutencoesR?.error) throw new Error(`Não foi possível carregar as manutenções: ${manutencoesR.error.message}`)
  const equipamento = equipamentoR.data
  if (!equipamento) notFound()

  // Hora atual depois do createClient() (pedido dinâmico).
  const hoje = hojeEmLisboa()
  const alertas = alertasEquipamento(equipamento, hoje)
  const viatura = equipamento.tipo === "viatura"
  // O chefe muda o estado dos equipamentos da equipa que chefia ou sem equipa (abater é do gerente).
  const podeMudarEstado =
    gerente ||
    (equipamento.estado !== "abatido" &&
      (equipamento.equipa_id === null || equipamento.equipa?.chefe_id === sessao.colaborador.id))
  const manutencoes: Manutencao[] = (manutencoesR?.data ?? []).map((m) => ({
    id: m.id,
    data: m.data,
    tipo: m.tipo,
    descricao: m.descricao,
    custo: m.custo,
    contador: m.contador,
    autor: m.autor?.nome ?? null,
    updated_at: m.updated_at,
  }))
  const marcaModelo = [equipamento.marca, equipamento.modelo].filter(Boolean).join(" ")
  const prazos: { tipo: TipoPrazo; data: string | null }[] = [
    { tipo: "revisao", data: equipamento.proxima_revisao },
    { tipo: "seguro", data: equipamento.seguro_ate },
    // A IPO só existe nas viaturas.
    ...(viatura ? [{ tipo: "ipo" as const, data: equipamento.ipo_ate }] : []),
  ]

  return (
    <>
      <CabecalhoPagina
        titulo={equipamento.nome}
        voltar={{ href: "/recursos", texto: "Equipamentos" }}
        descricao={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <BadgeEstadoEquipamento estado={equipamento.estado} />
            <span>{[NOMES_TIPO_EQUIPAMENTO[equipamento.tipo], marcaModelo].filter(Boolean).join(" · ")}</span>
            {equipamento.matricula && <Matricula matricula={equipamento.matricula} />}
          </span>
        }
        acoes={
          <>
            {podeMudarEstado && (
              <MudarEstado
                equipamentoId={equipamento.id}
                nome={equipamento.nome}
                estadoAtual={equipamento.estado}
                estados={gerente ? ESTADOS_EQUIPAMENTO : ESTADOS_CHEFE}
              />
            )}
            {gerente && (
              <>
                <Button asChild variant="outline" size="lg">
                  <Link href={`/recursos/equipamentos/${equipamento.id}/editar`}>
                    <PencilIcon />
                    Editar
                  </Link>
                </Button>
                <BotaoApagar
                  acao={apagarEquipamento.bind(null, equipamento.id)}
                  titulo="Apagar este equipamento?"
                  descricao={
                    <>
                      Vai apagar <strong>{equipamento.nome}</strong>
                      {manutencoes.length > 0 &&
                        (manutencoes.length === 1
                          ? " e a sua manutenção (com o custo)"
                          : ` e as suas ${manutencoes.length} manutenções (com os custos)`)}
                      . Esta ação não pode ser desfeita.
                      <span className="mt-2 block">
                        Se o equipamento deixou de ser usado (vendido, perdido, sem arranjo), em vez de o apagar mude
                        o estado para <strong>Abatido</strong>: sai da lista dos ativos e mantém o histórico das
                        manutenções.
                      </span>
                    </>
                  }
                />
              </>
            )}
          </>
        }
      />

      {(alertas.length > 0 || equipamento.estado === "avariado" || equipamento.estado === "em_reparacao") && (
        <section aria-label="Alertas" className="mb-4 grid gap-2 lg:grid-cols-2">
          {equipamento.estado === "avariado" && (
            <Aviso cor={COR_ALERTA.vencido} icone={<TriangleAlertIcon />} titulo="Equipamento avariado">
              {podeMudarEstado && "Quando estiver reparado, mude o estado para Operacional."}
            </Aviso>
          )}
          {equipamento.estado === "em_reparacao" && (
            <Aviso cor={COR_ALERTA.aVencer} icone={<WrenchIcon />} titulo="Equipamento em reparação">
              {podeMudarEstado && "Quando voltar da reparação, mude o estado para Operacional."}
            </Aviso>
          )}
          {alertas.map((alerta) => (
            <Aviso
              key={alerta.tipo}
              cor={alerta.vencido ? COR_ALERTA.vencido : COR_ALERTA.aVencer}
              icone={alerta.vencido ? <TriangleAlertIcon /> : <CalendarClockIcon />}
              titulo={descreverAlerta(alerta)}
            >
              {ROTULO_PRAZO[alerta.tipo]} {formatarData(alerta.data)}.{gerente && ` ${DICA_PRAZO[alerta.tipo]}`}
            </Aviso>
          ))}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Secao id="titulo-dados" titulo="Dados" icone={ICONE_TIPO_EQUIPAMENTO[equipamento.tipo]}>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Dado rotulo="Tipo">{NOMES_TIPO_EQUIPAMENTO[equipamento.tipo]}</Dado>
            <Dado rotulo="Estado">
              <BadgeEstadoEquipamento estado={equipamento.estado} />
            </Dado>
            <Dado rotulo="Marca">{equipamento.marca ?? <Vazio />}</Dado>
            <Dado rotulo="Modelo">{equipamento.modelo ?? <Vazio />}</Dado>
            <Dado rotulo="N.º de série">
              {equipamento.numero_serie ? (
                <span className="break-all">{equipamento.numero_serie}</span>
              ) : (
                <Vazio />
              )}
            </Dado>
            {viatura && (
              <Dado rotulo="Matrícula">
                {equipamento.matricula ? <Matricula matricula={equipamento.matricula} /> : <Vazio />}
              </Dado>
            )}
            <Dado rotulo="Data de aquisição">
              {equipamento.data_aquisicao ? formatarData(equipamento.data_aquisicao) : <Vazio />}
            </Dado>
          </dl>
        </Secao>

        <div className="grid gap-4">
          <Secao id="titulo-atribuicao" titulo="Atribuição" icone={UsersRoundIcon}>
            <Atribuicao equipa={equipamento.equipa} pessoa={equipamento.pessoa} className="font-medium" />
            {!equipamento.equipa && !equipamento.pessoa && (
              <p className="-mt-2 text-sm text-muted-foreground">Não está atribuído a nenhuma equipa nem pessoa.</p>
            )}
          </Secao>

          <Secao id="titulo-prazos" titulo="Prazos" icone={CalendarClockIcon}>
            <dl className="grid gap-3 text-sm">
              {prazos.map((prazo) => (
                <div key={prazo.tipo} className="grid gap-0.5 sm:flex sm:items-baseline sm:justify-between sm:gap-4">
                  <dt className="text-muted-foreground">{ROTULO_PRAZO[prazo.tipo]}</dt>
                  <dd className="font-medium tabular-nums sm:text-right">
                    {prazo.data ? (
                      <>
                        {formatarData(prazo.data)}
                        <EstadoPrazo
                          alerta={alertas.find((alerta) => alerta.tipo === prazo.tipo)}
                          dias={diasEntre(hoje, prazo.data)}
                          abatido={equipamento.estado === "abatido"}
                        />
                      </>
                    ) : (
                      <Vazio texto="Sem data" />
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </Secao>
        </div>
      </div>

      <Secao id="titulo-notas" titulo="Notas" icone={StickyNoteIcon} className="mt-4">
        {equipamento.notas ? (
          <p className="text-sm break-words whitespace-pre-line">{equipamento.notas}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Sem notas.</p>
        )}
      </Secao>

      {gerente && (
        <Secao
          id="titulo-manutencoes"
          titulo="Manutenções"
          icone={WrenchIcon}
          descricao={
            manutencoes.length > 0
              ? manutencoes.length === 1
                ? "1 manutenção, da mais recente para a mais antiga"
                : `${manutencoes.length} manutenções, da mais recente para a mais antiga`
              : undefined
          }
          className="mt-4"
        >
          <Manutencoes
            equipamentoId={equipamento.id}
            viatura={viatura}
            prazos={{ revisao: equipamento.proxima_revisao, seguro: equipamento.seguro_ate, ipo: equipamento.ipo_ate }}
            hoje={hoje}
            manutencoes={manutencoes}
          />
        </Secao>
      )}
    </>
  )
}

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  )
}

function Vazio({ texto = "—" }: { texto?: string }) {
  return <span className="font-normal text-muted-foreground">{texto}</span>
}

/** Aviso destacado no topo da ficha (prazo vencido ou a vencer, avaria, reparação). */
function Aviso({
  cor,
  icone,
  titulo,
  children,
}: {
  cor: string
  icone: React.ReactNode
  titulo: string
  children?: React.ReactNode
}) {
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border p-3 sm:p-4 [&>svg]:mt-0.5 [&>svg]:size-5 [&>svg]:shrink-0", cor)}>
      {icone}
      <div className="min-w-0">
        <p className="font-semibold">{titulo}</p>
        {children && <p className="mt-0.5 text-sm opacity-90">{children}</p>}
      </div>
    </div>
  )
}

/** Ao lado da data: há quanto tempo venceu ou quanto falta (com a cor do alerta). */
function EstadoPrazo({ alerta, dias, abatido }: { alerta: AlertaPrazo | undefined; dias: number; abatido: boolean }) {
  if (abatido) return null
  const quantos = Math.abs(dias) === 1 ? "1 dia" : `${Math.abs(dias)} dias`
  const texto = dias < 0 ? `venceu há ${quantos}` : dias === 0 ? "hoje" : dias === 1 ? "amanhã" : `daqui a ${quantos}`
  return (
    <span
      className={cn(
        "ml-2 font-normal",
        !alerta ? "text-muted-foreground" : alerta.vencido ? "text-destructive" : "text-amber-700 dark:text-amber-300"
      )}
    >
      ({texto})
    </span>
  )
}
