'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSessaoAtual } from '@/lib/data/sessao'
import { getEquipaDoEstudio } from '@/lib/data/estudios'
import { treinosMarcadosDoCliente } from '@/lib/data/controloInstrutoresDados'
import { ehTipoTreino } from '@/lib/data/tiposTreino'

// As presenças contam só a partir dos eventos da Agenda (ver
// lib/data/agenda.ts e o cron de presenças) — planear ou registar um
// treino aqui nunca cria nem apaga presenças.

const hojeLisboa = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date())

// Quem está a planear: a própria pessoa, quando entrou com a conta dela
// e é instrutora deste estúdio. Numa conta partilhada (o tablet do
// estúdio) fica por escolher — escolhe-se no próprio plano.
async function autorPorOmissao(supabase: SupabaseClient, estudioId: number): Promise<string | null> {
  const sessao = await getSessaoAtual()
  if (!sessao.userId) return null
  const equipa = await getEquipaDoEstudio(supabase, estudioId)
  return equipa.some((p) => p.id === sessao.userId) ? sessao.userId : null
}

// Cria o plano (em branco) de um treino da Agenda — ou devolve o que já
// existe — e diz para onde ir. Sem treino (eventoId null), o plano fica
// com a data dada e "sem treino associado".
async function abrirOuCriarPlano(
  supabase: SupabaseClient,
  o: { estudioSlug: string; estudioId: number; clienteId: string; eventoId: string | null; data: string }
): Promise<{ href: string } | { error: string }> {
  const base = `/painel/${o.estudioSlug}/treinos/${o.clienteId}`
  let data = o.data
  if (o.eventoId) {
    const [{ data: evento }, { data: jaExiste }] = await Promise.all([
      supabase.from('agenda_eventos').select('id, cliente_id, data, tipo').eq('id', o.eventoId).maybeSingle(),
      supabase.from('sessoes').select('id').eq('agenda_evento_id', o.eventoId).maybeSingle(),
    ])
    if (jaExiste) return { href: `${base}/treino/${jaExiste.id}` }
    if (!evento || evento.cliente_id !== o.clienteId || evento.tipo !== 'Treino') return { error: 'Esse treino já não existe na Agenda.' }
    data = evento.data
  }

  const { data: sessao, error } = await supabase
    .from('sessoes')
    .insert({
      cliente_id: o.clienteId,
      estudio_id: o.estudioId,
      data,
      pt_id: await autorPorOmissao(supabase, o.estudioId),
      agenda_evento_id: o.eventoId,
      nota_proxima: '',
    })
    .select('id')
    .single()
  if (error || !sessao) {
    // Dois toques seguidos (ou duas pessoas ao mesmo tempo): o plano
    // deste treino já ficou criado pelo outro pedido.
    if (o.eventoId) {
      const { data: outro } = await supabase.from('sessoes').select('id').eq('agenda_evento_id', o.eventoId).maybeSingle()
      if (outro) return { href: `${base}/treino/${outro.id}` }
    }
    return { error: 'Não foi possível abrir o plano de treino.' }
  }

  revalidatePath(base)
  revalidatePath(`/painel/${o.estudioSlug}/agenda`)
  return { href: `${base}/treino/${sessao.id}` }
}

// "Planear este treino", num evento da Agenda: um toque abre o plano
// desse treino (cria-o se ainda não existir).
export async function planearTreinoDoEvento(input: {
  estudioSlug: string
  estudioId: number
  clienteId: string
  eventoId: string
}): Promise<{ href: string } | { error: string }> {
  const supabase = await createClient()
  return abrirOuCriarPlano(supabase, { ...input, data: hojeLisboa() })
}

