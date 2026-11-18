import type { SupabaseClient } from '@supabase/supabase-js'
import { hojeEmLisboa } from './hoje'
import { dadosQuemFez } from './quemFez'

// Marcar uma sessão experimental a uma lead da lista é, por si só, um
// contacto com sucesso (a pessoa atendeu e marcou). Fica registado
// sozinho no histórico da lead — conta no "Quadro do dia" e no mapa da
// melhor hora — sem ser preciso ir à ficha escrevê-lo à mão.

export const RESULTADO_EXPERIMENTAL_AGENDADA = 'Sessão experimental agendada'

// Só se regista se hoje ainda não houver um contacto com sucesso nessa
// lead (quem já o escreveu à mão antes de marcar não fica a contar a
// dobrar).
export function faltaRegistarSucesso(contactosDeHoje: { sucesso: boolean | null }[]): boolean {
  return !contactosDeHoje.some((c) => c.sucesso === true)
}

// Devolve a mensagem de erro (ou null). Quem chama decide se o erro
// trava a marcação — por regra não trava: a sessão já ficou marcada.
export async function registarContactoExperimental(
  supabase: SupabaseClient,
  leadId: string | null,
  userId: string | null
): Promise<string | null> {
  if (!leadId) return null
  const hoje = hojeEmLisboa()
  const { data: deHoje, error: erroLer } = await supabase.from('lead_contactos').select('sucesso').eq('lead_id', leadId).eq('data', hoje)
  if (erroLer) return erroLer.message
  if (!faltaRegistarSucesso((deHoje ?? []) as { sucesso: boolean | null }[])) return null
  const { euId } = await dadosQuemFez()
  const { error } = await supabase.from('lead_contactos').insert({
    lead_id: leadId,
    data: hoje,
    tipo: 'Telefone',
    resultado: RESULTADO_EXPERIMENTAL_AGENDADA,
    sucesso: true,
    nota: 'Registado automaticamente ao agendar a sessão experimental.',
    feito_por: userId,
    quem_fez: euId,
  })
  return error?.message ?? null
}
