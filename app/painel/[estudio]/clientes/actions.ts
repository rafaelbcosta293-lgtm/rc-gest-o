'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type ResultadoClienteRapido = { error: string } | { ok: true }

// Chamado diretamente do modal de edição rápida (sem <form action>/redirect):
// devolve o resultado para o modal decidir se fecha ou mostra o erro, sem
// nunca sair da página de Clientes.
export async function atualizarClienteRapido(input: {
  estudioSlug: string
  id: string
  nome: string
  numeroSocio: string | null
  telefone: string | null
  email: string | null
  nascimento: string | null
  frequenciaSemanal: number | null
  estado: string
}): Promise<ResultadoClienteRapido> {
  const nome = input.nome.trim()
  if (!nome) {
    return { error: 'O nome é obrigatório.' }
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
      numero_socio: input.numeroSocio,
      telefone: input.telefone,
      email: input.email,
      nascimento: input.nascimento,
      frequencia_semanal: input.frequenciaSemanal,
      estado: input.estado,
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
