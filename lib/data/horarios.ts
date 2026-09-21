export const DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

export const HORAS = Array.from({ length: 17 }, (_, i) => i + 6) // 6h às 22h

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
