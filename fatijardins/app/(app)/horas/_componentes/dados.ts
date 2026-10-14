import "server-only"

import type { Sessao } from "@/lib/auth"
import { intervaloDoMes, type PeriodoBase } from "@/lib/horas"
import type { Enums } from "@/lib/supabase/database.types"
import type { createClient } from "@/lib/supabase/server"

type Supabase = Awaited<ReturnType<typeof createClient>>

export type PessoaHoras = {
  id: string
  nome: string
  equipa: string | null
  ativo: boolean
}

/**
 * Pessoas cujas horas o utilizador pode ver no mapa:
 * colaborador → só o próprio; chefe → o próprio e os membros ativos das
 * equipas que chefia; gerente → todos (a lista mostra os ativos).
 */
export async function pessoasVisiveis(sessao: Sessao, supabase: Supabase): Promise<PessoaHoras[]> {
  const eu: PessoaHoras = { id: sessao.colaborador.id, nome: sessao.colaborador.nome, equipa: null, ativo: true }
  const perfil = sessao.colaborador.perfil
  if (perfil === "colaborador") return [eu]

  let consulta = supabase
    .from("colaboradores")
    .select("id, nome, ativo, equipa:equipas!colaboradores_equipa_id_fkey(nome)")
    .order("nome")
  if (perfil === "chefe_equipa") {
    const { data: equipas, error } = await supabase.from("equipas").select("id").eq("chefe_id", sessao.colaborador.id)
    if (error) throw new Error(`Não foi possível carregar as equipas: ${error.message}`)
    if (equipas.length === 0) return [eu]
    consulta = consulta.in("equipa_id", equipas.map((equipa) => equipa.id)).eq("ativo", true)
  }
  const { data, error } = await consulta
  if (error) throw new Error(`Não foi possível carregar os colaboradores: ${error.message}`)

  const pessoas = data.map((pessoa) => ({
    id: pessoa.id,
    nome: pessoa.nome,
    equipa: pessoa.equipa?.nome ?? null,
    ativo: pessoa.ativo,
  }))
  return pessoas.some((pessoa) => pessoa.id === eu.id) ? pessoas : [eu, ...pessoas]
}

export type PeriodoMapa = PeriodoBase & {
  id: string
  colaboradorId: string
  origem: Enums<"origem_registo_horas">
  notas: string | null
  /**
   * null se o período não tiver trabalho. Os trabalhos que a RLS esconde (o
   * colaborador só vê os de hoje) vêm da função detalhes_trabalhos_das_horas,
   * com visivel = false (não se pode abrir a ficha).
   */
  trabalho: { titulo: string; data: string; cliente: string | null; visivel: boolean } | null
  /** Onde picou a entrada/saída (só se lê para o gerente; null sem localização). */
  localEntrada: Coordenadas | null
  localSaida: Coordenadas | null
}

export type Coordenadas = { latitude: number; longitude: number }

function coordenadas(latitude: number | null, longitude: number | null): Coordenadas | null {
  return latitude !== null && longitude !== null ? { latitude, longitude } : null
}

const TAMANHO_PAGINA = 1000

/**
 * Períodos do mês (pela data da entrada em Lisboa) de uma pessoa, ou de todas (null).
 * A localização da picagem só vem com comLocalizacao (o gerente).
 */
export async function periodosDoMes(
  supabase: Supabase,
  mes: string,
  colaboradorId: string | null,
  { comLocalizacao = false }: { comLocalizacao?: boolean } = {}
): Promise<PeriodoMapa[]> {
  const { desde, ate, primeiro, ultimo } = intervaloDoMes(mes)
  const periodos: PeriodoMapa[] = []
  // A API devolve no máximo 1000 linhas de cada vez.
  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    let consulta = supabase
      .from("registos_horas")
      .select(
        `id, colaborador_id, entrada, saida, trabalho_id, a_rever, origem, notas,
         entrada_latitude, entrada_longitude, saida_latitude, saida_longitude,
         trabalho:trabalhos(titulo, data, cliente:clientes(nome))`
      )
      .gte("entrada", desde)
      .lt("entrada", ate)
      .order("entrada")
      .order("id")
      .range(inicio, inicio + TAMANHO_PAGINA - 1)
    if (colaboradorId) consulta = consulta.eq("colaborador_id", colaboradorId)
    const { data, error } = await consulta
    if (error) throw new Error(`Não foi possível carregar as horas: ${error.message}`)
    for (const registo of data) {
      periodos.push({
        id: registo.id,
        colaboradorId: registo.colaborador_id,
        entrada: registo.entrada,
        saida: registo.saida,
        trabalhoId: registo.trabalho_id,
        aRever: registo.a_rever,
        origem: registo.origem,
        notas: registo.notas,
        trabalho: registo.trabalho
          ? {
              titulo: registo.trabalho.titulo,
              data: registo.trabalho.data,
              cliente: registo.trabalho.cliente?.nome ?? null,
              visivel: true,
            }
          : null,
        localEntrada: comLocalizacao ? coordenadas(registo.entrada_latitude, registo.entrada_longitude) : null,
        localSaida: comLocalizacao ? coordenadas(registo.saida_latitude, registo.saida_longitude) : null,
      })
    }
    if (data.length < TAMANHO_PAGINA) break
  }

  // Trabalhos escondidos pela RLS: só o título/cliente, pela função da BD.
  if (periodos.some((periodo) => periodo.trabalhoId && !periodo.trabalho)) {
    const { data, error } = await supabase.rpc("detalhes_trabalhos_das_horas", { p_inicio: primeiro, p_fim: ultimo })
    if (error) throw new Error(`Não foi possível carregar os trabalhos das horas: ${error.message}`)
    const detalhes = new Map(data.map((trabalho) => [trabalho.trabalho_id, trabalho]))
    for (const periodo of periodos) {
      const detalhe = periodo.trabalhoId && !periodo.trabalho ? detalhes.get(periodo.trabalhoId) : undefined
      if (detalhe) {
        periodo.trabalho = { titulo: detalhe.titulo, data: detalhe.data, cliente: detalhe.cliente, visivel: false }
      }
    }
  }
  return periodos
}

/** Texto do trabalho de um período ("Manutenção semanal (Condomínio X)"). */
export function rotuloTrabalho(periodo: Pick<PeriodoMapa, "trabalhoId" | "trabalho">): string {
  if (!periodo.trabalhoId) return "Sem trabalho"
  // Trabalho que já não existe ou sem acesso: fica "Trabalho".
  if (!periodo.trabalho) return "Trabalho"
  return periodo.trabalho.cliente ? `${periodo.trabalho.titulo} (${periodo.trabalho.cliente})` : periodo.trabalho.titulo
}
