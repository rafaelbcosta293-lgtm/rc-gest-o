"use server"

import { revalidatePath } from "next/cache"
import type { AuthError } from "@supabase/supabase-js"

import { erroBD, erroValidacao, SEM_PERMISSAO, type ResultadoAcao } from "@/lib/acoes"
import { obterSessao, type Sessao } from "@/lib/auth"
import { eGerente } from "@/lib/perfis"
import { criarClienteAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { idObrigatorio } from "@/lib/validacao/comum"
import {
  esquemaAusencia,
  esquemaColaborador,
  esquemaCriarAcesso,
  esquemaEquipa,
  esquemaReporPalavraPasse,
  type CamposAusencia,
  type CamposColaborador,
  type CamposCriarAcesso,
  type CamposEquipa,
  type CamposReporPalavraPasse,
} from "@/lib/validacao/equipa"

const NAO_EXISTE: ResultadoAcao<never> = {
  ok: false,
  erro: "O registo não existe ou não tem permissão para o alterar.",
}
const SEM_CHAVE_ADMIN: ResultadoAcao<never> = {
  ok: false,
  erro: "Para criar acessos, configure SUPABASE_SECRET_KEY nas variáveis de ambiente.",
}
const EQUIPA_DUPLICADA = "Já existe uma equipa com este nome."

/** Só o gerente gere a equipa. Devolve a sessão ou null. */
async function sessaoGerente(): Promise<Sessao | null> {
  const sessao = await obterSessao()
  return sessao && eGerente(sessao.colaborador.perfil) ? sessao : null
}

/** Páginas que mostram colaboradores, equipas ou ausências. */
function revalidarEquipa(...outros: string[]) {
  revalidatePath("/")
  revalidatePath("/equipa")
  revalidatePath("/equipa/equipas")
  for (const caminho of outros) revalidatePath(caminho)
}

/** Traduz erros da API de contas (GoTrue) para mensagens em português. */
function erroConta(erro: AuthError | null): ResultadoAcao<never> {
  if (erro) console.error("Erro na gestão de contas:", erro.code, erro.status, erro.message)
  switch (erro?.code) {
    case "email_exists":
    case "user_already_exists":
      return {
        ok: false,
        erro: "Já existe uma conta com este email.",
        campos: { email: ["Já existe uma conta com este email."] },
      }
    case "weak_password":
      return {
        ok: false,
        erro: "Palavra-passe demasiado fraca. Use letras, números e símbolos.",
        campos: { palavraPasse: ["Palavra-passe demasiado fraca."] },
      }
    case "email_address_invalid":
      return { ok: false, erro: "Email inválido.", campos: { email: ["Email inválido."] } }
    case "user_not_found":
      return { ok: false, erro: "A conta de acesso já não existe." }
    case "bad_jwt":
    case "not_admin":
    case "no_authorization":
      return { ok: false, erro: "A chave SUPABASE_SECRET_KEY não é válida. Verifique a configuração." }
  }
  if (erro?.status === 429) {
    return { ok: false, erro: "Demasiados pedidos. Aguarde um pouco e tente de novo." }
  }
  return { ok: false, erro: "Não foi possível concluir a operação. Tente novamente." }
}

type ClienteAdmin = NonNullable<ReturnType<typeof criarClienteAdmin>>

/**
 * Apaga uma conta de acesso (auth.users). Se o apagar definitivo falhar do
 * lado da base de dados (500 "Database error deleting user"), desativa-a com
 * um "soft delete": deixa de conseguir entrar e o email fica livre.
 *
 * O apagar definitivo falha enquanto o trigger app.garantir_gerente_ativo não
 * for security definer: o "on delete set null" de colaboradores.user_id
 * dispara-o com o papel do serviço de autenticação, que não lê colaboradores.
 */
async function apagarConta(admin: ClienteAdmin, userId: string): Promise<AuthError | null> {
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (!error || error.code === "user_not_found") return null
  if (error.status !== 500) return error
  console.warn("Não foi possível apagar a conta; a desativar (soft delete):", userId, error.message)
  const { error: erroDesativar } = await admin.auth.admin.deleteUser(userId, true)
  return erroDesativar
}

// ---------------------------------------------------------------------
// Colaboradores
// ---------------------------------------------------------------------

export async function criarColaborador(valores: CamposColaborador): Promise<ResultadoAcao> {
  const sessao = await sessaoGerente()
  if (!sessao) return SEM_PERMISSAO

  const dados = esquemaColaborador.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)
  const { custoHora, equipaId, ...colaborador } = dados.data

  const supabase = await createClient()
  const { data: novo, error } = await supabase
    .from("colaboradores")
    .insert({ ...colaborador, equipa_id: equipaId })
    .select("id")
    .single()
  if (error) return erroBD(error)

  if (custoHora !== null) {
    const { error: erroCusto } = await supabase
      .from("colaboradores_custos")
      .upsert({ colaborador_id: novo.id, custo_hora: custoHora })
    if (erroCusto) {
      // Não deixar um colaborador criado a meio.
      await supabase.from("colaboradores").delete().eq("id", novo.id)
      return erroBD(erroCusto)
    }
  }

  revalidarEquipa()
  return { ok: true, mensagem: "Colaborador criado.", redirecionar: `/equipa/colaboradores/${novo.id}` }
}

