"use server"

import type { PostgrestError } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { erroBD, erroValidacao, SEM_PERMISSAO, type ResultadoAcao } from "@/lib/acoes"
import { obterSessao, type Sessao } from "@/lib/auth"
import { eDataValida } from "@/lib/datas"
import { eGerente, eGerenteOuChefe } from "@/lib/perfis"
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { datasDaSerie } from "@/lib/trabalhos"
import { idObrigatorio } from "@/lib/validacao/comum"
import { esquemaTrabalho, type CamposTrabalho, type DadosTrabalho } from "@/lib/validacao/trabalhos"

type Supabase = Awaited<ReturnType<typeof createClient>>

const NAO_EXISTE: ResultadoAcao<never> = {
  ok: false,
  erro: "O trabalho não existe ou não tem acesso a ele.",
}

const PEDIDO_INVALIDO: ResultadoAcao<never> = { ok: false, erro: "Pedido inválido. Atualize a página e tente de novo." }

const SO_EQUIPAS_CHEFIADAS = "Só pode agendar trabalhos nas equipas que chefia."
const SO_GERENTE_POR_ATRIBUIR = "Só o gerente pode deixar trabalhos por atribuir."
const TEM_REGISTOS = "Este trabalho já tem registos. Cancele-o em vez de o apagar."
const TEM_REGISTOS_SERIE =
  "Algum destes trabalhos já tem registos. Apague só este ou cancele os que já têm registos."

/** Estados em que o trabalho ainda pode mudar de dia ou de equipa. */
const ESTADOS_MOVEIS = ["agendado", "em_curso"] as const

const dataValida = z.string().refine((valor) => eDataValida(valor))
const equipaOuNull = z.uuid().nullable()

/** Sessão de gerente ou chefe de equipa (quem gere a agenda); null nos outros casos. */
async function sessaoGestor(): Promise<Sessao | null> {
  const sessao = await obterSessao()
  return sessao && eGerenteOuChefe(sessao.colaborador.perfil) ? sessao : null
}

/** A agenda, o Início ("O meu dia") e as páginas dos trabalhos. */
function revalidarAgenda(...ids: string[]) {
  revalidatePath("/agenda", "layout")
  revalidatePath("/")
  for (const id of ids) revalidatePath(`/trabalhos/${id}`)
  revalidatePath("/trabalhos/[id]", "layout")
}

/** Erros ao gravar: a RLS recusa (42501) quando o chefe usa uma equipa que não chefia. */
function erroGravar(erro: PostgrestError, sessao: Sessao): ResultadoAcao<never> {
  if (erro.code === "42501" && !eGerente(sessao.colaborador.perfil)) {
    console.error("Erro da base de dados:", erro.code, erro.message)
    return { ok: false, erro: SO_EQUIPAS_CHEFIADAS, campos: { equipa_id: [SO_EQUIPAS_CHEFIADAS] } }
  }
  return erroBD(erro, { emUso: "O local ou a equipa já não existem. Atualize a página." })
}

function erroCampo(campo: keyof CamposTrabalho, mensagem: string): ResultadoAcao<never> {
  return { ok: false, erro: mensagem, campos: { [campo]: [mensagem] } }
}

/**
 * Próxima posição (ordem de passagem) em cada dia para uma equipa (ou para
 * "por atribuir"): o máximo atual + 1. Devolve null se a leitura falhar.
 */
async function proximasOrdens(
  supabase: Supabase,
  equipaId: string | null,
  datas: string[],
  excluir: string[] = []
): Promise<Map<string, number> | null> {
  let consulta = supabase.from("trabalhos").select("id, data, ordem").in("data", datas)
  consulta = equipaId ? consulta.eq("equipa_id", equipaId) : consulta.is("equipa_id", null)
  const { data, error } = await consulta
  if (error) {
    console.error("Erro da base de dados:", error.code, error.message)
    return null
  }
  const ordens = new Map<string, number>(datas.map((dia) => [dia, 1]))
  for (const linha of data) {
    if (excluir.includes(linha.id)) continue
    ordens.set(linha.data, Math.max(ordens.get(linha.data) ?? 1, linha.ordem + 1))
  }
  return ordens
}

