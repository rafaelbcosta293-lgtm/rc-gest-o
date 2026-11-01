import type { SupabaseClient } from '@supabase/supabase-js'

// Dias corridos desde uma data (só a parte da data, ignora hora) — usado
// para mostrar há quanto tempo um lead está no funil.
export function diasDesde(dataISO: string): number {
  const inicio = new Date(`${dataISO}T00:00:00`)
  const hoje = new Date()
  inicio.setHours(0, 0, 0, 0)
  hoje.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((hoje.getTime() - inicio.getTime()) / 86400000))
}

// Normaliza o telefone recebido de uma lead externa (Meta Ads, Google
// Forms, site): remove espaços/parênteses/hífens e garante o prefixo
// +351 quando vem só o número nacional de 9 dígitos. Um formato que não
// reconhece fica só limpo de espaços, em vez de se perder — nunca deixa
// de guardar o contacto só por não conseguir adivinhar o indicativo.
export function normalizarTelefoneLead(telefone: string | null | undefined): string | null {
  if (!telefone) return null
  const limpo = telefone.replace(/[\s()-]/g, '')
  if (!limpo) return null
  if (limpo.startsWith('+')) return limpo
  if (/^9\d{8}$/.test(limpo)) return `+351${limpo}`
  if (/^351\d{9}$/.test(limpo)) return `+${limpo}`
  if (/^00351\d{9}$/.test(limpo)) return `+${limpo.slice(2)}`
  return limpo
}

export type ResultadoLeadAutomatica = { ok: true; id: string; duplicado: boolean } | { error: string }

// Criação de lead partilhada pelos webhooks externos (Meta Ads, Google
// Forms, Website) — nunca chamada pela UI, que usa a ação "criarLead"
// normal. Evita duplicar o registo em dois casos: a mesma origem externa
// a reentregar o mesmo evento (external_id já visto) e a mesma pessoa a
// submeter outra vez enquanto já tem uma lead em aberto (estado diferente
// de "Ganha"/"Perdida") com o mesmo telefone, no mesmo estúdio.
export async function criarLeadAutomatica(
  admin: SupabaseClient,
  input: {
    estudioId: number
    nome: string
    telefone: string | null
    email: string | null
    origem: string
    campanha?: string | null
    nota?: string | null
    externalId?: string | null
  }
): Promise<ResultadoLeadAutomatica> {
  if (input.externalId) {
    const { data: existente, error: erroExistente } = await admin
      .from('leads')
      .select('id')
      .eq('external_id', input.externalId)
      .maybeSingle()
    if (erroExistente) return { error: erroExistente.message }
    if (existente) return { ok: true, id: existente.id, duplicado: true }
  }

  if (input.telefone) {
    const { data: abertas, error: erroAbertas } = await admin
      .from('leads')
      .select('id')
      .eq('estudio_id', input.estudioId)
      .eq('telefone', input.telefone)
      .neq('estado', 'Ganha')
      .neq('estado', 'Perdida')
      .limit(1)
    if (erroAbertas) return { error: erroAbertas.message }
    if (abertas && abertas.length > 0) return { ok: true, id: abertas[0].id, duplicado: true }
  }

  const { data, error } = await admin
    .from('leads')
    .insert({
      estudio_id: input.estudioId,
      nome: input.nome,
      telefone: input.telefone,
      email: input.email,
      origem: input.origem,
      campanha: input.campanha ?? null,
      nota: input.nota ?? null,
      external_id: input.externalId ?? null,
    })
    .select('id')
    .single()

  if (error || !data) return { error: error?.message ?? 'Não foi possível criar o lead.' }
  return { ok: true, id: data.id, duplicado: false }
}
