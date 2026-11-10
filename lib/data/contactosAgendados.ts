import type { SupabaseClient } from '@supabase/supabase-js'

// Contacto que a própria lead pediu a uma hora certa (ex.: "liga-me às
// 15h") — à parte do motor de alertas diário (lib/data/alertas.ts, que
// só sabe o dia, via cron uma vez por dia). Este precisa de disparar no
// minuto exato, em tempo real, em qualquer página da app — por isso é
// lido diretamente aqui, pelo componente (AlertaContactosAgendados) que
// se atualiza sozinho a cada poucos segundos.
export type ContactoAgendado = {
  id: string
  nome: string
  telefone: string | null
  estudioSlug: string
  estudioNome: string
  data: string
  hora: string
}

export const MINUTOS_ANTECEDENCIA_CONTACTO = 10

export type EstadoContactoAgendado = 'oculto' | 'próximo' | 'atrasado'

// Regra pura por trás do alerta (components/AlertaContactosAgendados.tsx):
// "oculto" até faltarem MINUTOS_ANTECEDENCIA_CONTACTO minutos, "próximo"
// nesse intervalo (alerta calmo), "atrasado" a partir da própria hora —
// e continua "atrasado" indefinidamente, até a lead ser marcada como
// contactada, para nunca deixar a hora passar em silêncio.
export function avaliarContactoAgendado(
  contacto: Pick<ContactoAgendado, 'data' | 'hora'>,
  agoraMs: number,
  antecedenciaMin: number = MINUTOS_ANTECEDENCIA_CONTACTO
): { minutosRestantes: number; estado: EstadoContactoAgendado } {
  const minutosRestantes = Math.round((new Date(`${contacto.data}T${contacto.hora}`).getTime() - agoraMs) / 60_000)
  const estado: EstadoContactoAgendado =
    minutosRestantes > antecedenciaMin ? 'oculto' : minutosRestantes <= 0 ? 'atrasado' : 'próximo'
  return { minutosRestantes, estado }
}

type LinhaContactoAgendado = {
  id: string
  nome: string
  telefone: string | null
  proximo_contacto: string
  proximo_contacto_hora: string
  estudio: { slug: string; nome: string } | { slug: string; nome: string }[] | null
}

// Nunca inclui leads já fechadas (Ganha/Perdida) — essas já não têm
// seguimento, mesmo que tenham ficado com uma hora pedida de antes.
export async function listarContactosAgendados(supabase: SupabaseClient): Promise<ContactoAgendado[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('id, nome, telefone, proximo_contacto, proximo_contacto_hora, estudio:estudios(slug, nome)')
    .not('proximo_contacto_hora', 'is', null)
    .not('estado', 'in', '(Ganha,Perdida)')
    .order('proximo_contacto')
    .order('proximo_contacto_hora')

  if (error || !data) return []

  return (data as unknown as LinhaContactoAgendado[])
    .map((l) => {
      const estudio = Array.isArray(l.estudio) ? l.estudio[0] : l.estudio
      if (!estudio) return null
      return {
        id: l.id,
        nome: l.nome,
        telefone: l.telefone,
        estudioSlug: estudio.slug,
        estudioNome: estudio.nome,
        data: l.proximo_contacto,
        hora: l.proximo_contacto_hora,
      }
    })
    .filter((c): c is ContactoAgendado => c !== null)
}