/** O local tem de pertencer ao cliente escolhido (e estar ativo, salvo se já era o do trabalho). */
async function validarLocal(
  supabase: Supabase,
  dados: DadosTrabalho,
  localAtual?: string
): Promise<{ ok: true; clienteId: string } | { ok: false; resultado: ResultadoAcao<never> }> {
  const { data: local, error } = await supabase
    .from("locais")
    .select("id, cliente_id, ativo")
    .eq("id", dados.local_id)
    .maybeSingle()
  if (error) return { ok: false, resultado: erroBD(error) }
  if (!local || local.cliente_id !== dados.cliente_id) {
    return { ok: false, resultado: erroCampo("local_id", "Escolha um local deste cliente.") }
  }
  if (!local.ativo && local.id !== localAtual) {
    return { ok: false, resultado: erroCampo("local_id", "Este local está desativado. Escolha outro.") }
  }
  return { ok: true, clienteId: local.cliente_id }
}

function urlAgendaDia(data: string, equipaId: string | null) {
  return `/agenda?vista=dia&data=${data}&equipa=${equipaId ?? "todas"}`
}

// ---------------------------------------------------------------------
// Criar e editar
// ---------------------------------------------------------------------

export async function criarTrabalho(valores: CamposTrabalho): Promise<ResultadoAcao> {
  const sessao = await sessaoGestor()
  if (!sessao) return SEM_PERMISSAO

  const gerente = eGerente(sessao.colaborador.perfil)
  const dados = esquemaTrabalho({ equipaObrigatoria: !gerente }).safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)
  const trabalho = dados.data

  const supabase = await createClient()
  const local = await validarLocal(supabase, trabalho)
  if (!local.ok) return local.resultado

  const datas = datasDaSerie(trabalho.data, trabalho.repetir, trabalho.ate ?? trabalho.data)
  const ordens = await proximasOrdens(supabase, trabalho.equipa_id, datas)
  if (!ordens) return erroBD(null)

  // Os trabalhos de uma repetição ficam ligados pelo mesmo serie_id.
  const serieId = datas.length > 1 ? crypto.randomUUID() : null
  const linhas: TablesInsert<"trabalhos">[] = datas.map((data) => ({
    local_id: trabalho.local_id,
    cliente_id: local.clienteId,
    titulo: trabalho.titulo,
    descricao: trabalho.descricao,
    tipo: trabalho.tipo,
    data,
    hora_inicio: trabalho.hora_inicio,
    duracao_prevista_min: trabalho.duracao_prevista_min,
    equipa_id: trabalho.equipa_id,
    ordem: ordens.get(data) ?? 1,
    serie_id: serieId,
  }))

  // Um só insert: ou ficam todos gravados ou nenhum.
  const { error } = await supabase.from("trabalhos").insert(linhas)
  if (error) return erroGravar(error, sessao)

  revalidarAgenda()
  return {
    ok: true,
    mensagem: datas.length === 1 ? "Trabalho criado." : `${datas.length} trabalhos criados.`,
    redirecionar: urlAgendaDia(datas[0], trabalho.equipa_id),
  }
}

/**
 * Guarda as alterações de um trabalho. Com aplicarSerie, os campos que
 * mudaram (título, tarefas, hora, duração, tipo e equipa) passam também para
 * os trabalhos seguintes da série que ainda estão agendados. A data e o local
 * só mudam neste.
 */
