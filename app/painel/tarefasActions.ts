'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { hojeEmLisboa } from '@/lib/data/hoje'
import { inicioDaSemana } from '@/lib/data/horarios'
import {
  COLUNAS_TAREFA,
  ESTADOS_TAREFA,
  MAX_FOCO_POR_PESSOA,
  PRIORIDADES,
  REPETICOES_TAREFA,
  SEM_REPETICAO,
  emFoco,
  pessoasParaTarefas,
  primeiroDiaEm,
  proximaOcorrencia,
  repeteSe,
  type EstadoTarefa,
  type Repeticao,
  type Tarefa,
} from '@/lib/data/tarefas'

// As Tarefas aparecem em três sítios (cada estúdio, Coordenação e
// Administração) com o mesmo ecrã — as ações são as mesmas e voltam
// para o sítio de onde foram chamadas.
const DATA = /^\d{4}-\d{2}-\d{2}$/
const HORA = /^\d{2}:\d{2}$/
const DESTINO_VALIDO = /^\/painel\/(admin|coordenacao|[a-z0-9-]+)\/tarefas(\?|$)/

function texto(formData: FormData, nome: string): string | null {
  const v = formData.get(nome)
  if (typeof v !== 'string' || v.trim() === '') return null
  return v.trim()
}

function inteiro(formData: FormData, nome: string, minimo: number, maximo: number): number | null {
  const n = Number(texto(formData, nome))
  return Number.isInteger(n) && n >= minimo && n <= maximo ? n : null
}

function voltar(formData: FormData, extra: Record<string, string> = {}): never {
  const pedido = texto(formData, 'voltar') ?? ''
  const url = new URL(DESTINO_VALIDO.test(pedido) ? pedido : '/painel', 'http://x')
  for (const chave of ['ok', 'error']) url.searchParams.delete(chave)
  // Quem pede para ficar na tarefa aberta (subtarefas, comentários)
  // indica "manter"; de resto fecha-se a tarefa ao guardar.
  if (!formData.get('manter') && !extra.editar) url.searchParams.delete('editar')
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v)
  // O número de tarefas em atraso aparece nos menus.
  revalidatePath('/painel', 'layout')
  redirect(`${url.pathname}${url.search}${url.searchParams.get('editar') ? '#editar' : ''}`)
}

// Qualquer conta com ficha mexe nas tarefas (a base de dados confirma, e
// esconde as reservadas a quem não é da administração).
async function exigirSessao(formData: FormData) {
  const sessao = await getSessaoAtual()
  if (!sessao.userId || !sessao.perfil) voltar(formData, { error: 'Sessão terminada — entra de novo.' })
  return { sessao, supabase: await createClient(), ...papeisDaSessao(sessao) }
}

type Cliente = Awaited<ReturnType<typeof createClient>>

