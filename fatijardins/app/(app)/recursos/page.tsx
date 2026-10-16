import { Suspense } from "react"
import Link from "next/link"
import { ArchiveIcon, ChevronRightIcon, CircleCheckIcon, PlusIcon, SearchXIcon, TruckIcon } from "lucide-react"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { CampoPesquisa } from "@/components/campo-pesquisa"
import { EstadoVazio } from "@/components/estado-vazio"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { exigirPerfil, obterSessao } from "@/lib/auth"
import { hojeEmLisboa } from "@/lib/formatar"
import { eGerente } from "@/lib/perfis"
import { alertasEquipamento, DIAS_AVISO, NOMES_TIPO_EQUIPAMENTO } from "@/lib/recursos"
import { createClient } from "@/lib/supabase/server"
import { normalizarPesquisa } from "@/lib/texto"
import { cn } from "@/lib/utils"
import { SeparadoresRecursos } from "./_componentes/separadores"
import { temAlerta, urgenciaEquipamento } from "./_equipamentos/alertas"
import { EsqueletoListaEquipamentos } from "./_equipamentos/esqueletos"
import {
  Atribuicao,
  BadgeEstadoEquipamento,
  EtiquetaAlerta,
  IconeTipoEquipamento,
  Matricula,
} from "./_equipamentos/visual"

export const metadata = { title: "Equipamentos" }

type ParametrosPesquisa = PageProps<"/recursos">["searchParams"]

const FILTROS = ["ativos", "alertas", "abatidos"] as const
type Filtro = (typeof FILTROS)[number]

const ROTULO_FILTRO: Record<Filtro, string> = {
  ativos: "Ativos",
  alertas: "Com alertas",
  abatidos: "Abatidos",
}

function primeiroValor(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? ""
}

type EquipamentoPesquisavel = {
  nome: string
  marca: string | null
  modelo: string | null
  matricula: string | null
  numero_serie: string | null
}

/**
 * Todas as palavras têm de aparecer no nome, marca, modelo, matrícula ou
 * n.º de série, sem contar acentos. A matrícula também se encontra sem
 * hífenes ("aa12bc").
 */
function corresponde(equipamento: EquipamentoPesquisavel, pesquisa: string) {
  const { nome, marca, modelo, matricula, numero_serie } = equipamento
  const texto = normalizarPesquisa(
    [nome, marca, modelo, matricula, matricula?.replace(/-/g, ""), numero_serie].filter(Boolean).join(" ")
  )
  const palavras = normalizarPesquisa(pesquisa)
    .replace(/[^\p{L}\p{N}._/-]+/gu, " ")
    .split(" ")
    .filter(Boolean)
  return palavras.every((palavra) => texto.includes(palavra))
}

async function BotaoNovoEquipamento() {
  const sessao = await obterSessao()
  if (!eGerente(sessao?.colaborador.perfil)) return null
  return <LigacaoNovoEquipamento />
}

function LigacaoNovoEquipamento() {
  return (
    <Button asChild size="lg">
      <Link href="/recursos/equipamentos/novo">
        <PlusIcon />
        Novo equipamento
      </Link>
    </Button>
  )
}

export default function PaginaEquipamentos(props: PageProps<"/recursos">) {
  return (
    <>
      <SeparadoresRecursos />
      <CabecalhoPagina
        titulo="Equipamentos"
        acoes={
          <Suspense fallback={null}>
            <BotaoNovoEquipamento />
          </Suspense>
        }
      />
      <div className="mb-4">
        <Suspense fallback={<Skeleton className="h-11 w-full md:h-10" />}>
          <CampoPesquisa placeholder="Nome, marca, modelo ou matrícula" />
        </Suspense>
      </div>
      <Suspense fallback={<EsqueletoListaEquipamentos />}>
        <ListaEquipamentos searchParams={props.searchParams} />
      </Suspense>
    </>
  )
}

