"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { erroBD, erroValidacao, SEM_PERMISSAO, type ResultadoAcao } from "@/lib/acoes"
import { obterSessao } from "@/lib/auth"
import { ESTADOS_CONTRATO, formatarMes, type EstadoContrato } from "@/lib/financas"
import { formatarMoeda, hojeEmLisboa } from "@/lib/formatar"
import { eGerente } from "@/lib/perfis"
import type { TablesInsert } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { idObrigatorio } from "@/lib/validacao/comum"
import { esquemaContrato, type CamposContrato, type DadosContrato } from "@/lib/validacao/contratos"

type Supabase = Awaited<ReturnType<typeof createClient>>

const NAO_EXISTE: ResultadoAcao<never> = {
  ok: false,
  erro: "O contrato não existe ou não tem acesso a ele.",
}

const NAO_SE_APAGA = "Este contrato já tem cobranças ou visitas feitas: termine-o em vez de o apagar."
const JA_NAO_EXISTE = { emUso: "O local ou a equipa já não existem. Atualize a página." }

/** Só o gerente gere os contratos (a RLS também o garante). */
async function sessaoGerente(): Promise<boolean> {
  const sessao = await obterSessao()
  return eGerente(sessao?.colaborador.perfil)
}

/**
 * Os contratos, as cobranças e as dívidas (Finanças), a agenda e o Início
 * (visitas geradas), as fichas dos trabalhos e dos clientes.
 */
function revalidarContratos() {
  revalidatePath("/financas", "layout")
  revalidatePath("/agenda", "layout")
  revalidatePath("/")
  revalidatePath("/trabalhos/[id]", "page")
  revalidatePath("/clientes/[id]", "page")
}

function erroCampo(campo: keyof CamposContrato, mensagem: string): ResultadoAcao<never> {
  return { ok: false, erro: mensagem, campos: { [campo]: [mensagem] } }
}

/** O local tem de ser do cliente escolhido (e estar ativo, salvo se já era o do contrato). */
async function validarLocal(supabase: Supabase, dados: DadosContrato, localAtual?: string) {
  const { data: local, error } = await supabase
    .from("locais")
    .select("id, cliente_id, ativo")
    .eq("id", dados.local_id)
    .maybeSingle()
  if (error) return erroBD(error)
  if (!local || local.cliente_id !== dados.cliente_id) return erroCampo("local_id", "Escolha um local deste cliente.")
  if (!local.ativo && local.id !== localAtual) {
    return erroCampo("local_id", "Este local está desativado. Escolha outro.")
  }
  return null
}

/**
 * Só as colunas que a app pode gravar (as dos grants). O cliente vem do
 * local (trigger da BD); agendado_ate e cobrado_ate são da BD.
 */
function colunasContrato(dados: DadosContrato) {
  return {
    local_id: dados.local_id,
    titulo: dados.titulo,
    servicos: dados.servicos,
    frequencia: dados.frequencia,
    equipa_id: dados.equipa_id,
    hora_inicio: dados.hora_inicio,
    duracao_prevista_min: dados.duracao_prevista_min,
    data_inicio: dados.data_inicio,
    data_fim: dados.data_fim,
    valor_mensal: dados.valor_mensal,
    taxa_iva: dados.taxa_iva,
    dia_cobranca: dados.dia_cobranca,
    notas: dados.notas,
  }
}

/** Visitas do contrato de hoje em diante que ainda estão por fazer. */
async function contarVisitasFuturas(supabase: Supabase, contratoId: string): Promise<number | null> {
  const { count, error } = await supabase
    .from("trabalhos")
    .select("id", { count: "exact", head: true })
    .eq("contrato_id", contratoId)
    .gte("data", hojeEmLisboa())
    .in("estado", ["agendado", "em_curso"])
  if (error) console.error("Erro ao contar as visitas:", error.code, error.message)
  return error ? null : (count ?? 0)
}

function descreverVisitas(n: number) {
  return n === 1 ? "1 visita agendada" : `${n} visitas agendadas`
}

// ---------------------------------------------------------------------
// Criar e editar
// ---------------------------------------------------------------------

export async function criarContrato(valores: CamposContrato): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO

  // Um contrato novo começa sempre ativo (o estado só se muda ao editar).
  const dados = esquemaContrato.safeParse({ ...valores, estado: "ativo" })
  if (!dados.success) return erroValidacao(dados.error)

  const supabase = await createClient()
  const erroLocal = await validarLocal(supabase, dados.data)
  if (erroLocal) return erroLocal

  // A BD cria logo as visitas das próximas semanas e a cobrança do mês.
  const { data, error } = await supabase
    .from("contratos")
    // Sem cliente_id: não está nos grants (vem do local, por trigger).
    .insert({ ...colunasContrato(dados.data), estado: "ativo" } as TablesInsert<"contratos">)
    .select("id")
    .single()
  if (error) return erroBD(error, JA_NAO_EXISTE)

  const visitas = await contarVisitasFuturas(supabase, data.id)
  const { data: cobrancas } = await supabase.from("cobrancas").select("periodo, valor").eq("contrato_id", data.id)
  const cobranca = cobrancas?.length === 1 && cobrancas[0].periodo ? cobrancas[0] : null
  revalidarContratos()
  const partes = [
    visitas === null ? null : descreverVisitas(visitas),
    cobranca ? `cobrança de ${formatarMes(cobranca.periodo!)} (${formatarMoeda(cobranca.valor)}) criada` : null,
  ].filter(Boolean)
  return {
    ok: true,
    mensagem: partes.length ? `Contrato criado: ${partes.join(" e ")}.` : "Contrato criado.",
    redirecionar: `/financas/contratos/${data.id}`,
  }
}

