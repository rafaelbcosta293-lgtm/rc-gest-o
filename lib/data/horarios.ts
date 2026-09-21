export const DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

// Blocos de meia em meia hora, das 6h às 22h.
export const BLOCOS_HORARIO: { hora: number; minuto: number; label: string }[] = Array.from(
  { length: 33 },
  (_, i) => {
    const hora = 6 + Math.floor(i / 2)
    const minuto = i % 2 === 0 ? 0 : 30
    return { hora, minuto, label: `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}` }
  }
)

export function chaveBloco(hora: number, minuto: number) {
  return `${hora}-${minuto}`
}

export function inicioDaSemana(dataISO: string): string {
  const d = new Date(`${dataISO}T00:00:00`)
  const dow = d.getDay() // 0 = domingo
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

export function somarDias(dataISO: string, dias: number): string {
  const d = new Date(`${dataISO}T00:00:00`)
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

export function diasDaSemana(inicioISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => somarDias(inicioISO, i))
}
