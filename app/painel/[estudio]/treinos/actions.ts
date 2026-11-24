'use server'

import { hojeEmLisboa } from '@/lib/data/hoje'
import { SERVICO_PT, carregarServicos } from '@/lib/data/servicos'
import { aplicarInscricoes, carregarInscricoes, servicosDoFormulario, servicosLigados } from '@/lib/data/clientesServicos'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { normalizarNif, nifValido } from '@/lib/data/faturas'
import { getEquipaDoEstudio, getEstudioPorSlug } from '@/lib/data/estudios'
import { semSair, type ResultadoSemSair } from '@/lib/acoes/semSair'
import type { Cliente, Perfil } from '@/lib/supabase/database.types'

function campoOuNull(formData: FormData, nome: string) {
  const v = formData.get(nome)
  if (typeof v !== 'string' || v.trim() === '') return null
  return v.trim()
}

function camposComuns(formData: FormData) {
  return {
    nome: formData.get('nome') as string,
    nome_preferido: campoOuNull(formData, 'nome_preferido'),
    telefone: campoOuNull(formData, 'telefone'),
    email: campoOuNull(formData, 'email'),
    nif: normalizarNif(campoOuNull(formData, 'nif')),
    morada: campoOuNull(formData, 'morada'),
    morada_numero: campoOuNull(formData, 'morada_numero'),
    codigo_postal: campoOuNull(formData, 'codigo_postal'),
    cidade: campoOuNull(formData, 'cidade'),
    pais: campoOuNull(formData, 'pais'),
    nacionalidade: campoOuNull(formData, 'nacionalidade'),
    cartao_cidadao: campoOuNull(formData, 'cartao_cidadao'),
    profissao: campoOuNull(formData, 'profissao'),
    objetivo: campoOuNull(formData, 'objetivo'),
    frequencia_semanal: formData.get('frequencia_semanal')
      ? Number(formData.get('frequencia_semanal'))
      : null,
    pt_principal_id: campoOuNull(formData, 'pt_principal_id'),
    alerta: (formData.get('alerta') as string) || 'Nenhum',
    alerta_detalhe: campoOuNull(formData, 'alerta_detalhe'),
    evento: campoOuNull(formData, 'evento'),
    evento_data: campoOuNull(formData, 'evento_data'),
    nascimento: campoOuNull(formData, 'nascimento'),
    genero: campoOuNull(formData, 'genero'),
    notas: campoOuNull(formData, 'notas'),
  }
}

export async function criarCliente(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const nif = normalizarNif(campoOuNull(formData, 'nif'))
  if (nif && !nifValido(nif)) {
    redirect(
      `/painel/${estudioSlug}/treinos/novo?error=${encodeURIComponent(`O NIF ${nif} não é válido.`)}`
    )
  }
  const supabase = await createClient()

  // Serviços escolhidos: sem o Treino Personalizado, o cliente não é de
  // PT (não entra nas métricas de PT) e fica Pendente até pagar.
  const servicos = servicosDoFormulario(formData)
  const ePt = servicos === null || servicos.includes(SERVICO_PT)
  const { data, error } = await supabase
    .from('clientes')
    .insert({ ...camposComuns(formData), estudio_id: estudioId, cliente_pt: ePt, ...(ePt ? {} : { estado: 'Pendente' }) })
    .select('id')
    .single()
  if (data && servicos) await aplicarInscricoes(supabase, data.id, servicos, hojeEmLisboa())

  if (error || !data) {
    redirect(
      `/painel/${estudioSlug}/treinos/novo?error=${encodeURIComponent('Não foi possível criar o cliente.')}`
    )
  }

  revalidatePath(`/painel/${estudioSlug}/treinos`)
  redirect(`/painel/${estudioSlug}/treinos/${data.id}`)
}

const MODULOS_ORIGEM = ['clientes', 'treinos']

export async function atualizarCliente(formData: FormData) {
  const id = formData.get('id') as string
  const estudioSlug = formData.get('estudio_slug') as string
  const voltarParam = formData.get('voltar') as string
  const voltar = MODULOS_ORIGEM.includes(voltarParam) ? voltarParam : 'treinos'
  const nif = normalizarNif(campoOuNull(formData, 'nif'))
  if (nif && !nifValido(nif)) {
    redirect(
      `/painel/${estudioSlug}/treinos/${id}/editar?voltar=${voltar}&error=${encodeURIComponent(`O NIF ${nif} não é válido.`)}`
    )
  }
  const supabase = await createClient()
  const novoEstado = (formData.get('estado') as string) || 'Ativo'

  const { data: atual, error: erroAtual } = await supabase
    .from('clientes')
    .select('estado')
    .eq('id', id)
    .single()
  if (erroAtual) {
    redirect(
      `/painel/${estudioSlug}/treinos/${id}/editar?voltar=${voltar}&error=${encodeURIComponent('Não foi possível guardar as alterações.')}`
    )
  }

  // Idem: só conta como alteração manual do estado (que o tira da
  // transição automática por falta de pagamento) quando o valor muda.
  const mudouEstado = atual?.estado !== novoEstado

  const servicos = servicosDoFormulario(formData)
  const { error } = await supabase
    .from('clientes')
    .update({
      ...camposComuns(formData),
      estado: novoEstado,
      ...(mudouEstado ? { estado_automatico: false } : {}),
      ...(servicos ? { cliente_pt: servicos.includes(SERVICO_PT) } : {}),
    })
    .eq('id', id)
  if (!error && servicos) {
    const erroServicos = await aplicarInscricoes(supabase, id, servicos, hojeEmLisboa())
    if (erroServicos) {
      redirect(
        `/painel/${estudioSlug}/treinos/${id}/editar?voltar=${voltar}&error=${encodeURIComponent(`Ficha guardada, mas os serviços não: ${erroServicos}`)}`
      )
    }
  }

  if (error) {
    redirect(
      `/painel/${estudioSlug}/treinos/${id}/editar?voltar=${voltar}&error=${encodeURIComponent('Não foi possível guardar as alterações.')}`
    )
  }

  revalidatePath(`/painel/${estudioSlug}/clientes`)
  revalidatePath(`/painel/${estudioSlug}/clientes/${id}`)
  revalidatePath(`/painel/${estudioSlug}/treinos`)
  revalidatePath(`/painel/${estudioSlug}/treinos/${id}`)
  redirect(`/painel/${estudioSlug}/${voltar}/${id}`)
}