export async function atualizarContrato(id: string, valores: CamposContrato): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO

  const contratoId = idObrigatorio.safeParse(id)
  if (!contratoId.success) return NAO_EXISTE
  const dados = esquemaContrato.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const supabase = await createClient()
  const { data: atual, error: erroLer } = await supabase
    .from("contratos")
    .select("id, local_id")
    .eq("id", contratoId.data)
    .maybeSingle()
  if (erroLer) return erroBD(erroLer)
  if (!atual) return NAO_EXISTE

  const erroLocal = await validarLocal(supabase, dados.data, atual.local_id)
  if (erroLocal) return erroLocal

  // Se mudarem as visitas (frequência, datas, equipa, hora…), a BD refaz as futuras ainda por começar.
  const { data: linhas, error } = await supabase
    .from("contratos")
    .update({ ...colunasContrato(dados.data), estado: dados.data.estado })
    .eq("id", contratoId.data)
    .select("id")
  if (error) return erroBD(error, JA_NAO_EXISTE)
  if (linhas.length === 0) return NAO_EXISTE

  revalidarContratos()
  return { ok: true, mensagem: "Contrato guardado.", redirecionar: `/financas/contratos/${contratoId.data}` }
}

// ---------------------------------------------------------------------
// Suspender, reativar, terminar e apagar
// ---------------------------------------------------------------------

const estadoValido = z.enum(ESTADOS_CONTRATO as [EstadoContrato, ...EstadoContrato[]])

export async function alterarEstadoContrato(id: string, estado: EstadoContrato): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO

  const contratoId = idObrigatorio.safeParse(id)
  const novo = estadoValido.safeParse(estado)
  if (!contratoId.success || !novo.success) return NAO_EXISTE

  const supabase = await createClient()
  const { data: linhas, error } = await supabase
    .from("contratos")
    .update({ estado: novo.data })
    .eq("id", contratoId.data)
    .select("id")
  if (error) return erroBD(error)
  if (linhas.length === 0) return NAO_EXISTE

  revalidarContratos()
  if (novo.data === "ativo") {
    const visitas = await contarVisitasFuturas(supabase, contratoId.data)
    return {
      ok: true,
      mensagem: visitas === null ? "Contrato reativado." : `Contrato reativado: ${descreverVisitas(visitas)}.`,
    }
  }
  return {
    ok: true,
    mensagem:
      novo.data === "suspenso"
        ? "Contrato suspenso. As visitas futuras saíram da agenda."
        : "Contrato terminado. As visitas futuras saíram da agenda.",
  }
}

/**
 * Apaga um contrato criado por engano, tudo ou nada, numa só transação na BD
 * (public.apagar_contrato): as visitas de hoje em diante ainda agendadas e
 * sem horas, registo nem fotos, as cobranças sem pagamentos nem fatura e o
 * contrato. Se houver visitas feitas, cobranças pagas ou faturadas, a BD
 * recusa com a mensagem para o terminar em vez de apagar.
 */
export async function apagarContrato(id: string): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO

  const contratoId = idObrigatorio.safeParse(id)
  if (!contratoId.success) return NAO_EXISTE

  const supabase = await createClient()
  const { data: apagado, error } = await supabase.rpc("apagar_contrato", { p_contrato_id: contratoId.data })
  if (error) return erroBD(error, { emUso: NAO_SE_APAGA })
  if (!apagado) return NAO_EXISTE

  revalidarContratos()
  return { ok: true, mensagem: "Contrato apagado.", redirecionar: "/financas/contratos" }
}

// ---------------------------------------------------------------------
// Gerar agora (o mesmo que a BD faz todos os dias de manhã)
// ---------------------------------------------------------------------

export async function gerarContratosAgora(): Promise<ResultadoAcao> {
  if (!(await sessaoGerente())) return SEM_PERMISSAO

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("gerar_contratos")
  if (error) return erroBD(error)

  const linha = (Array.isArray(data) ? data[0] : data) as { trabalhos?: number; cobrancas?: number } | null
  const trabalhos = Number(linha?.trabalhos ?? 0)
  const cobrancas = Number(linha?.cobrancas ?? 0)
  revalidarContratos()
  if (trabalhos === 0 && cobrancas === 0) return { ok: true, mensagem: "Já estava tudo em dia." }
  // "Criadas 8 visitas e 3 cobranças.", "Criada 1 cobrança." (sem as partes a zero).
  const partes = [
    trabalhos > 0 && (trabalhos === 1 ? "1 visita" : `${trabalhos} visitas`),
    cobrancas > 0 && (cobrancas === 1 ? "1 cobrança" : `${cobrancas} cobranças`),
  ].filter(Boolean)
  const verbo = trabalhos + cobrancas === 1 ? "Criada" : "Criadas"
  return { ok: true, mensagem: `${verbo} ${partes.join(" e ")}.` }
}
