// Dias corridos desde uma data (só a parte da data, ignora hora) — usado
// para mostrar há quanto tempo um lead está no funil.
export function diasDesde(dataISO: string): number {
  const inicio = new Date(`${dataISO}T00:00:00`)
  const hoje = new Date()
  inicio.setHours(0, 0, 0, 0)
  hoje.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((hoje.getTime() - inicio.getTime()) / 86400000))
}