// "Planear treino", na ficha do cliente: um toque abre um plano novo,
// já ligado ao próximo treino marcado que ainda não tem plano (de hoje
// em diante). Sem treinos marcados, fica com a data de hoje e "sem
// treino associado" — dentro do plano pode trocar-se de treino.
export async function iniciarTreino(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const clienteId = formData.get('cliente_id') as string
  const hoje = hojeLisboa()
  const supabase = await createClient()

  const treinos = await treinosMarcadosDoCliente(supabase, clienteId, hoje)
  const proximo = treinos.find((t) => !t.planoId && t.data >= hoje)
  const resultado = await abrirOuCriarPlano(supabase, { estudioSlug, estudioId, clienteId, eventoId: proximo?.id ?? null, data: hoje })
  if ('error' in resultado) {
    redirect(`/painel/${estudioSlug}/treinos/${clienteId}?error=${encodeURIComponent(resultado.error)}`)
  }
  redirect(resultado.href)
}

// Cabeçalho do plano (tipo de treino, quem o fez, foco e — só num plano
// sem treino associado — a data): guarda-se sozinho, campo a campo, sem
// botão de guardar.
export async function guardarCabecalhoPlano(input: {
  estudioSlug: string
  clienteId: string
  id: string
  campos: { tipo_treino?: string | null; pt_id?: string | null; foco?: string | null; data?: string }
}): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const campos: Record<string, string | null> = {}
  if ('tipo_treino' in input.campos) campos.tipo_treino = ehTipoTreino(input.campos.tipo_treino) ? input.campos.tipo_treino : null
  if ('pt_id' in input.campos) campos.pt_id = input.campos.pt_id || null
  if ('foco' in input.campos) campos.foco = input.campos.foco?.trim() || null
  if (input.campos.data && /^\d{4}-\d{2}-\d{2}$/.test(input.campos.data)) {
    // A data de um plano ligado a um treino é a do treino.
    const { data: atual } = await supabase.from('sessoes').select('agenda_evento_id').eq('id', input.id).maybeSingle()
    if (!atual?.agenda_evento_id) campos.data = input.campos.data
  }
  if (Object.keys(campos).length === 0) return { ok: true }

  const { error } = await supabase.from('sessoes').update(campos).eq('id', input.id).eq('cliente_id', input.clienteId)
  if (error) return { error: 'Não foi possível guardar.' }
  revalidatePath(`/painel/${input.estudioSlug}/treinos/${input.clienteId}`)
  return { ok: true }
}

export type LinhaCopiada = {
  id: string
  bloco: string
  exercicio_id: string | null
  exercicio_nome: string
  series: string | null
  reps: string | null
  carga: string | null
  descanso: string | null
  nota: string | null
}