// A repetição escolhida no formulário e o prazo que daí resulta: uma
// tarefa que se repete tem sempre prazo — sem ele, fica o primeiro dia
// que calhe (hoje incluído); e um prazo num dia em que a tarefa não se
// faz passa para o dia seguinte em que se faz.
function lerRepeticao(formData: FormData, prazo: string | null): Repeticao & { prazo: string | null } {
  const escolha = REPETICOES_TAREFA.find((r) => r.valor === texto(formData, 'repeticao'))?.valor ?? 'nao'
  const hoje = hojeEmLisboa()
  const ate = texto(formData, 'repete_ate')
  const base = { ...SEM_REPETICAO, repete_ate: ate && DATA.test(ate) ? ate : null }
  const intervalo = inteiro(formData, 'repete_intervalo', 1, 52) ?? 1

  if (escolha === 'nao') return { ...SEM_REPETICAO, prazo }
  if (escolha === 'apos') {
    const dias = inteiro(formData, 'repete_apos_dias', 1, 365)
    return dias ? { ...base, repete_apos_dias: dias, prazo: prazo ?? hoje } : { ...SEM_REPETICAO, prazo }
  }
  if (escolha === 'anual') return { ...base, repete_anual: true, repete_intervalo: intervalo, prazo: prazo ?? hoje }
  if (escolha === 'mensal' || escolha === 'mensal-semana') {
    return { ...base, repete_mensal: true, repete_mensal_dia_semana: escolha === 'mensal-semana', repete_intervalo: intervalo, prazo: prazo ?? hoje }
  }
  const dias =
    REPETICOES_TAREFA.find((r) => r.valor === escolha)?.dias ??
    [...new Set(formData.getAll('dia').map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort()
  if (dias.length === 0) return { ...SEM_REPETICAO, prazo }
  return { ...base, repete_dias: dias, repete_intervalo: escolha === 'dias' ? intervalo : 1, prazo: primeiroDiaEm(dias, prazo ?? hoje) }
}

function lerCampos(formData: FormData, ehAdmin: boolean) {
  const prazoTexto = texto(formData, 'prazo')
  const estudio = texto(formData, 'estudio_id')
  const hora = texto(formData, 'hora')
  const inicio = texto(formData, 'inicio')
  const prioridade = texto(formData, 'prioridade')
  const repeticao = lerRepeticao(formData, prazoTexto && DATA.test(prazoTexto) ? prazoTexto : null)
  return {
    titulo: texto(formData, 'titulo'),
    descricao: texto(formData, 'descricao'),
    lista: texto(formData, 'lista'),
    estudio_id: estudio ? Number(estudio) : null,
    responsavel_id: texto(formData, 'responsavel_id'),
    ...repeticao,
    // A hora só faz sentido com prazo; o início não pode ser depois dele.
    hora: repeticao.prazo && hora && HORA.test(hora) ? hora : null,
    inicio: inicio && DATA.test(inicio) && (!repeticao.prazo || inicio <= repeticao.prazo) ? inicio : null,
    prioridade: PRIORIDADES.some((p) => p.valor === prioridade) ? prioridade : null,
    etiquetas: [
      ...new Set(
        (texto(formData, 'etiquetas') ?? '')
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean)
      ),
    ].slice(0, 10),
    // Só a administração pode reservar uma tarefa (ou tirar-lhe a reserva).
    ...(ehAdmin ? { reservada: formData.get('reservada') === '1' } : {}),
  }
}

export async function criarTarefa(formData: FormData) {
  const { supabase, ehAdmin } = await exigirSessao(formData)
  const campos = lerCampos(formData, ehAdmin)
  if (!campos.titulo) voltar(formData, { error: 'Escreve o que é para fazer.' })
  const { error } = await supabase.from('tarefas').insert(campos)
  if (error) voltar(formData, { error: error.message })
  voltar(formData, { ok: 'criada' })
}

export async function atualizarTarefa(formData: FormData) {
  const { supabase, sessao, ehAdmin } = await exigirSessao(formData)
  const id = texto(formData, 'id')
  const campos = lerCampos(formData, ehAdmin)
  if (!id) voltar(formData)
  if (!campos.titulo) voltar(formData, { error: 'O título não pode ficar em branco.', editar: id! })
  const estado = texto(formData, 'estado') as EstadoTarefa | null
  const mudaEstado = !!estado && ESTADOS_TAREFA.some((e) => e.valor === estado)
  // Confirma-se quem fez ANTES de gravar o resto: não se guarda meia alteração.
  const feitaPor = mudaEstado && estado === 'feito' ? await lerQuemFez(formData, { editar: id! }) : null

  const { error } = await supabase.from('tarefas').update(campos).eq('id', id)
  if (error) voltar(formData, { error: error.message, editar: id! })
  if (mudaEstado) {
    const erro = await aplicarEstado(supabase, id!, estado!, sessao.userId, feitaPor)
    if (erro) voltar(formData, { error: erro, editar: id! })
  }
  voltar(formData, { ok: 'guardada' })
}

// Quem executou a tarefa — obrigatório para a concluir. As contas dos
// estúdios são partilhadas, por isso é este nome (e não a conta) que
// diz quem fez o quê.
async function lerQuemFez(formData: FormData, extra: Record<string, string> = {}): Promise<string> {
  const id = texto(formData, 'feita_por')
  const pessoas = await pessoasParaTarefas()
  if (!id || !pessoas.some((p) => p.id === id)) voltar(formData, { ...extra, error: 'Indica quem fez a tarefa antes de a concluir.' })
  return id!
}

function camposDoEstado(estado: EstadoTarefa, userId: string | null, feitaPor: string | null) {
  return estado === 'feito'
    ? { estado, concluida_em: new Date().toISOString(), concluida_por: userId, feita_por: feitaPor }
    : { estado, concluida_em: null, concluida_por: null, feita_por: null }
}

// Muda o estado de uma tarefa. Ao concluir uma que se repete, cria
// primeiro a vez seguinte (com o próximo prazo e as mesmas subtarefas,
// por fazer) e só depois fecha esta — que deixa de ser "a que se
// repete": a série continua na nova. Assim, reabrir uma tarefa já
// concluída nunca dá duas séries iguais.
// Devolve a mensagem de erro, ou null se correu bem.
async function aplicarEstado(supabase: Cliente, id: string, estado: EstadoTarefa, userId: string | null, feitaPor: string | null): Promise<string | null> {
  const { data, error: erroLer } = await supabase.from('tarefas').select(COLUNAS_TAREFA).eq('id', id).maybeSingle()
  if (erroLer || !data) return erroLer?.message ?? 'Tarefa não encontrada.'
  const atual = data as Tarefa
  if (atual.estado === estado) {
    // Já estava feita: só se corrige o nome de quem fez.
    if (estado === 'feito' && feitaPor && atual.feita_por !== feitaPor) {
      const { error } = await supabase.from('tarefas').update({ feita_por: feitaPor }).eq('id', id)
      return error?.message ?? null
    }
    return null
  }

  if (estado === 'feito' && repeteSe(atual)) {
    const hoje = hojeEmLisboa()
    const prazo = proximaOcorrencia(atual, hoje)
    // null: a repetição chegou ao fim (data "até") — não nasce mais nenhuma.
    if (prazo) {
      const duracao = atual.inicio && atual.prazo ? Date.parse(atual.prazo) - Date.parse(atual.inicio) : null
      const { data: nova, error: erroSeguinte } = await supabase
        .from('tarefas')
        .insert({
          titulo: atual.titulo,
          descricao: atual.descricao,
          lista: atual.lista,
          estudio_id: atual.estudio_id,
          responsavel_id: atual.responsavel_id,
          reservada: atual.reservada,
          hora: atual.hora,
          inicio: duracao !== null ? new Date(Date.parse(prazo) - duracao).toISOString().slice(0, 10) : null,
          prioridade: atual.prioridade,
          etiquetas: atual.etiquetas,
          repete_dias: atual.repete_dias,
          repete_mensal: atual.repete_mensal,
          repete_mensal_dia_semana: atual.repete_mensal_dia_semana,
          repete_anual: atual.repete_anual,
          repete_apos_dias: atual.repete_apos_dias,
          repete_intervalo: atual.repete_intervalo,
          repete_ate: atual.repete_ate,
          prazo,
        })
        .select('id')
        .single()
      if (erroSeguinte) return erroSeguinte.message
      const { data: subtarefas } = await supabase.from('tarefas').select('titulo, responsavel_id').eq('tarefa_mae_id', id).order('criado_em')
      if (subtarefas && subtarefas.length > 0) {
        await supabase.from('tarefas').insert(
          subtarefas.map((s) => ({
            titulo: s.titulo,
            responsavel_id: s.responsavel_id,
            tarefa_mae_id: nova.id,
            estudio_id: atual.estudio_id,
            reservada: atual.reservada,
          }))
        )
      }
    }
  }
  const { error } = await supabase
    .from('tarefas')
    .update({ ...camposDoEstado(estado, userId, feitaPor), ...(estado === 'feito' ? SEM_REPETICAO : {}) })
    .eq('id', id)
  return error?.message ?? null
}

// Concluir (com quem fez), pôr em curso ou voltar a abrir.
export async function mudarEstadoTarefa(formData: FormData) {
  const { supabase, sessao } = await exigirSessao(formData)
  const id = texto(formData, 'id')
  const estado = texto(formData, 'estado') as EstadoTarefa | null
  if (!id || !estado || !ESTADOS_TAREFA.some((e) => e.valor === estado)) voltar(formData)
  const feitaPor = estado === 'feito' ? await lerQuemFez(formData) : null
  const erro = await aplicarEstado(supabase, id!, estado!, sessao.userId, feitaPor)
  if (erro) voltar(formData, { error: erro })
  voltar(formData, { ok: estado === 'feito' ? 'concluida' : estado === 'em_curso' ? 'em-curso' : 'reaberta' })
}

// Pôr ou tirar do foco desta semana. Cada responsável tem no máximo
// MAX_FOCO_POR_PESSOA em foco — o foco serve para escolher.
export async function alternarFocoTarefa(formData: FormData) {
  const { supabase } = await exigirSessao(formData)
  const id = texto(formData, 'id')
  if (!id) voltar(formData)
  const hoje = hojeEmLisboa()
  const semana = inicioDaSemana(hoje)
  const { data: tarefa, error: erroLer } = await supabase.from('tarefas').select(COLUNAS_TAREFA).eq('id', id).maybeSingle()
  if (erroLer || !tarefa) voltar(formData, { error: erroLer?.message ?? 'Tarefa não encontrada.' })
  const atual = tarefa as Tarefa

  if (!emFoco(atual, hoje)) {
    // O limite conta-se dentro do mesmo estúdio e para a mesma pessoa
    // (ou, sem responsável, para o conjunto das tarefas sem dono).
    let consulta = supabase
      .from('tarefas')
      .select('id', { count: 'exact', head: true })
      .eq('foco_semana', semana)
      .neq('estado', 'feito')
      .neq('id', id)
      .is('tarefa_mae_id', null)
    consulta = atual.responsavel_id ? consulta.eq('responsavel_id', atual.responsavel_id) : consulta.is('responsavel_id', null)
    consulta = atual.estudio_id != null ? consulta.eq('estudio_id', atual.estudio_id) : consulta.is('estudio_id', null)
    const { count } = await consulta
    if ((count ?? 0) >= MAX_FOCO_POR_PESSOA) {
      voltar(formData, {
        error: `Já há ${MAX_FOCO_POR_PESSOA} tarefas em foco esta semana. Tira uma do foco, ou conclui-a, antes de escolher outra.`,
      })
    }
  }
  const { error } = await supabase
    .from('tarefas')
    .update({ foco_semana: emFoco(atual, hoje) ? null : semana })
    .eq('id', id)
  if (error) voltar(formData, { error: error.message })
  voltar(formData, { ok: emFoco(atual, hoje) ? 'sem-foco' : 'foco' })
}

export async function eliminarTarefa(formData: FormData) {
  const { supabase, ehGestao } = await exigirSessao(formData)
  if (!ehGestao) voltar(formData, { error: 'Só a gestão pode eliminar tarefas — conclui-a em vez disso.' })
  const id = texto(formData, 'id')
  if (!id) voltar(formData)
  const { data, error } = await supabase.from('tarefas').delete().eq('id', id).select('id')
  if (error) voltar(formData, { error: error.message })
  if (!data || data.length === 0) voltar(formData, { error: 'Não foi possível eliminar essa tarefa.' })
  voltar(formData, { ok: 'eliminada' })
}

// ── Subtarefas ───────────────────────────────────────────────────────
// Passos de uma tarefa: só título (e estado). Ficam na tarefa aberta.

export async function criarSubtarefa(formData: FormData) {
  const { supabase } = await exigirSessao(formData)
  const mae = texto(formData, 'tarefa_mae_id')
  const titulo = texto(formData, 'titulo')
  if (!mae) voltar(formData)
  if (!titulo) voltar(formData, { error: 'Escreve o passo a acrescentar.', editar: mae! })
  const { data: tarefaMae } = await supabase.from('tarefas').select('estudio_id, reservada').eq('id', mae).maybeSingle()
  if (!tarefaMae) voltar(formData, { error: 'Tarefa não encontrada.' })
  const { error } = await supabase.from('tarefas').insert({ titulo, tarefa_mae_id: mae, estudio_id: tarefaMae!.estudio_id, reservada: tarefaMae!.reservada })
  if (error) voltar(formData, { error: error.message, editar: mae! })
  voltar(formData, { editar: mae! })
}

// Marcar/desmarcar um passo. (Os passos não pedem "quem fez" — isso
// fica para a tarefa.)
export async function alternarSubtarefa(formData: FormData) {
  const { supabase, sessao } = await exigirSessao(formData)
  const id = texto(formData, 'id')
  const mae = texto(formData, 'tarefa_mae_id')
  if (!id || !mae) voltar(formData)
  const feita = formData.get('feita') === '1'
  const { error } = await supabase
    .from('tarefas')
    .update(
      feita ? { estado: 'feito', concluida_em: new Date().toISOString(), concluida_por: sessao.userId } : { estado: 'por_fazer', concluida_em: null, concluida_por: null }
    )
    .eq('id', id)
    .eq('tarefa_mae_id', mae)
  if (error) voltar(formData, { error: error.message, editar: mae! })
  voltar(formData, { editar: mae! })
}

export async function eliminarSubtarefa(formData: FormData) {
  const { supabase } = await exigirSessao(formData)
  const id = texto(formData, 'id')
  const mae = texto(formData, 'tarefa_mae_id')
  if (!id || !mae) voltar(formData)
  const { error } = await supabase.from('tarefas').delete().eq('id', id).eq('tarefa_mae_id', mae)
  if (error) voltar(formData, { error: error.message, editar: mae! })
  voltar(formData, { editar: mae! })
}

// ── Comentários ──────────────────────────────────────────────────────

export async function comentarTarefa(formData: FormData) {
  const { supabase } = await exigirSessao(formData)
  const tarefaId = texto(formData, 'tarefa_id')
  const comentario = texto(formData, 'texto')
  if (!tarefaId) voltar(formData)
  if (!comentario) voltar(formData, { error: 'Escreve o comentário.', editar: tarefaId! })
  // Quem escreve: o nome escolhido (numa conta partilhada) da lista da equipa.
  const autorId = texto(formData, 'autor')
  const autor = autorId ? (await pessoasParaTarefas()).find((p) => p.id === autorId) : undefined
  const { error } = await supabase.from('tarefas_comentarios').insert({ tarefa_id: tarefaId, texto: comentario, autor_nome: autor?.nome ?? null })
  if (error) voltar(formData, { error: error.message, editar: tarefaId! })
  voltar(formData, { editar: tarefaId! })
}

export async function apagarComentario(formData: FormData) {
  const { supabase } = await exigirSessao(formData)
  const id = texto(formData, 'id')
  const tarefaId = texto(formData, 'tarefa_id')
  if (!id || !tarefaId) voltar(formData)
  const { error } = await supabase.from('tarefas_comentarios').delete().eq('id', id)
  if (error) voltar(formData, { error: error.message, editar: tarefaId! })
  voltar(formData, { editar: tarefaId! })
}