export async function atualizarTrabalho(
  id: string,
  valores: CamposTrabalho,
  aplicarSerie = false
): Promise<ResultadoAcao> {
  const sessao = await sessaoGestor()
  if (!sessao) return SEM_PERMISSAO

  const trabalhoId = idObrigatorio.safeParse(id)
  if (!trabalhoId.success) return NAO_EXISTE
  const gerente = eGerente(sessao.colaborador.perfil)
  const dados = esquemaTrabalho({ equipaObrigatoria: !gerente }).safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)
  const novo = dados.data

  const supabase = await createClient()
  const { data: atual, error: erroLer } = await supabase
    .from("trabalhos")
    .select("id, data, equipa_id, local_id, serie_id, ordem, titulo, descricao, tipo, hora_inicio, duracao_prevista_min")
    .eq("id", trabalhoId.data)
    .maybeSingle()
  if (erroLer) return erroBD(erroLer)
  if (!atual) return NAO_EXISTE

  const local = await validarLocal(supabase, novo, atual.local_id)
  if (!local.ok) return local.resultado

  // Mudou de dia ou de equipa: passa para o fim da ordem desse dia/equipa.
  let ordem = atual.ordem
  if (novo.data !== atual.data || novo.equipa_id !== atual.equipa_id) {
    const ordens = await proximasOrdens(supabase, novo.equipa_id, [novo.data], [atual.id])
    if (!ordens) return erroBD(null)
    ordem = ordens.get(novo.data) ?? 1
  }

  const alteracoes: TablesUpdate<"trabalhos"> = {
    local_id: novo.local_id,
    cliente_id: local.clienteId,
    titulo: novo.titulo,
    descricao: novo.descricao,
    tipo: novo.tipo,
    data: novo.data,
    hora_inicio: novo.hora_inicio,
    duracao_prevista_min: novo.duracao_prevista_min,
    equipa_id: novo.equipa_id,
    ordem,
  }
  const { data: linhas, error } = await supabase
    .from("trabalhos")
    .update(alteracoes)
    .eq("id", atual.id)
    .select("id")
  if (error) return erroGravar(error, sessao)
  if (linhas.length === 0) return NAO_EXISTE

  let seguintes: string[] = []
  if (aplicarSerie && atual.serie_id) {
    // Só os campos que mudaram, para não desfazer alterações feitas num dia em particular.
    const serie: TablesUpdate<"trabalhos"> = {}
    if (novo.titulo !== atual.titulo) serie.titulo = novo.titulo
    if (novo.descricao !== atual.descricao) serie.descricao = novo.descricao
    if (novo.tipo !== atual.tipo) serie.tipo = novo.tipo
    if (novo.hora_inicio !== (atual.hora_inicio?.slice(0, 5) ?? null)) serie.hora_inicio = novo.hora_inicio
    if (novo.duracao_prevista_min !== atual.duracao_prevista_min) {
      serie.duracao_prevista_min = novo.duracao_prevista_min
    }
    const mudouEquipa = novo.equipa_id !== atual.equipa_id
    if (mudouEquipa) serie.equipa_id = novo.equipa_id

    if (Object.keys(serie).length > 0) {
      const { data: lista, error: erroLista } = await supabase
        .from("trabalhos")
        .select("id, data")
        .eq("serie_id", atual.serie_id)
        .gt("data", atual.data)
        .eq("estado", "agendado")
        .neq("id", atual.id)
      if (erroLista) return erroBD(erroLista)

      if (lista.length > 0) {
        // Calcular as posições na nova equipa antes de mudar (para não contar estes trabalhos).
        const ordensNovas = mudouEquipa
          ? await proximasOrdens(supabase, novo.equipa_id, lista.map((t) => t.data), lista.map((t) => t.id))
          : null
        if (mudouEquipa && !ordensNovas) return erroBD(null)

        const ids = lista.map((t) => t.id)
        const { data: alterados, error: erroSerie } = await supabase
          .from("trabalhos")
          .update(serie)
          .in("id", ids)
          .eq("estado", "agendado")
          .select("id, data")
        if (erroSerie) {
          revalidarAgenda(atual.id)
          const resultado = erroGravar(erroSerie, sessao)
          const motivo = resultado.ok ? "" : ` ${resultado.erro}`
          return { ok: false, erro: `Este trabalho foi guardado, mas os seguintes da série não.${motivo}` }
        }
        seguintes = alterados.map((t) => t.id)

        if (ordensNovas) {
          // Ordem de passagem: no fim de cada dia da nova equipa (não é crítico se falhar).
          await Promise.all(
            alterados.map((t) =>
              supabase
                .from("trabalhos")
                .update({ ordem: ordensNovas.get(t.data) ?? 1 })
                .eq("id", t.id)
            )
          )
        }
      }
    }
  }

  revalidarAgenda(atual.id, ...seguintes)
  return {
    ok: true,
    mensagem:
      seguintes.length === 0
        ? "Trabalho guardado."
        : `Trabalho guardado. ${seguintes.length === 1 ? "Foi alterado também 1 trabalho seguinte" : `Foram alterados também ${seguintes.length} trabalhos seguintes`} da série.`,
    redirecionar: `/trabalhos/${atual.id}`,
  }
}

// ---------------------------------------------------------------------
// Agenda: mover e reordenar
// ---------------------------------------------------------------------

