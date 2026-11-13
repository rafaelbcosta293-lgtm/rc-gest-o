'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { nifValido, normalizarNif } from '@/lib/data/faturas'
import type { EstadoCliente } from '@/lib/supabase/database.types'

type ResultadoClienteRapido = { error: string } | { ok: true }

// Só o estado — usada pelo menu de contexto (botão direito numa linha
// de Pagamentos/Clientes), sem abrir a ficha completa. Tal como editar
// o estado na ficha, marca sempre estado_automatico=false (alteração
// manual): a transição automática por falta de pagamento só volta a
// mexer depois do próximo pagamento (ver lib/data/estadoClientes.ts).
export async function atualizarEstadoClienteRapido(input: {
  estudioSlug: string
  id: string
  estado: EstadoCliente
}): Promise<ResultadoClienteRapido> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('clientes')
    .update({ estado: input.estado, estado_automatico: false })
    .eq('id', input.id)
  if (error) {
    return { error: 'Não foi possível guardar o novo estado.' }
  }

  revalidatePath(`/painel/${input.estudioSlug}/clientes`)
  revalidatePath(`/painel/${input.estudioSlug}/clientes/${input.id}`)
  revalidatePath(`/painel/${input.estudioSlug}/pagamentos`)
  revalidatePath(`/painel/${input.estudioSlug}/pagamentos/${input.id}`)
  revalidatePath(`/painel/${input.estudioSlug}/presencas`)
  revalidatePath('/painel/admin', 'layout')
  return { ok: true }
}

// Chamado diretamente do modal de edição rápida (sem <form action>/redirect):
// devolve o resultado para o modal decidir se fecha ou mostra o erro, sem
// nunca sair da página de Clientes.
export async function atualizarClienteRapido(input: {
  estudioSlug: string
  id: string
  nome: string
  nomePreferido: string | null
  numeroSocio: string | null
  telefone: string | null
  email: string | null
  nif: string | null
  nascimento: string | null
  frequenciaSemanal: number | null
  estado: string
  genero: string | null
}): Promise<ResultadoClienteRapido> {
  const nome = input.nome.trim()
  if (!nome) {
    return { error: 'O nome é obrigatório.' }
  }

  const nif = normalizarNif(input.nif)
  if (nif && !nifValido(nif)) {
    return { error: `O NIF ${nif} não é válido.` }
  }

  const supabase = await createClient()

  const { data: atual, error: erroAtual } = await supabase
    .from('clientes')
    .select('estado')
    .eq('id', input.id)
    .single()
  if (erroAtual) {
    return { error: 'Não foi possível guardar as alterações.' }
  }

  // O estado só fica marcado como "alterado à mão" (fora da transição
  // automática por falta de pagamento) quando realmente muda aqui —
  // voltar a gravar o mesmo valor, ao editar outro campo, não conta.
  const mudouEstado = atual.estado !== input.estado

  const { error } = await supabase
    .from('clientes')
    .update({
      nome,
      nome_preferido: input.nomePreferido,
      numero_socio: input.numeroSocio,
      telefone: input.telefone,
      email: input.email,
      nif,
      nascimento: input.nascimento,
      frequencia_semanal: input.frequenciaSemanal,
      estado: input.estado,
      genero: input.genero,
      ...(mudouEstado ? { estado_automatico: false } : {}),
    })
    .eq('id', input.id)

  if (error) {
    return { error: 'Não foi possível guardar as alterações.' }
  }

  revalidatePath(`/painel/${input.estudioSlug}/clientes`)
  revalidatePath(`/painel/${input.estudioSlug}/clientes/${input.id}`)
  revalidatePath(`/painel/${input.estudioSlug}/treinos/${input.id}`)
  return { ok: true }
}

// Apaga o cliente a sério — pagamentos, sessões de treino, avaliações e
// presenças vão juntos (apagados em cascata na base de dados); eventos
// futuros na agenda e leads ligadas ficam sem o cliente associado, mas
// não são apagados. Só quem gere o estúdio consegue (RLS "apagar_clientes",
// e_gestao()) — isto nunca passa por aqui sem já ter sido confirmado duas
// vezes no ApagarClienteModal, dado o impacto.
export async function apagarCliente(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase.from('clientes').delete().eq('id', id)

  if (error) {
    redirect(`/painel/${estudioSlug}/clientes/${id}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/clientes`)
  redirect(`/painel/${estudioSlug}/clientes`)
}