// "Copiar plano anterior": o plano fica com os mesmos exercícios (bloco,
// séries, reps, carga, descanso e nota) do último plano deste cliente
// anterior a este. Substitui os exercícios que o plano já tivesse — a
// pergunta de confirmação é feita antes, no ecrã.
export async function copiarPlanoAnterior(input: {
  clienteId: string
  id: string
}): Promise<{ linhas: LinhaCopiada[]; tipoTreino: string | null; foco: string | null; data: string } | { error: string }> {
  const supabase = await createClient()
  const { data: atual } = await supabase
    .from('sessoes')
    .select('id, data, criado_em, correu, tipo_treino, foco')
    .eq('id', input.id)
    .eq('cliente_id', input.clienteId)
    .maybeSingle()
  if (!atual) return { error: 'Plano não encontrado.' }
  if (atual.correu) return { error: 'Este treino já está registado — o plano não se substitui.' }

  const { data: anteriores, error: erroAnteriores } = await supabase
    .from('sessoes')
    .select('id, data, criado_em, tipo_treino, foco, sessao_exercicios(ordem, bloco, exercicio_id, exercicio_nome, series, reps, carga, descanso, nota)')
    .eq('cliente_id', input.clienteId)
    .neq('id', input.id)
    .lte('data', atual.data)
    .order('data', { ascending: false })
    .order('criado_em', { ascending: false })
    .limit(15)
  if (erroAnteriores) return { error: 'Não foi possível ler o plano anterior.' }
  type Anterior = {
    id: string
    data: string
    tipo_treino: string | null
    foco: string | null
    sessao_exercicios: (Omit<LinhaCopiada, 'id'> & { ordem: number })[]
  }
  const anterior = ((anteriores ?? []) as unknown as Anterior[]).find((s) => (s.sessao_exercicios ?? []).length > 0)
  if (!anterior) return { error: 'Este cliente ainda não tem nenhum plano anterior com exercícios.' }

  const { error: erroApagar } = await supabase.from('sessao_exercicios').delete().eq('sessao_id', input.id)
  if (erroApagar) return { error: 'Não foi possível substituir os exercícios deste plano.' }

  const linhas = [...anterior.sessao_exercicios]
    .sort((a, b) => a.ordem - b.ordem)
    .map((l, ordem) => ({
      sessao_id: input.id,
      ordem,
      bloco: l.bloco,
      exercicio_id: l.exercicio_id,
      exercicio_nome: l.exercicio_nome,
      series: l.series,
      reps: l.reps,
      carga: l.carga,
      descanso: l.descanso,
      nota: l.nota,
    }))
  const { data: criadas, error: erroInserir } = await supabase
    .from('sessao_exercicios')
    .insert(linhas)
    .select('id, ordem, bloco, exercicio_id, exercicio_nome, series, reps, carga, descanso, nota')
  if (erroInserir || !criadas) return { error: 'Não foi possível copiar os exercícios do plano anterior.' }

  // O tipo de treino e o foco vêm também, se este plano ainda não os tiver.
  const tipoTreino = atual.tipo_treino ?? anterior.tipo_treino
  const foco = atual.foco ?? anterior.foco
  if (tipoTreino !== atual.tipo_treino || foco !== atual.foco) {
    await supabase.from('sessoes').update({ tipo_treino: tipoTreino, foco }).eq('id', input.id)
  }

  return {
    linhas: [...criadas].sort((a, b) => a.ordem - b.ordem).map(({ ordem, ...l }) => (void ordem, l as LinhaCopiada)),
    tipoTreino,
    foco,
    data: anterior.data,
  }
}

// Liga um plano a (outro) treino da Agenda do mesmo cliente — ou
// solta-o, com o campo vazio. A data do plano passa a ser a do treino.
export async function associarTreino(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const clienteId = formData.get('cliente_id') as string
  const id = formData.get('id') as string
  const eventoId = (formData.get('agenda_evento_id') as string) || null
  const destino = `/painel/${estudioSlug}/treinos/${clienteId}/treino/${id}`
  const voltar = (erro: string): never => redirect(`${destino}?error=${encodeURIComponent(erro)}`)

  const supabase = await createClient()
  let campos: { agenda_evento_id: string | null; data?: string } = { agenda_evento_id: null }
  if (eventoId) {
    const [{ data: evento }, { data: outro }] = await Promise.all([
      supabase.from('agenda_eventos').select('id, cliente_id, data, tipo').eq('id', eventoId).maybeSingle(),
      supabase.from('sessoes').select('id').eq('agenda_evento_id', eventoId).neq('id', id).maybeSingle(),
    ])
    if (!evento || evento.cliente_id !== clienteId || evento.tipo !== 'Treino') voltar('Esse treino já não existe na Agenda — escolhe outro.')
    if (outro) voltar('Esse treino já tem outro plano associado.')
    campos = { agenda_evento_id: eventoId, data: evento!.data }
  }

  const { error } = await supabase.from('sessoes').update(campos).eq('id', id).eq('cliente_id', clienteId)
  if (error) voltar('Não foi possível associar o plano a esse treino.')

  revalidatePath(`/painel/${estudioSlug}/treinos/${clienteId}`)
  revalidatePath(`/painel/${estudioSlug}/agenda`)
  redirect(`${destino}?ok=treino`)
}

