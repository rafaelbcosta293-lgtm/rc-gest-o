import { Suspense } from "react"
import Link from "next/link"
import { UsersIcon } from "lucide-react"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { EstadoVazio } from "@/components/estado-vazio"
import { Button } from "@/components/ui/button"
import { exigirPerfil } from "@/lib/auth"
import { diasEntre, eFimDeSemana, feriadoNacional, inicioDaSemana, somarDiasData } from "@/lib/datas"
import { formatarHora, hojeEmLisboa } from "@/lib/formatar"
import { eGerente } from "@/lib/perfis"
import { NOMES_TIPO_AUSENCIA } from "@/lib/rotulos"
import { createClient } from "@/lib/supabase/server"
import { BarraAgenda, EsqueletoBarraAgenda } from "./_componentes/barra-agenda"
import { BotaoNovoTrabalho, BotaoNovoTrabalhoEsqueleto } from "./_componentes/botao-novo-trabalho"
import { EsqueletoAgenda } from "./_componentes/esqueletos"
import { FiltroEquipa } from "./_componentes/filtro-equipa"
import {
  chaveCelula,
  lerParametrosAgenda,
  urlAgenda,
  type Ausentes,
  type DiaAgenda,
  type LinhaEquipa,
  type TrabalhoAgenda,
} from "./_componentes/tipos"
import { VistaDia } from "./_componentes/vista-dia"
import { VistaSemana } from "./_componentes/vista-semana"

export const metadata = { title: "Agenda" }

type ParametrosPesquisa = PageProps<"/agenda">["searchParams"]

function primeiroValor(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor
}

export default function PaginaAgenda(props: PageProps<"/agenda">) {
  return (
    <>
      <CabecalhoPagina
        titulo="Agenda"
        acoes={
          <Suspense fallback={<BotaoNovoTrabalhoEsqueleto />}>
            <BotaoNovoTrabalho />
          </Suspense>
        }
      />
      <Suspense fallback={<EsqueletoBarraAgenda />}>
        <BarraAgenda />
      </Suspense>
      <Suspense fallback={<EsqueletoAgenda />}>
        <Agenda searchParams={props.searchParams} />
      </Suspense>
    </>
  )
}

