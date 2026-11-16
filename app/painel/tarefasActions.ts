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
  REPETICOES_TAREFA,
  emFoco,
  primeiroDiaEm,
  proximaOcorrencia,
  repeteSe,
  type EstadoTarefa,
  type Tarefa,
} from '@/lib/data/tarefas'

// As Tarefas aparecem em três sítios (cada estúdio, Coordenação e
// Administração) com o mesmo ecrã — as ações são as mesmas e voltam
// para o sítio de onde foram chamadas.
const DATA = /^\d{4}-\d{2}-\d{2}$/
const DESTINO_VALIDO = /^\/painel\/(admin|coordenacao|[a-z0-9-]+)\/tarefas(\?|$)/

function texto(formData: FormData, nome: string): string | null {
  const v = formData.get(nome)
  if (typeof v !== 'string' || v.trim() === '') return null
  return v.trim()
}

function voltar(formData: FormData, extra: Record<string, string> = {}): never {
  const pedido = texto(formData, 'voltar') ?? ''
  const url = new URL(DESTINO_VALIDO.test(pedido) ? pedido : '/painel', 'http://x')
  for (const chave of ['ok', 'error', 'editar']) url.searchParams.delete(chave)
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v)
  // O número de tarefas em atraso aparece nos menus.
  revalidatePath('/painel', 'layout')
  redirect(`${url.pathname}${url.search}`)
}

// Qualquer conta com ficha mexe nas tarefas (a base de dados confirma, e
// esconde as reservadas a quem não é da administração).
async function exigirSessao(formData: FormData) {
  const sessao = await getSessaoAtual()
  if (!sessao.userId || !sessao.perfil) voltar(formData, { error: 'Sessão terminada — entra de novo.' })
  return { sessao, supabase: await createClient(), ...papeisDaSessao(sessao) }
}

// A repetição escolhida no formulário e o prazo que daí resulta: uma
// tarefa que se repete tem sempre prazo — sem ele, fica o primeiro dia
// que calhe (hoje incluído); e um prazo num dia em que a tarefa não se
// faz passa para o dia seguinte em que se faz.
function lerRepeticao(
  formData: FormData,
  prazo: string | null
): { repete_dias: number[] | null; repete_mensal: boolean; prazo: string | null } {
  const escolha = REPETICOES_TAREFA.find((r) => r.valor === texto(formData, 'repeticao'))
  const hoje = hojeEmLisboa()
  if (escolha?.valor === 'mensal') return { repete_dias: null, repete_mensal: true, prazo: prazo ?? hoje }
  const dias =
    escolha?.dias ??
    (escolha?.valor === 'dias'
      ? [...new Set(formData.getAll('dia').map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort()
      : [])
  if (dias.length === 0) return { repete_dias: null, repete_mensal: false, prazo }
  return { repete_dias: dias, repete_mensal: false, prazo: primeiroDiaEm(dias, prazo ?? hoje) }
}

function lerCampos(formData: FormData, ehAdmin: boolean) {
  const prazoTexto = texto(formData, 'prazo')
  const estudio = texto(formData, 'estudio_id')
  return {
    titulo: texto(formData, 'titulo'),
    descricao: texto(formData, 'descricao'),
    lista: texto(formData, 'lista'),
    estudio_id: estudio ? Number(estudio) : null,
    responsavel_id: texto(formData, 'responsavel_id'),
    ...lerRepeticao(formData, prazoTexto && DATA.test(prazoTexto) ? prazoTexto : null),
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
  const { error } = await supabase.from('tarefas').update(campos).eq('id', id)
  if (error) voltar(formData, { error: error.message, editar: id! })
  const estado = texto(formData, 'estado') as EstadoTarefa | null
  if (estado && ESTADOS_TAREFA.some((e) => e.valor === estado)) {
    const erro = await aplicarEstado(supabase, id!, estado, sessao.userId)
    if (erro) voltar(formData, { error: erro, editar: id! })
  }
  voltar(formData, { ok: 'guardada' })
}

type Cliente = Awaited<ReturnType<typeof createClient>>

// Muda o estado de uma tarefa. Ao concluir uma que se repete, cria
// primeiro a vez seguinte (com o próximo prazo) e só depois fecha esta —
// que deixa de ser "a que se repete": a série continua na nova. Assim,
// reabrir uma tarefa já concluída nunca dá duas séries iguais.
// Devolve a mensagem de erro, ou null se correu bem.
async function aplicarEstado(supabase: Cliente, id: string, estado: EstadoTarefa, userId: string | null): Promise<string | null> {
  const { data, error: erroLer } = await supabase.from('tarefas').select(COLUNAS_TAREFA).eq('id', id).maybeSingle()
  if (erroLer || !data) return erroLer?.message ?? 'Tarefa não encontrada.'
  const atual = data as Tarefa
  if (atual.estado === estado) return null

  if (estado === 'feito' && repeteSe(atual)) {
    const { error: erroSeguinte } = await supabase.from('tarefas').insert({
      titulo: atual.titulo,
      descricao: atual.descricao,
      lista: atual.lista,
      estudio_id: atual.estudio_id,
      responsavel_id: atual.responsavel_id,
      reservada: atual.reservada,
      repete_dias: atual.repete_dias,
      repete_mensal: atual.repete_mensal,
      prazo: proximaOcorrencia(atual, hojeEmLisboa()),
    })
    if (erroSeguinte) return erroSeguinte.message
  }
  const { error } = await supabase
    .from('tarefas')
    .update({ ...camposDoEstado(estado, userId), ...(estado === 'feito' ? { repete_dias: null, repete_mensal: false } : {}) })
    .eq('id', id)
  return error?.message ?? null
}

function camposDoEstado(estado: EstadoTarefa, userId: string | null) {
  return estado === 'feito'
    ? { estado, concluida_em: new Date().toISOString(), concluida_por: userId }
    : { estado, concluida_em: null, concluida_por: null }
}

// Concluir, pôr em curso ou voltar a abrir.
export async function mudarEstadoTarefa(formData: FormData) {
  const { supabase, sessao } = await exigirSessao(formData)
  const id = texto(formData, 'id')
  const estado = texto(formData, 'estado') as EstadoTarefa | null
  if (!id || !estado || !ESTADOS_TAREFA.some((e) => e.valor === estado)) voltar(formData)
  const erro = await aplicarEstado(supabase, id!, estado!, sessao.userId)
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
    let consulta = supabase.from('tarefas').select('id', { count: 'exact', head: true }).eq('foco_semana', semana).neq('estado', 'feito').neq('id', id)
    consulta = atual.responsavel_id ? consulta.eq('responsavel_id', atual.responsavel_id) : consulta.is('responsavel_id', null)
    const { count } = await consulta
    if ((count ?? 0) >= MAX_FOCO_POR_PESSOA) {
      voltar(formData, {
        error: `Já há ${MAX_FOCO_POR_PESSOA} tarefas em foco esta semana ${atual.responsavel_id ? 'para esta pessoa' : 'sem responsável'}. Tira uma do foco, ou conclui-a, antes de escolher outra.`,
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
