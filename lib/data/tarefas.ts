import type { RecorrenciaTarefa, TarefaDiaria } from '@/lib/supabase/database.types'

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

// Da mais urgente (mais cedo) para a menos urgente — sem hora definida
// conta como "o mais tarde possível", por isso fica sempre no fim.
export function ordenarPorUrgencia<T extends { hora: string | null }>(tarefas: T[]): T[] {
  return [...tarefas].sort((a, b) => (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99'))
}

// Quais tarefas pertencem a um dia — usado tanto na vista de dia como,
// dia a dia, na vista de semana. Um dia passado só mostra o que foi de
// facto feito nesse dia (histórico); hoje mostra o que está por fazer
// (proxima_data <= dia); um dia futuro só mostra o que já está mesmo
// agendado para essa data exata (proxima_data === dia) — não "herda" o
// que ainda estiver em atraso hoje.
export function tarefasDoDia(
  dia: string,
  hoje: string,
  tarefas: TarefaDiaria[],
  idsFeitasNoDia: Set<string>
): TarefaDiaria[] {
  const diaEhPassado = dia < hoje
  const pendentes = diaEhPassado
    ? []
    : tarefas.filter(
        (t) => (dia === hoje ? t.proxima_data <= dia : t.proxima_data === dia) && !idsFeitasNoDia.has(t.id)
      )
  const idsNoDia = new Set([...pendentes.map((t) => t.id), ...idsFeitasNoDia])
  return tarefas.filter((t) => idsNoDia.has(t.id))
}
