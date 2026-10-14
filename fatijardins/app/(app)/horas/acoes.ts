"use server"

import { revalidatePath } from "next/cache"
import type { PostgrestError } from "@supabase/supabase-js"

import { erroBD, erroValidacao, SEM_PERMISSAO, type ResultadoAcao } from "@/lib/acoes"
import { obterSessao, type Sessao } from "@/lib/auth"
import { formatarData, formatarHora, hojeEmLisboa } from "@/lib/formatar"
import { dataEmLisboa, instanteLisboa } from "@/lib/horas"
import { eGerente } from "@/lib/perfis"
import { createClient } from "@/lib/supabase/server"
import { idObrigatorio } from "@/lib/validacao/comum"
import {
  esquemaLocalizacao,
  esquemaPeriodo,
  esquemaPicarEntrada,
  type CamposPeriodo,
  type DadosLocalizacao,
  type DadosPicarEntrada,
} from "@/lib/validacao/horas"

/** Resultado da picagem: aviso = saída esquecida de outro dia fechada automaticamente. */
export type ResultadoPicagem = ResultadoAcao<{ aviso?: string }>

const NAO_EXISTE: ResultadoAcao<never> = {
  ok: false,
  erro: "O período não existe ou já foi apagado.",
}
const SOBREPOSTO = "Este período sobrepõe-se a outro registo desta pessoa."

/**
 * Erros de picar_entrada/picar_saida. As mensagens das funções ("Este
 * trabalho não é de hoje…", "Não tem nenhuma entrada aberta.") já são para
 * a pessoa e o erroBD mostra-as tal como estão.
 */
function erroPicagem(erro: PostgrestError): ResultadoAcao<never> {
  if (erro.code === "23P01") {
    console.error("Erro na picagem:", erro.code, erro.message)
    return { ok: false, erro: "Já existe um período registado a esta hora. Fale com o gerente." }
  }
  return erroBD(erro, { duplicado: "Já tem uma entrada aberta. Atualize a página." })
}

function avisoSaidaEsquecida(entrada: string) {
  const dia = formatarData(dataEmLisboa(entrada)).slice(0, 5)
  return `A saída de ${dia} não foi registada: ficou às 23:59 e o gerente vai rever.`
}

/** Páginas que mostram horas ou o estado dos trabalhos. */
function revalidarHoras(...trabalhos: (string | null | undefined)[]) {
  revalidatePath("/")
  revalidatePath("/horas")
  revalidatePath("/agenda")
  for (const id of new Set(trabalhos)) if (id) revalidatePath(`/trabalhos/${id}`)
}

function coordenadas({ latitude, longitude }: DadosLocalizacao) {
  return latitude !== null && longitude !== null ? { p_latitude: latitude, p_longitude: longitude } : {}
}

// ---------------------------------------------------------------------
// Picagem (todos os perfis; a hora é sempre a do servidor)
// ---------------------------------------------------------------------

export async function picarEntrada(dados: DadosPicarEntrada): Promise<ResultadoPicagem> {
  const sessao = await obterSessao()
  if (!sessao) return SEM_PERMISSAO
  const validacao = esquemaPicarEntrada.safeParse(dados)
  if (!validacao.success) return { ok: false, erro: "Dados da picagem inválidos. Atualize a página." }
  const { trabalhoId } = validacao.data

  const supabase = await createClient()
  // Entrada em aberto antes de picar: se for de outro dia, a função fecha-a
  // às 23:59 e marca-a "a rever" (a pessoa tem de ser avisada).
  const { data: aberto, error: erroAberto } = await supabase
    .from("registos_horas")
    .select("id, entrada, trabalho_id")
    .eq("colaborador_id", sessao.colaborador.id)
    .is("saida", null)
    .maybeSingle()
  if (erroAberto) return erroBD(erroAberto)

  const hoje = hojeEmLisboa()
  const abertoHoje = aberto !== null && dataEmLisboa(aberto.entrada) === hoje
  if (abertoHoje && aberto.trabalho_id === trabalhoId) {
    return { ok: false, erro: trabalhoId ? "Já está a picar neste trabalho." : "Já está a picar sem trabalho." }
  }

  const { data: registo, error } = await supabase.rpc("picar_entrada", {
    ...(trabalhoId ? { p_trabalho_id: trabalhoId } : {}),
    ...coordenadas(validacao.data),
  })
  if (error) return erroPicagem(error)

  revalidarHoras(aberto?.trabalho_id, trabalhoId)
  const hora = formatarHora(registo.entrada)
  return {
    ok: true,
    mensagem: abertoHoje ? `Mudou de trabalho às ${hora}.` : `Entrada picada às ${hora}.`,
    dados: { aviso: aberto && !abertoHoje ? avisoSaidaEsquecida(aberto.entrada) : undefined },
  }
}