/** Muda o dia e/ou a equipa (arrastar na agenda). Fica no fim da ordem desse dia/equipa. */
export async function moverTrabalho(id: string, data: string, equipaId: string | null): Promise<ResultadoAcao> {
  const sessao = await sessaoGestor()
  if (!sessao) return SEM_PERMISSAO

  const pedido = z.object({ id: idObrigatorio, data: dataValida, equipaId: equipaOuNull }).safeParse({ id, data, equipaId })
  if (!pedido.success) return PEDIDO_INVALIDO
  const destino = pedido.data
  if (destino.equipaId === null && !eGerente(sessao.colaborador.perfil)) {
    return { ok: false, erro: SO_GERENTE_POR_ATRIBUIR }
  }

  const supabase = await createClient()
  const { data: atual, error: erroLer } = await supabase
    .from("trabalhos")
    .select("id, data, equipa_id, estado")
    .eq("id", destino.id)
    .maybeSingle()
  if (erroLer) return erroBD(erroLer)
  if (!atual) return NAO_EXISTE
  if (atual.estado === "concluido" || atual.estado === "cancelado") {
    return { ok: false, erro: "Os trabalhos concluídos ou cancelados não mudam de dia nem de equipa." }
  }
  if (atual.data === destino.data && atual.equipa_id === destino.equipaId) return { ok: true }

  const ordens = await proximasOrdens(supabase, destino.equipaId, [destino.data], [atual.id])
  if (!ordens) return erroBD(null)

  const { data: linhas, error } = await supabase
    .from("trabalhos")
    .update({ data: destino.data, equipa_id: destino.equipaId, ordem: ordens.get(destino.data) ?? 1 })
    .eq("id", atual.id)
    .in("estado", ESTADOS_MOVEIS)
    .select("id")
  if (error) {
    if (error.code === "42501" && !eGerente(sessao.colaborador.perfil)) {
      console.error("Erro da base de dados:", error.code, error.message)
      return { ok: false, erro: "Só pode mover trabalhos para as equipas que chefia." }
    }
    return erroGravar(error, sessao)
  }
  if (linhas.length === 0) return NAO_EXISTE

  revalidarAgenda(atual.id)
  return { ok: true, mensagem: "Trabalho movido." }
}

/** Grava a ordem de passagem (1..n) dos trabalhos de um dia de uma equipa. */
export async function reordenarTrabalhos(
  data: string,
  equipaId: string | null,
  ids: string[]
): Promise<ResultadoAcao> {
  const sessao = await sessaoGestor()
  if (!sessao) return SEM_PERMISSAO

  const pedido = z
    .object({
      data: dataValida,
      equipaId: equipaOuNull,
      ids: z
        .array(idObrigatorio)
        .min(1)
        .max(200)
        .refine((lista) => new Set(lista).size === lista.length),
    })
    .safeParse({ data, equipaId, ids })
  if (!pedido.success) return PEDIDO_INVALIDO
  const grupo = pedido.data

  const supabase = await createClient()
  let consulta = supabase.from("trabalhos").select("id, ordem").eq("data", grupo.data)
  consulta = grupo.equipaId ? consulta.eq("equipa_id", grupo.equipaId) : consulta.is("equipa_id", null)
  const { data: atuais, error: erroLer } = await consulta
  if (erroLer) return erroBD(erroLer)

  const ordemAtual = new Map(atuais.map((t) => [t.id, t.ordem]))
  if (grupo.ids.some((tid) => !ordemAtual.has(tid))) {
    revalidarAgenda()
    return { ok: false, erro: "A agenda foi alterada entretanto. Veja a ordem atual e tente de novo." }
  }

  // Só grava os que mudaram de posição.
  const mudancas = grupo.ids
    .map((tid, i) => ({ id: tid, ordem: i + 1 }))
    .filter((t) => ordemAtual.get(t.id) !== t.ordem)
  const resultados = await Promise.all(
    mudancas.map((t) => supabase.from("trabalhos").update({ ordem: t.ordem }).eq("id", t.id).select("id"))
  )
  const falha = resultados.find((r) => r.error)
  if (falha?.error) {
    revalidarAgenda()
    return erroGravar(falha.error, sessao)
  }
  if (resultados.some((r) => (r.data?.length ?? 0) === 0)) {
    revalidarAgenda()
    return SEM_PERMISSAO
  }

  revalidarAgenda(...mudancas.map((t) => t.id))
  return { ok: true, mensagem: "Ordem guardada." }
}

// ---------------------------------------------------------------------
// Cancelar, reativar e apagar
// ---------------------------------------------------------------------