// DEPOIS do treino: como correu, tipo de nota e nota para o próximo.
// Só a partir do dia do treino.
export async function registarTreino(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const clienteId = formData.get('cliente_id') as string
  const id = formData.get('id') as string
  const correu = (formData.get('correu') as string) || ''
  const voltar = (erro: string): never =>
    redirect(`/painel/${estudioSlug}/treinos/${clienteId}/treino/${id}?error=${encodeURIComponent(erro)}`)
  if (!correu) voltar('Escolhe como correu o treino.')

  const supabase = await createClient()
  const { data: atual } = await supabase.from('sessoes').select('data').eq('id', id).maybeSingle()
  if (!atual) voltar('Treino não encontrado.')
  if (atual!.data > hojeLisboa()) voltar('Este treino ainda não aconteceu — o registo de como correu fica disponível no dia do treino.')

  const { error } = await supabase
    .from('sessoes')
    .update({
      correu,
      tipo_nota: (formData.get('tipo_nota') as string) || 'Normal',
      nota_proxima: (formData.get('nota_proxima') as string) ?? '',
    })
    .eq('id', id)
  if (error) voltar('Não foi possível registar o treino.')

  revalidatePath(`/painel/${estudioSlug}/treinos/${clienteId}`)
  redirect(`/painel/${estudioSlug}/treinos/${clienteId}`)
}

type LinhaParaGravar = {
  id: string | null
  sessaoId: string
  ordem: number
  bloco: string
  exercicio_id: string | null
  exercicio_nome: string
  series: string
  reps: string
  carga: string
  descanso: string
  nota: string
}

type ResultadoLinha = { id: string } | { error: string }

// Chamado diretamente do formulário de treino (sem <form>/redirect), uma
// linha de cada vez, para o plano ficar sempre atualizado enquanto o PT
// vai avançando no treino em vez de tudo depender de um único "Guardar"
// no fim.
export async function guardarLinhaExercicio(linha: LinhaParaGravar): Promise<ResultadoLinha> {
  const supabase = await createClient()
  const valores = {
    sessao_id: linha.sessaoId,
    ordem: linha.ordem,
    bloco: linha.bloco,
    exercicio_id: linha.exercicio_id,
    exercicio_nome: linha.exercicio_nome,
    series: linha.series || null,
    reps: linha.reps || null,
    carga: linha.carga || null,
    descanso: linha.descanso || null,
    nota: linha.nota || null,
  }

  if (linha.id) {
    const { error } = await supabase.from('sessao_exercicios').update(valores).eq('id', linha.id)
    if (error) return { error: error.message }
    return { id: linha.id }
  }

  const { data, error } = await supabase
    .from('sessao_exercicios')
    .insert(valores)
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'Não foi possível guardar o exercício.' }
  return { id: data.id }
}

export async function apagarLinhaExercicio(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('sessao_exercicios').delete().eq('id', id)
  if (error) return { error: error.message }
  return { ok: true }
}

// Apaga o treino todo (não só uma linha de exercício) — restrito a
// gestão pela RLS (apagar_sessoes). Os exercícios da sessão vão atrás
// (FK em cascade); uma presença ligada a este treino fica sem o
// sessao_id em vez de ser apagada (o cliente esteve mesmo presente).
export async function apagarSessao(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const clienteId = formData.get('cliente_id') as string
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase.from('sessoes').delete().eq('id', id)

  if (error) {
    redirect(
      `/painel/${estudioSlug}/treinos/${clienteId}?error=${encodeURIComponent('Não foi possível eliminar o treino.')}`
    )
  }

  revalidatePath(`/painel/${estudioSlug}/treinos/${clienteId}`)
  revalidatePath(`/painel/${estudioSlug}/presencas/${clienteId}`)
  redirect(`/painel/${estudioSlug}/treinos/${clienteId}`)
}