export async function atualizarColaborador(
  id: string,
  valores: CamposColaborador
): Promise<ResultadoAcao> {
  const sessao = await sessaoGerente()
  if (!sessao) return SEM_PERMISSAO
  if (!idObrigatorio.safeParse(id).success) return NAO_EXISTE

  const dados = esquemaColaborador.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)
  const { custoHora, equipaId, ...colaborador } = dados.data

  if (id === sessao.colaborador.id) {
    if (colaborador.perfil !== "gerente") {
      const erro = "Não pode retirar o seu próprio perfil de gerente."
      return { ok: false, erro, campos: { perfil: [erro] } }
    }
    if (!colaborador.ativo) {
      const erro = "Não se pode desativar a si próprio."
      return { ok: false, erro, campos: { ativo: [erro] } }
    }
  }

  const supabase = await createClient()
  const { data: alterados, error } = await supabase
    .from("colaboradores")
    .update({ ...colaborador, equipa_id: equipaId })
    .eq("id", id)
    .select("id")
  if (error) return erroBD(error)
  if (!alterados.length) return NAO_EXISTE

  // Custo/hora vazio = sem custo definido.
  const { error: erroCusto } =
    custoHora === null
      ? await supabase.from("colaboradores_custos").delete().eq("colaborador_id", id)
      : await supabase.from("colaboradores_custos").upsert({ colaborador_id: id, custo_hora: custoHora })

  revalidarEquipa(`/equipa/colaboradores/${id}`)
  if (erroCusto) {
    console.error("Erro ao guardar o custo/hora:", erroCusto.code, erroCusto.message)
    return {
      ok: false,
      erro: "Os dados foram guardados, mas não foi possível guardar o custo/hora. Tente novamente.",
      campos: { custoHora: ["Não foi possível guardar o custo/hora."] },
    }
  }

  return { ok: true, mensagem: "Alterações guardadas.", redirecionar: `/equipa/colaboradores/${id}` }
}

// ---------------------------------------------------------------------
// Acesso à app
// ---------------------------------------------------------------------

/** Lê o colaborador com o cliente do gerente (passa pela RLS). */
async function lerColaboradorParaAcesso(colaboradorId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("colaboradores")
    .select("id, nome, email, user_id, ativo")
    .eq("id", colaboradorId)
    .maybeSingle()
  return { supabase, colaborador: data, error }
}

export async function criarAcesso(valores: CamposCriarAcesso): Promise<ResultadoAcao> {
  const sessao = await sessaoGerente()
  if (!sessao) return SEM_PERMISSAO

  const dados = esquemaCriarAcesso.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const { supabase, colaborador, error } = await lerColaboradorParaAcesso(dados.data.colaboradorId)
  if (error) return erroBD(error)
  if (!colaborador) return NAO_EXISTE
  if (colaborador.user_id) return { ok: false, erro: "Este colaborador já tem acesso à app." }
  if (!colaborador.ativo) {
    return { ok: false, erro: "O colaborador está inativo. Ative-o antes de lhe criar acesso." }
  }

  const admin = criarClienteAdmin()
  if (!admin) return SEM_CHAVE_ADMIN

  const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
    email: dados.data.email,
    password: dados.data.palavraPasse,
    email_confirm: true,
    user_metadata: { nome: colaborador.nome },
  })
  if (erroCriar || !criado.user) return erroConta(erroCriar)

  // Ligar a conta ao colaborador com o cliente do gerente (RLS).
  const { data: ligados, error: erroLigar } = await supabase
    .from("colaboradores")
    .update({ user_id: criado.user.id, ...(colaborador.email ? {} : { email: dados.data.email }) })
    .eq("id", colaborador.id)
    .is("user_id", null)
    .select("id")

  if (erroLigar || !ligados.length) {
    // Desfazer: não deixar contas soltas sem colaborador.
    const erroApagar = await apagarConta(admin, criado.user.id)
    if (erroApagar) console.error("Conta criada mas não ligada:", criado.user.id, erroApagar.message)
    return erroLigar
      ? erroBD(erroLigar)
      : { ok: false, erro: "Não foi possível ligar a conta ao colaborador. Tente novamente." }
  }

  revalidarEquipa(`/equipa/colaboradores/${colaborador.id}`)
  return { ok: true, mensagem: "Acesso criado." }
}

