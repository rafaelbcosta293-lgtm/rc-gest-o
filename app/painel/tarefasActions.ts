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
  carregarDetalheTarefa,
  emFoco,
  pessoasParaTarefas,
  primeiroDiaEm,
  proximaOcorrencia,
  repeteSe,
  type ComentarioTarefa,
  type EstadoTarefa,
  type Repeticao,
  type Tarefa,
} from '@/lib/data/tarefas'

// As Tarefas aparecem em cada estúdio e na Coordenação com o mesmo
// ecrã — as ações são as mesmas e voltam para o sítio de onde foram
// chamadas.
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

// Quem executou a tarefa — obrigatório para a concluir. As contas dos
// estúdios são partilhadas, por isso é este nome (e não a conta) que
// diz quem fez o quê.
const FALTA_QUEM_FEZ = 'Indica quem fez a tarefa antes de a concluir.'

// O nome escolhido em "quem fez", se for mesmo alguém da equipa.
async function quemFez(formData: FormData): Promise<string | null> {
  const id = texto(formData, 'feita_por')
  return id && (await pessoasParaTarefas()).some((p) => p.id === id) ? id : null
}

async function lerQuemFez(formData: FormData, extra: Record<string, string> = {}): Promise<string> {
  const id = await quemFez(formData)
  if (!id) voltar(formData, { ...extra, error: FALTA_QUEM_FEZ })
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

// ── Janela de edição ─────────────────────────────────────────────────
// As mesmas operações, mas para a janela que abre por cima da página
// (botão direito numa tarefa): em vez de mudarem de página, devolvem o
// resultado — a janela mostra o erro ou fecha-se, e a lista por baixo
// atualiza-se sem sair do sítio.

const SESSAO_TERMINADA = 'Sessão terminada — entra de novo.'
const UUID = /^[0-9a-f-]{36}$/i

async function sessaoDaJanela() {
  const sessao = await getSessaoAtual()
  if (!sessao.userId || !sessao.perfil) return null
  return { sessao, supabase: await createClient(), ...papeisDaSessao(sessao) }
}

// Cria (sem "id") ou guarda uma tarefa.
export async function guardarTarefaNaJanela(formData: FormData): Promise<{ erro: string | null }> {
  const s = await sessaoDaJanela()
  if (!s) return { erro: SESSAO_TERMINADA }
  const id = texto(formData, 'id')
  const campos = lerCampos(formData, s.ehAdmin)
  if (!campos.titulo) return { erro: 'Escreve o que é para fazer.' }

  if (!id) {
    const { error } = await s.supabase.from('tarefas').insert(campos)
    if (error) return { erro: error.message }
  } else {
    const estado = texto(formData, 'estado') as EstadoTarefa | null
    const mudaEstado = !!estado && ESTADOS_TAREFA.some((e) => e.valor === estado)
    // Confirma-se quem fez ANTES de gravar o resto: não se guarda meia alteração.
    const feitaPor = mudaEstado && estado === 'feito' ? await quemFez(formData) : null
    if (mudaEstado && estado === 'feito' && !feitaPor) return { erro: FALTA_QUEM_FEZ }
    const { error } = await s.supabase.from('tarefas').update(campos).eq('id', id)
    if (error) return { erro: error.message }
    if (mudaEstado) {
      const erro = await aplicarEstado(s.supabase, id, estado!, s.sessao.userId, feitaPor)
      if (erro) return { erro }
    }
  }
  revalidatePath('/painel', 'layout')
  return { erro: null }
}

export async function eliminarTarefaNaJanela(id: string): Promise<{ erro: string | null }> {
  const s = await sessaoDaJanela()
  if (!s) return { erro: SESSAO_TERMINADA }
  if (!s.ehGestao) return { erro: 'Só a gestão pode eliminar tarefas — conclui-a em vez disso.' }
  if (!UUID.test(id)) return { erro: 'Tarefa não encontrada.' }
  const { data, error } = await s.supabase.from('tarefas').delete().eq('id', id).select('id')
  if (error) return { erro: error.message }
  if (!data || data.length === 0) return { erro: 'Não foi possível eliminar essa tarefa.' }
  revalidatePath('/painel', 'layout')
  return { erro: null }
}

export type PassoNaJanela = { id: string; titulo: string; feito: boolean }
export type DetalheNaJanela = {
  erro: string | null
  passos: PassoNaJanela[]
  comentarios: (ComentarioTarefa & { podeApagar: boolean })[]
}
export type OperacaoNoDetalhe =
  | { tipo: 'ler' }
  | { tipo: 'juntar-passo'; titulo: string }
  | { tipo: 'alternar-passo'; passoId: string; feito: boolean }
  | { tipo: 'remover-passo'; passoId: string }
  | { tipo: 'comentar'; texto: string; autorId: string | null }
  | { tipo: 'apagar-comentario'; comentarioId: string }

// Os passos e os comentários de uma tarefa: faz a operação pedida (ou
// nenhuma, com "ler") e devolve como ficaram.
export async function detalheDaTarefa(tarefaId: string, op: OperacaoNoDetalhe): Promise<DetalheNaJanela> {
  const vazio = { passos: [], comentarios: [] }
  const s = await sessaoDaJanela()
  if (!s) return { erro: SESSAO_TERMINADA, ...vazio }
  if (!UUID.test(tarefaId)) return { erro: 'Tarefa não encontrada.', ...vazio }
  const { supabase, sessao } = s
  let erro: string | null = null

  if (op.tipo === 'juntar-passo') {
    const titulo = String(op.titulo ?? '').trim()
    if (!titulo) erro = 'Escreve o passo a acrescentar.'
    else {
      const { data: mae } = await supabase.from('tarefas').select('estudio_id, reservada').eq('id', tarefaId).maybeSingle()
      if (!mae) erro = 'Tarefa não encontrada.'
      else {
        const { error } = await supabase.from('tarefas').insert({ titulo, tarefa_mae_id: tarefaId, estudio_id: mae.estudio_id, reservada: mae.reservada })
        erro = error?.message ?? null
      }
    }
  } else if (op.tipo === 'alternar-passo' && UUID.test(op.passoId)) {
    const { error } = await supabase
      .from('tarefas')
      .update(
        op.feito
          ? { estado: 'feito', concluida_em: new Date().toISOString(), concluida_por: sessao.userId }
          : { estado: 'por_fazer', concluida_em: null, concluida_por: null }
      )
      .eq('id', op.passoId)
      .eq('tarefa_mae_id', tarefaId)
    erro = error?.message ?? null
  } else if (op.tipo === 'remover-passo' && UUID.test(op.passoId)) {
    const { error } = await supabase.from('tarefas').delete().eq('id', op.passoId).eq('tarefa_mae_id', tarefaId)
    erro = error?.message ?? null
  } else if (op.tipo === 'comentar') {
    const comentario = String(op.texto ?? '').trim()
    if (!comentario) erro = 'Escreve o comentário.'
    else {
      const autor = op.autorId ? (await pessoasParaTarefas()).find((p) => p.id === op.autorId) : undefined
      const { error } = await supabase.from('tarefas_comentarios').insert({ tarefa_id: tarefaId, texto: comentario, autor_nome: autor?.nome ?? null })
      erro = error?.message ?? null
    }
  } else if (op.tipo === 'apagar-comentario' && UUID.test(op.comentarioId)) {
    const { error } = await supabase.from('tarefas_comentarios').delete().eq('id', op.comentarioId).eq('tarefa_id', tarefaId)
    erro = error?.message ?? null
  }

  const detalhe = await carregarDetalheTarefa(supabase, tarefaId)
  return {
    erro,
    passos: detalhe.passos.map((p) => ({ id: p.id, titulo: p.titulo, feito: p.estado === 'feito' })),
    comentarios: detalhe.comentarios.map((c) => ({ ...c, podeApagar: s.ehGestao || c.autor_id === sessao.userId })),
  }
}