async function ListaEquipamentos({ searchParams }: { searchParams: ParametrosPesquisa }) {
  const sessao = await exigirPerfil("gerente", "chefe_equipa")
  const parametros = await searchParams
  const textoPesquisa = primeiroValor(parametros.q)
  const pesquisa = textoPesquisa.trim()
  const filtro = FILTROS.find((f) => f === primeiroValor(parametros.filtro)) ?? "ativos"

  const supabase = await createClient()
  const { data: todos, error } = await supabase
    .from("equipamentos")
    .select(
      `id, nome, tipo, marca, modelo, matricula, numero_serie, estado, proxima_revisao, seguro_ate, ipo_ate,
       equipa:equipas(nome, cor), pessoa:colaboradores(nome)`
    )
    .order("nome")
  if (error) throw new Error(`Erro ao carregar os equipamentos: ${error.message}`)

  // Hora atual depois do createClient() (pedido dinâmico).
  const hoje = hojeEmLisboa()
  // Pesquisa aqui (e não na BD) para ignorar acentos, como nos orçamentos.
  const pesquisados = (pesquisa ? todos.filter((equipamento) => corresponde(equipamento, pesquisa)) : todos).map(
    (equipamento) => ({ ...equipamento, alertas: alertasEquipamento(equipamento, hoje) })
  )
  const porFiltro: Record<Filtro, typeof pesquisados> = {
    ativos: pesquisados.filter((equipamento) => equipamento.estado !== "abatido"),
    alertas: pesquisados
      .filter((equipamento) => temAlerta(equipamento.estado, equipamento.alertas))
      .sort((a, b) => urgenciaEquipamento(a.estado, a.alertas) - urgenciaEquipamento(b.estado, b.alertas)),
    abatidos: pesquisados.filter((equipamento) => equipamento.estado === "abatido"),
  }
  const equipamentos = porFiltro[filtro]

  // Filtros que mantêm a pesquisa.
  function hrefFiltro(valor: Filtro) {
    const novos = new URLSearchParams()
    if (pesquisa) novos.set("q", textoPesquisa)
    if (valor !== "ativos") novos.set("filtro", valor)
    return novos.size ? `/recursos?${novos}` : "/recursos"
  }

  if (todos.length === 0) {
    return (
      <EstadoVazio
        icone={TruckIcon}
        titulo="Ainda não há equipamentos"
        descricao="Registe as viaturas, máquinas e ferramentas da empresa para acompanhar o estado e os prazos."
        acao={eGerente(sessao.colaborador.perfil) ? <LigacaoNovoEquipamento /> : undefined}
      />
    )
  }

  return (
    <>
      <nav aria-label="Filtrar equipamentos" className="mb-4">
        <ul className="flex flex-wrap gap-2">
          {FILTROS.map((valor) => {
            const ativo = valor === filtro
            return (
              <li key={valor}>
                <Link
                  href={hrefFiltro(valor)}
                  replace
                  scroll={false}
                  aria-current={ativo ? "true" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors sm:px-4",
                    ativo ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
                  )}
                >
                  {ROTULO_FILTRO[valor]}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs tabular-nums",
                      ativo
                        ? "bg-primary-foreground/20"
                        : valor === "alertas" && porFiltro.alertas.length > 0
                          ? "bg-destructive text-white"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {porFiltro[valor].length}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <p className="mb-2 text-sm text-muted-foreground">
        {equipamentos.length === 1 ? "1 equipamento" : `${equipamentos.length} equipamentos`}
        {filtro === "alertas" && equipamentos.length > 1 && ", do mais urgente para o menos urgente"}
      </p>

      {equipamentos.length === 0 ? (
        pesquisa ? (
          <EstadoVazio
            icone={SearchXIcon}
            titulo="Nenhum equipamento encontrado"
            descricao="Experimente pesquisar pelo nome, pela marca ou pela matrícula, ou veja outro filtro."
          />
        ) : filtro === "alertas" ? (
          <EstadoVazio
            icone={CircleCheckIcon}
            titulo="Sem alertas"
            descricao={`Nenhum equipamento está avariado ou tem revisão, seguro ou IPO a vencer nos próximos ${DIAS_AVISO} dias.`}
          />
        ) : filtro === "abatidos" ? (
          <EstadoVazio
            icone={ArchiveIcon}
            titulo="Não há equipamentos abatidos"
            descricao="Os equipamentos que deixam de ser usados ficam aqui, com o seu histórico."
          />
        ) : (
          <EstadoVazio
            icone={ArchiveIcon}
            titulo="Todos os equipamentos estão abatidos"
            descricao="Veja-os no filtro Abatidos."
          />
        )
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          {/* Cabeçalho das colunas (só no PC). */}
          <div
            aria-hidden="true"
            className="hidden border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[2.5rem_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.4fr)_1rem] md:gap-x-4"
          >
            <span />
            <span>Equipamento</span>
            <span>Atribuição</span>
            <span>Estado e alertas</span>
          </div>
          <ul className="divide-y">
            {equipamentos.map((equipamento) => {
              const marcaModelo = [equipamento.marca, equipamento.modelo].filter(Boolean).join(" ")
              return (
                <li key={equipamento.id}>
                  {/* No telemóvel, os dados ficam empilhados ao lado do ícone; no PC, em colunas. */}
                  <Link
                    href={`/recursos/equipamentos/${equipamento.id}`}
                    className="grid min-h-20 grid-cols-[2.5rem_minmax(0,1fr)_1rem] gap-x-3 gap-y-1.5 px-4 py-3 transition-colors hover:bg-accent/50 active:bg-accent md:grid-cols-[2.5rem_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.4fr)_1rem] md:items-center md:gap-x-4"
                  >
                    <IconeTipoEquipamento
                      tipo={equipamento.tipo}
                      className={cn("col-start-1 row-span-3 row-start-1 md:row-span-1", equipamento.estado === "abatido" && "opacity-60")}
                    />
                    <span className="col-start-2 row-start-1 min-w-0">
                      <span className="block font-medium break-words">{equipamento.nome}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                        <span className="break-words">
                          {[NOMES_TIPO_EQUIPAMENTO[equipamento.tipo], marcaModelo].filter(Boolean).join(" · ")}
                        </span>
                        {equipamento.matricula && <Matricula matricula={equipamento.matricula} />}
                      </span>
                    </span>
                    <Atribuicao
                      equipa={equipamento.equipa}
                      pessoa={equipamento.pessoa}
                      className="col-start-2 row-start-2 text-sm md:col-start-3 md:row-start-1"
                    />
                    <span className="col-start-2 row-start-3 flex flex-wrap items-center gap-1.5 md:col-start-4 md:row-start-1">
                      <BadgeEstadoEquipamento estado={equipamento.estado} />
                      {equipamento.alertas.map((alerta) => (
                        <EtiquetaAlerta key={alerta.tipo} alerta={alerta} />
                      ))}
                    </span>
                    <ChevronRightIcon
                      aria-hidden="true"
                      className="col-start-3 row-span-3 row-start-1 size-4 self-center text-muted-foreground md:col-start-5 md:row-span-1"
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </>
  )
}