async function Agenda({ searchParams }: { searchParams: ParametrosPesquisa }) {
  const sessao = await exigirPerfil("gerente", "chefe_equipa")
  const pesquisa = await searchParams
  const supabase = await createClient()
  const hoje = hojeEmLisboa()
  const parametros = lerParametrosAgenda((nome) => primeiroValor(pesquisa[nome]), hoje)
  const inicio = parametros.vista === "semana" ? inicioDaSemana(parametros.data) : parametros.data
  const fim = parametros.vista === "semana" ? somarDiasData(inicio, 6) : inicio

  // A RLS filtra: o chefe só recebe os trabalhos (e as ausências) das equipas que chefia.
  const [equipasR, trabalhosR, ausenciasR] = await Promise.all([
    supabase.from("equipas").select("id, nome, cor, ativa, chefe_id").order("nome"),
    supabase
      .from("trabalhos")
      .select(
        "id, titulo, data, hora_inicio, duracao_prevista_min, equipa_id, ordem, estado, tipo, serie_id, cliente:clientes(nome), local:locais(nome)"
      )
      .gte("data", inicio)
      .lte("data", fim)
      .order("data")
      .order("ordem"),
    supabase
      .from("ausencias")
      .select("tipo, data_inicio, data_fim, colaborador:colaboradores(nome, equipa_id, ativo)")
      .lte("data_inicio", fim)
      .gte("data_fim", inicio),
  ])
  if (equipasR.error) throw new Error(`Erro ao carregar as equipas: ${equipasR.error.message}`)
  if (trabalhosR.error) throw new Error(`Erro ao carregar os trabalhos: ${trabalhosR.error.message}`)
  if (ausenciasR.error) throw new Error(`Erro ao carregar as ausências: ${ausenciasR.error.message}`)

  const gerente = eGerente(sessao.colaborador.perfil)
  const equipas = equipasR.data
  const chefiadas = new Set(equipas.filter((e) => e.chefe_id === sessao.colaborador.id).map((e) => e.id))
  const editavel = (id: string | null) => gerente || (id !== null && chefiadas.has(id))
  const comTrabalhos = new Set(trabalhosR.data.map((t) => t.equipa_id))

  // Linhas (semana) ou colunas (dia): uma por equipa e "Por atribuir" (só o gerente).
  const filtrada = equipas.find((e) => e.id === parametros.equipa)
  if (!filtrada) parametros.equipa = "todas"
  const paraLinha = (e: (typeof equipas)[number]): LinhaEquipa => ({
    id: e.id,
    nome: e.ativa ? e.nome : `${e.nome} (inativa)`,
    cor: e.cor,
    editavel: editavel(e.id),
  })
  let linhas: LinhaEquipa[]
  if (filtrada) {
    linhas = [paraLinha(filtrada)]
  } else {
    // Na semana o chefe vê também as outras equipas (sem os trabalhos), para
    // perceber porque não pode largar lá; no dia só as suas.
    linhas = equipas
      .filter((e) => e.ativa || comTrabalhos.has(e.id))
      .filter((e) => parametros.vista === "semana" || editavel(e.id) || comTrabalhos.has(e.id))
      .map(paraLinha)
      .sort((a, b) => Number(b.editavel) - Number(a.editavel))
    if (gerente) linhas.push({ id: null, nome: "Por atribuir", cor: null, editavel: true })
  }

  const idsLinhas = new Set(linhas.map((l) => l.id))
  const trabalhos: TrabalhoAgenda[] = trabalhosR.data
    .filter((t) => idsLinhas.has(t.equipa_id))
    .map((t) => ({
      id: t.id,
      titulo: t.titulo,
      data: t.data,
      hora: t.hora_inicio ? formatarHora(t.hora_inicio) : null,
      duracaoMin: t.duracao_prevista_min,
      equipaId: t.equipa_id,
      ordem: t.ordem,
      estado: t.estado,
      tipo: t.tipo,
      serie: t.serie_id !== null,
      cliente: t.cliente?.nome ?? "",
      local: t.local?.nome ?? "",
    }))

  const dias: DiaAgenda[] = diasEntre(inicio, fim).map((data) => ({
    data,
    feriado: feriadoNacional(data),
    hoje: data === hoje,
    fimDeSemana: eFimDeSemana(data),
  }))
  const hrefDia = Object.fromEntries(
    dias.map((dia) => [dia.data, urlAgenda({ ...parametros, vista: "dia", data: dia.data }, hoje)])
  )

  // Ausências de cada equipa em cada dia ("Nuno Pires — Férias").
  const ausentes: Ausentes = {}
  for (const ausencia of ausenciasR.data) {
    const colaborador = ausencia.colaborador
    if (!colaborador?.ativo || !colaborador.equipa_id) continue
    const desde = ausencia.data_inicio > inicio ? ausencia.data_inicio : inicio
    const ate = ausencia.data_fim < fim ? ausencia.data_fim : fim
    for (const dia of diasEntre(desde, ate)) {
      const chave = chaveCelula(colaborador.equipa_id, dia)
      ausentes[chave] = [...(ausentes[chave] ?? []), { nome: colaborador.nome, motivo: NOMES_TIPO_AUSENCIA[ausencia.tipo] }]
    }
  }
  for (const lista of Object.values(ausentes)) lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt"))

  const opcoesEquipa = equipas
    .filter((e) => (gerente ? e.ativa : chefiadas.has(e.id)) || e.id === filtrada?.id)
    .map((e) => ({ id: e.id, nome: e.nome }))
  const total = trabalhos.length

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <FiltroEquipa parametros={parametros} hoje={hoje} equipas={opcoesEquipa} />
        <p className="text-sm text-muted-foreground">
          {total === 0 ? "Sem trabalhos" : total === 1 ? "1 trabalho" : `${total} trabalhos`}
          {parametros.vista === "semana" ? " nesta semana" : " neste dia"}
        </p>
      </div>

      {!gerente && chefiadas.size === 0 && (
        <div className="mb-4">
          <EstadoVazio
            icone={UsersIcon}
            titulo="Não chefia nenhuma equipa"
            descricao="Peça ao gerente para o indicar como chefe de uma equipa para gerir a agenda dela."
            acao={
              <Button asChild variant="outline">
                <Link href="/equipa">Ver equipas</Link>
              </Button>
            }
          />
        </div>
      )}

      {parametros.vista === "semana" ? (
        <VistaSemana
          key={`${inicio}-${parametros.equipa}`}
          dias={dias}
          linhas={linhas}
          trabalhos={trabalhos}
          ausentes={ausentes}
          hrefDia={hrefDia}
        />
      ) : (
        <VistaDia
          key={`${inicio}-${parametros.equipa}`}
          dia={dias[0]}
          linhas={linhas}
          trabalhos={trabalhos}
          ausentes={ausentes}
        />
      )}
    </>
  )
}
