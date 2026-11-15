import type { SupabaseClient } from '@supabase/supabase-js'
import { CalendarClock } from 'lucide-react'
import { ehContaPartilhada } from '@/lib/data/acessos'
import { listarAvisosHorario } from '@/lib/data/avisosHorario'
import { somarDias } from '@/lib/data/horarios'
import BotoesAvisoHorario from './BotoesAvisoHorario'

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

// Faixa no topo de qualquer página: "há horário novo", uma por estúdio e
// semana, até a pessoa carregar em "Ver horário" ou "OK". As contas
// partilhadas nunca recebem avisos (não são pessoas), por isso nem se
// pergunta à base de dados por elas.
export default async function AvisosHorario({
  supabase,
  userId,
  email,
}: {
  supabase: SupabaseClient
  userId: string | null
  email: string | null
}) {
  if (!userId || ehContaPartilhada(email)) return null
  const avisos = await listarAvisosHorario(supabase, userId)
  if (avisos.length === 0) return null

  return (
    <div className="flex flex-col">
      {avisos.map((a) => (
        <div
          key={`${a.estudioId}-${a.semana}`}
          role="status"
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-brand px-4 py-2 text-sm font-medium text-black"
        >
          <CalendarClock className="h-4 w-4 shrink-0" />
          <p className="min-w-0 flex-1">
            Há horário novo em {a.nomeEstudio} para a semana de {dm(a.semana)} a {dm(somarDias(a.semana, 6))}.
          </p>
          <BotoesAvisoHorario estudioId={a.estudioId} slug={a.slug} semana={a.semana} />
        </div>
      ))}
    </div>
  )
}