export async function reporPalavraPasse(valores: CamposReporPalavraPasse): Promise<ResultadoAcao> {
  const sessao = await sessaoGerente()
  if (!sessao) return SEM_PERMISSAO

  const dados = esquemaReporPalavraPasse.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)

  const { colaborador, error } = await lerColaboradorParaAcesso(dados.data.colaboradorId)
  if (error) return erroBD(error)
  if (!colaborador) return NAO_EXISTE
  if (!colaborador.user_id) return { ok: false, erro: "Este colaborador não tem acesso à app." }

  const admin = criarClienteAdmin()
  if (!admin) return SEM_CHAVE_ADMIN

  const { error: erroAlterar } = await admin.auth.admin.updateUserById(colaborador.user_id, {
    password: dados.data.palavraPasse,
  })
  if (erroAlterar) return erroConta(erroAlterar)

  return { ok: true, mensagem: "Palavra-passe reposta." }
}

export async function retirarAcesso(colaboradorId: string): Promise<ResultadoAcao> {
  const sessao = await sessaoGerente()
  if (!sessao) return SEM_PERMISSAO
  if (!idObrigatorio.safeParse(colaboradorId).success) return NAO_EXISTE
  if (colaboradorId === sessao.colaborador.id) {
    return { ok: false, erro: "Não pode retirar o seu próprio acesso." }
  }

  const { supabase, colaborador, error } = await lerColaboradorParaAcesso(colaboradorId)
  if (error) return erroBD(error)
  if (!colaborador) return NAO_EXISTE
  const userId = colaborador.user_id
  if (!userId) return { ok: false, erro: "Este colaborador não tem acesso à app." }

  const admin = criarClienteAdmin()
  if (!admin) return SEM_CHAVE_ADMIN

  // Desligar primeiro a conta do colaborador (cliente do gerente, RLS) e só
  // depois apagá-la, sem depender do "on delete set null".
  const { data: desligados, error: erroDesligar } = await supabase
    .from("colaboradores")
    .update({ user_id: null })
    .eq("id", colaborador.id)
    .eq("user_id", userId)
    .select("id")
  if (erroDesligar) return erroBD(erroDesligar)
  if (!desligados.length) return NAO_EXISTE

  const erroApagar = await apagarConta(admin, userId)
  if (erroApagar) {
    // Repor a ligação para não deixar uma conta ativa sem colaborador.
    await supabase
      .from("colaboradores")
      .update({ user_id: userId })
      .eq("id", colaborador.id)
      .is("user_id", null)
    return erroConta(erroApagar)
  }

  revalidarEquipa(`/equipa/colaboradores/${colaborador.id}`)
  return { ok: true, mensagem: "Acesso retirado." }
}

// ---------------------------------------------------------------------
// Ausências
// ---------------------------------------------------------------------

export async function marcarAusencia(valores: CamposAusencia): Promise<ResultadoAcao> {
  const sessao = await sessaoGerente()
  if (!sessao) return SEM_PERMISSAO

  const dados = esquemaAusencia.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)
  const { colaboradorId, tipo, dataInicio, dataFim, notas } = dados.data

  const supabase = await createClient()
  const { data: sobrepostas, error: erroLer } = await supabase
    .from("ausencias")
    .select("id")
    .eq("colaborador_id", colaboradorId)
    .lte("data_inicio", dataFim)
    .gte("data_fim", dataInicio)
    .limit(1)
  if (erroLer) return erroBD(erroLer)
  if (sobrepostas.length) {
    const erro = "Já existe uma ausência marcada neste período."
    return { ok: false, erro, campos: { dataInicio: [erro] } }
  }

  const { error } = await supabase.from("ausencias").insert({
    colaborador_id: colaboradorId,
    tipo,
    data_inicio: dataInicio,
    data_fim: dataFim,
    notas,
  })
  if (error) return erroBD(error, { emUso: "O colaborador não existe." })

  revalidarEquipa(`/equipa/colaboradores/${colaboradorId}`)
  return { ok: true, mensagem: "Ausência marcada." }
}

export async function apagarAusencia(id: string): Promise<ResultadoAcao> {
  const sessao = await sessaoGerente()
  if (!sessao) return SEM_PERMISSAO
  if (!idObrigatorio.safeParse(id).success) return NAO_EXISTE

  const supabase = await createClient()
  const { data: apagadas, error } = await supabase
    .from("ausencias")
    .delete()
    .eq("id", id)
    .select("id, colaborador_id")
  if (error) return erroBD(error)
  if (!apagadas.length) return NAO_EXISTE

  revalidarEquipa(`/equipa/colaboradores/${apagadas[0].colaborador_id}`)
  return { ok: true, mensagem: "Ausência apagada." }
}

