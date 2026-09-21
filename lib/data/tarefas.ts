import type { RecorrenciaTarefa } from '@/lib/supabase/database.types'

// Quando uma tarefa é marcada como feita, a próxima ocorrência conta a
// partir de hoje (não da data em que devia ter sido feita) — para uma
// tarefa semanal feita com atraso não ficar sempre "em atraso".
export function proximaOcorrencia(hojeISO: string, recorrencia: RecorrenciaTarefa): string {
  const d = new Date(`${hojeISO}T00:00:00`)
  switch (recorrencia) {
    case 'Semanal':
      d.setDate(d.getDate() + 7)
      break
    case 'Mensal':
      d.setMonth(d.getMonth() + 1)
      break
    case 'Anual':
      d.setFullYear(d.getFullYear() + 1)
      break
    default:
      d.setDate(d.getDate() + 1)
  }
  return d.toISOString().slice(0, 10)
}