// Chamado diretamente do seletor de exercícios (sem <form>/redirect):
// devolve o exercício criado para o formulário do treino o poder
// selecionar de imediato, sem sair da página nem perder o que já lá
// estava escrito.
type ResultadoExercicioRapido = { error: string } | { exercicio: { id: string; nome: string } }

export async function criarExercicioRapido(
  nome: string,
  categoriaId: string | null
): Promise<ResultadoExercicioRapido> {
  const nomeLimpo = nome.trim()
  if (!nomeLimpo) {
    return { error: 'Escreve o nome do exercício.' }
  }

  const supabase = await createClient()
  const { data: exercicio, error } = await supabase
    .from('exercicios')
    .insert({ nome: nomeLimpo })
    .select('id, nome')
    .single()

  if (error || !exercicio) {
    return { error: 'Não foi possível criar o exercício.' }
  }

  if (categoriaId) {
    await supabase
      .from('exercicios_categorias')
      .insert({ exercicio_id: exercicio.id, categoria_id: categoriaId })
  }

  return { exercicio }
}

export async function editarExercicioRapido(
  id: string,
  novoNome: string
): Promise<ResultadoExercicioRapido> {
  const nomeLimpo = novoNome.trim()
  if (!nomeLimpo) {
    return { error: 'Escreve o nome do exercício.' }
  }

  const supabase = await createClient()
  const { data: exercicio, error } = await supabase
    .from('exercicios')
    .update({ nome: nomeLimpo })
    .eq('id', id)
    .select('id, nome')
    .single()

  if (error || !exercicio) {
    return { error: 'Não foi possível editar o exercício.' }
  }

  return { exercicio }
}

// Eliminação por "ativo = false" (nunca apaga a linha) — o histórico de
// treinos já registado guarda o nome do exercício à parte
// (sessao_exercicios.exercicio_nome), por isso não é afetado.
export async function eliminarExercicioRapido(
  id: string
): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient()
  const { error } = await supabase.from('exercicios').update({ ativo: false }).eq('id', id)

  if (error) {
    return { error: 'Não foi possível eliminar o exercício.' }
  }

  return { ok: true }
}

// ── Janela de edição (sem sair da página) ────────────────────────────

// Guarda a ficha de um cliente (novo ou existente) a partir da janela —
// a mesma lógica de criarCliente/atualizarCliente, sem mudar de página.
export async function guardarClienteNaJanela(formData: FormData): Promise<ResultadoSemSair> {
  return semSair(formData.get('id') ? atualizarCliente : criarCliente, formData)
}

export type DadosJanelaCliente = {
  estudioId: number
  pts: Pick<Perfil, 'id' | 'nome'>[]
  cliente: Cliente | null
  servicos: { id: number; nome: string }[]
  servicosLigados: number[]
}

// O que o formulário da ficha precisa (clienteId null = cliente novo).
export async function dadosDaJanelaCliente(estudioSlug: string, clienteId: string | null): Promise<DadosJanelaCliente | { erro: string }> {
  const supabase = await createClient()
  const [estudio, { data: cliente }] = await Promise.all([
    getEstudioPorSlug(supabase, estudioSlug),
    clienteId ? supabase.from('clientes').select('*').eq('id', clienteId).maybeSingle() : Promise.resolve({ data: null }),
  ])
  if (!estudio) return { erro: 'Estúdio não encontrado.' }
  if (clienteId && (!cliente || cliente.estudio_id !== estudio.id)) return { erro: 'Cliente não encontrado.' }
  const [pts, servicos, inscricoes] = await Promise.all([
    getEquipaDoEstudio(supabase, estudio.id, (cliente as Cliente | null)?.pt_principal_id ?? undefined),
    carregarServicos(supabase, { soAtivos: true }),
    clienteId ? carregarInscricoes(supabase, clienteId) : Promise.resolve([]),
  ])
  const c = (cliente as (Cliente & { cliente_pt?: boolean }) | null) ?? null
  return {
    estudioId: estudio.id,
    pts,
    cliente: c,
    servicos: servicos.map((s) => ({ id: s.id, nome: s.nome })),
    servicosLigados: c ? servicosLigados(c.cliente_pt !== false, inscricoes) : [SERVICO_PT],
  }
}