// ---------------------------------------------------------------------
// Equipas
// ---------------------------------------------------------------------

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Validações que dependem da base de dados: nome repetido (sem distinguir
 * maiúsculas) e chefe ativo com perfil de chefe de equipa ou gerente.
 * O chefe atual mantém-se aceite mesmo que entretanto tenha mudado de perfil.
 */
async function validarEquipaNaBD(
  supabase: Supabase,
  dados: { nome: string; chefeId: string | null },
  equipa?: { id: string; chefeId: string | null }
): Promise<ResultadoAcao<never> | null> {
  const { data: equipas, error } = await supabase.from("equipas").select("id, nome")
  if (error) return erroBD(error)
  const nome = dados.nome.toLocaleLowerCase("pt")
  if (equipas.some((e) => e.id !== equipa?.id && e.nome.toLocaleLowerCase("pt") === nome)) {
    return { ok: false, erro: EQUIPA_DUPLICADA, campos: { nome: [EQUIPA_DUPLICADA] } }
  }

  if (dados.chefeId && dados.chefeId !== equipa?.chefeId) {
    const { data: chefe, error: erroChefe } = await supabase
      .from("colaboradores")
      .select("id")
      .eq("id", dados.chefeId)
      .eq("ativo", true)
      .in("perfil", ["chefe_equipa", "gerente"])
      .maybeSingle()
    if (erroChefe) return erroBD(erroChefe)
    if (!chefe) {
      const erro = "Escolha um colaborador ativo com perfil de chefe de equipa ou gerente."
      return { ok: false, erro, campos: { chefeId: [erro] } }
    }
  }
  return null
}

export async function criarEquipa(valores: CamposEquipa): Promise<ResultadoAcao> {
  const sessao = await sessaoGerente()
  if (!sessao) return SEM_PERMISSAO

  const dados = esquemaEquipa.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)
  const { nome, cor, chefeId, ativa, notas } = dados.data

  const supabase = await createClient()
  const invalido = await validarEquipaNaBD(supabase, { nome, chefeId })
  if (invalido) return invalido

  const { data: nova, error } = await supabase
    .from("equipas")
    .insert({ nome, cor, chefe_id: chefeId, ativa, notas })
    .select("id")
    .single()
  if (error) return erroBD(error, { duplicado: EQUIPA_DUPLICADA })

  revalidarEquipa()
  return { ok: true, mensagem: "Equipa criada.", redirecionar: `/equipa/equipas/${nova.id}` }
}

export async function atualizarEquipa(id: string, valores: CamposEquipa): Promise<ResultadoAcao> {
  const sessao = await sessaoGerente()
  if (!sessao) return SEM_PERMISSAO
  if (!idObrigatorio.safeParse(id).success) return NAO_EXISTE

  const dados = esquemaEquipa.safeParse(valores)
  if (!dados.success) return erroValidacao(dados.error)
  const { nome, cor, chefeId, ativa, notas } = dados.data

  const supabase = await createClient()
  const { data: atual, error: erroLer } = await supabase
    .from("equipas")
    .select("id, chefe_id")
    .eq("id", id)
    .maybeSingle()
  if (erroLer) return erroBD(erroLer)
  if (!atual) return NAO_EXISTE

  const invalido = await validarEquipaNaBD(supabase, { nome, chefeId }, { id, chefeId: atual.chefe_id })
  if (invalido) return invalido

  const { data: alteradas, error } = await supabase
    .from("equipas")
    .update({ nome, cor, chefe_id: chefeId, ativa, notas })
    .eq("id", id)
    .select("id")
  if (error) return erroBD(error, { duplicado: EQUIPA_DUPLICADA })
  if (!alteradas.length) return NAO_EXISTE

  revalidarEquipa(`/equipa/equipas/${id}`)
  return { ok: true, mensagem: "Alterações guardadas.", redirecionar: `/equipa/equipas/${id}` }
}

export async function apagarEquipa(id: string): Promise<ResultadoAcao> {
  const sessao = await sessaoGerente()
  if (!sessao) return SEM_PERMISSAO
  if (!idObrigatorio.safeParse(id).success) return NAO_EXISTE

  const supabase = await createClient()
  // Os membros ficam sem equipa (on delete set null).
  const { data: apagadas, error } = await supabase.from("equipas").delete().eq("id", id).select("id")
  if (error) return erroBD(error)
  if (!apagadas.length) return NAO_EXISTE

  revalidarEquipa()
  return { ok: true, mensagem: "Equipa apagada.", redirecionar: "/equipa/equipas" }
}