async function lerEstado(supabase: Supabase, id: string) {
  return supabase.from("trabalhos").select("id, data, equipa_id, estado, serie_id").eq("id", id).maybeSingle()
}

export async function cancelarTrabalho(id: string): Promise<ResultadoAcao> {
  const sessao = await sessaoGestor()
  if (!sessao) return SEM_PERMISSAO
  const trabalhoId = idObrigatorio.safeParse(id)
  if (!trabalhoId.success) return NAO_EXISTE

  const supabase = await createClient()
  const { data: atual, error: erroLer } = await lerEstado(supabase, trabalhoId.data)
  if (erroLer) return erroBD(erroLer)
  if (!atual) return NAO_EXISTE
  if (atual.estado === "concluido") return { ok: false, erro: "Este trabalho já está concluído." }
  if (atual.estado === "cancelado") return { ok: true, mensagem: "O trabalho já estava cancelado." }

  const { data: linhas, error } = await supabase
    .from("trabalhos")
    .update({ estado: "cancelado" })
    .eq("id", atual.id)
    .in("estado", ESTADOS_MOVEIS)
    .select("id")
  if (error) return erroGravar(error, sessao)
  if (linhas.length === 0) return NAO_EXISTE

  revalidarAgenda(atual.id)
  return { ok: true, mensagem: "Trabalho cancelado." }
}

export async function reativarTrabalho(id: string): Promise<ResultadoAcao> {
  const sessao = await sessaoGestor()
  if (!sessao) return SEM_PERMISSAO
  const trabalhoId = idObrigatorio.safeParse(id)
  if (!trabalhoId.success) return NAO_EXISTE

  const supabase = await createClient()
  const { data: linhas, error } = await supabase
    .from("trabalhos")
    .update({ estado: "agendado" })
    .eq("id", trabalhoId.data)
    .eq("estado", "cancelado")
    .select("id")
  if (error) return erroGravar(error, sessao)
  if (linhas.length === 0) return { ok: false, erro: "Este trabalho não está cancelado ou não tem acesso a ele." }

  revalidarAgenda(trabalhoId.data)
  return { ok: true, mensagem: "Trabalho reativado." }
}

/** Apaga um trabalho agendado (e, opcionalmente, os seguintes da mesma série). */
export async function apagarTrabalho(id: string, incluirSeguintes = false): Promise<ResultadoAcao> {
  const sessao = await sessaoGestor()
  if (!sessao) return SEM_PERMISSAO
  const trabalhoId = idObrigatorio.safeParse(id)
  if (!trabalhoId.success) return NAO_EXISTE

  const supabase = await createClient()
  const { data: atual, error: erroLer } = await lerEstado(supabase, trabalhoId.data)
  if (erroLer) return erroBD(erroLer)
  if (!atual) return NAO_EXISTE
  if (atual.estado !== "agendado") {
    return { ok: false, erro: "Só se podem apagar trabalhos agendados. Cancele-o em vez de o apagar." }
  }

  const ids = [atual.id]
  if (incluirSeguintes && atual.serie_id) {
    const { data: seguintes, error } = await supabase
      .from("trabalhos")
      .select("id")
      .eq("serie_id", atual.serie_id)
      .gt("data", atual.data)
      .eq("estado", "agendado")
    if (error) return erroBD(error)
    ids.push(...seguintes.map((t) => t.id).filter((tid) => tid !== atual.id))
  }
  const mensagemRegistos = ids.length > 1 ? TEM_REGISTOS_SERIE : TEM_REGISTOS

  // As horas picadas não impedem o apagar (ficariam sem trabalho): verificar antes.
  const { count, error: erroHoras } = await supabase
    .from("registos_horas")
    .select("id", { count: "exact", head: true })
    .in("trabalho_id", ids)
  if (erroHoras) return erroBD(erroHoras)
  if (count) return { ok: false, erro: mensagemRegistos }

  const { data: apagados, error } = await supabase
    .from("trabalhos")
    .delete()
    .in("id", ids)
    .eq("estado", "agendado")
    .select("id")
  if (error) return erroBD(error, { emUso: mensagemRegistos })
  if (apagados.length === 0) return NAO_EXISTE

  revalidarAgenda(...apagados.map((t) => t.id))
  return {
    ok: true,
    mensagem: apagados.length === 1 ? "Trabalho apagado." : `${apagados.length} trabalhos apagados.`,
    redirecionar: urlAgendaDia(atual.data, atual.equipa_id),
  }
}