export async function picarSaida(dados: DadosLocalizacao): Promise<ResultadoPicagem> {
  const sessao = await obterSessao()
  if (!sessao) return SEM_PERMISSAO
  const validacao = esquemaLocalizacao.safeParse(dados)
  if (!validacao.success) return { ok: false, erro: "Dados da picagem inválidos. Atualize a página." }

  const supabase = await createClient()
  const { data: registo, error } = await supabase.rpc("picar_saida", coordenadas(validacao.data))
  if (error) return erroPicagem(error)

  revalidarHoras(registo.trabalho_id)
  if (registo.a_rever && dataEmLisboa(registo.entrada) < hojeEmLisboa()) {
    return { ok: true, mensagem: "Saída registada.", dados: { aviso: avisoSaidaEsquecida(registo.entrada) } }
  }
  return { ok: true, mensagem: `Saída picada às ${formatarHora(registo.saida)}.` }
}

// ---------------------------------------------------------------------
// Correções (só o gerente)
// ---------------------------------------------------------------------

async function sessaoGerente(): Promise<Sessao | null> {
  const sessao = await obterSessao()
  return sessao && eGerente(sessao.colaborador.perfil) ? sessao : null
}

function erroCampo(campo: string, mensagem: string): ResultadoAcao<never> {
  return { ok: false, erro: mensagem, campos: { [campo]: [mensagem] } }
}

async function guardarPeriodo(id: string | null, campos: CamposPeriodo): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO
  if (id !== null && !idObrigatorio.safeParse(id).success) return NAO_EXISTE
  const validacao = esquemaPeriodo.safeParse(campos)
  if (!validacao.success) return erroValidacao(validacao.error)
  const v = validacao.data

  const supabase = await createClient()
  let anterior: { trabalho_id: string | null; saida: string | null } | null = null
  if (id) {
    const { data, error } = await supabase
      .from("registos_horas")
      .select("trabalho_id, saida")
      .eq("id", id)
      .maybeSingle()
    if (error) return erroBD(error)
    if (!data) return NAO_EXISTE
    anterior = data
  }
  // Sem saída só se pode deixar um período que ainda está aberto.
  if (v.saida === "" && anterior?.saida !== null) return erroCampo("saida", "Indique a hora de saída.")

  // Horas de Lisboa nessa data (com a hora de verão/inverno certa).
  const entrada = instanteLisboa(v.data, v.entrada)
  const saida = v.saida ? instanteLisboa(v.data, v.saida) : null
  const agora = Date.now()
  if (entrada.getTime() > agora) return erroCampo("entrada", "A entrada não pode ser no futuro.")
  if (saida && saida.getTime() > agora) return erroCampo("saida", "A saída não pode ser no futuro.")
  if (saida && saida <= entrada) return erroCampo("saida", "A saída tem de ser depois da entrada.")

  if (v.trabalhoId) {
    const { data: trabalho, error } = await supabase
      .from("trabalhos")
      .select("data")
      .eq("id", v.trabalhoId)
      .maybeSingle()
    if (error) return erroBD(error)
    if (trabalho?.data !== v.data) return erroCampo("trabalhoId", "Escolha um trabalho desse dia.")
  }

  const valores = {
    entrada: entrada.toISOString(),
    saida: saida ? saida.toISOString() : null,
    trabalho_id: v.trabalhoId,
    notas: v.notas,
  }
  // Corrigir um período conta como revisto.
  const resultado = id
    ? await supabase
        .from("registos_horas")
        .update({ ...valores, a_rever: false })
        .eq("id", id)
        .select("id")
    : await supabase
        .from("registos_horas")
        .insert({ ...valores, colaborador_id: v.colaboradorId, origem: "manual" })
        .select("id")

  if (resultado.error) {
    switch (resultado.error.code) {
      case "23P01":
        console.error("Período sobreposto:", resultado.error.message)
        return { ok: false, erro: SOBREPOSTO, campos: { entrada: [SOBREPOSTO] } }
      case "23505":
        return { ok: false, erro: "Esta pessoa já tem um período em aberto." }
      case "23503":
        return { ok: false, erro: "A pessoa ou o trabalho escolhido já não existe." }
    }
    return erroBD(resultado.error)
  }
  if (resultado.data.length === 0) return id ? NAO_EXISTE : SEM_PERMISSAO

  revalidarHoras(anterior?.trabalho_id, v.trabalhoId)
  return { ok: true, mensagem: id ? "Período atualizado." : "Período adicionado." }
}

export async function adicionarPeriodo(campos: CamposPeriodo): Promise<ResultadoAcao> {
  return guardarPeriodo(null, campos)
}

export async function editarPeriodo(id: string, campos: CamposPeriodo): Promise<ResultadoAcao> {
  return guardarPeriodo(id, campos)
}

export async function apagarPeriodo(id: string): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO
  if (!idObrigatorio.safeParse(id).success) return NAO_EXISTE

  const supabase = await createClient()
  const { data, error } = await supabase.from("registos_horas").delete().eq("id", id).select("trabalho_id")
  if (error) return erroBD(error)
  if (data.length === 0) return NAO_EXISTE

  revalidarHoras(data[0].trabalho_id)
  return { ok: true, mensagem: "Período apagado." }
}

export async function marcarRevisto(id: string): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO
  if (!idObrigatorio.safeParse(id).success) return NAO_EXISTE

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("registos_horas")
    .update({ a_rever: false })
    .eq("id", id)
    .select("trabalho_id")
  if (error) return erroBD(error)
  if (data.length === 0) return NAO_EXISTE

  revalidarHoras(data[0].trabalho_id)
  return { ok: true, mensagem: "Marcado como revisto." }
}
