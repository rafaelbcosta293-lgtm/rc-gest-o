// Meses entre o início de contrato e hoje (ou até à saída, se já não é
// cliente). Arredondado por baixo — "3 meses" só depois de passarem 3
// meses completos.
export function mesesAtivo(inicioContrato: string | null, saiuEm: string | null): number | null {
  if (!inicioContrato) return null
  const inicio = new Date(`${inicioContrato}T00:00:00`)
  const fim = saiuEm ? new Date(`${saiuEm}T00:00:00`) : new Date()

  let meses = (fim.getFullYear() - inicio.getFullYear()) * 12 + (fim.getMonth() - inicio.getMonth())
  if (fim.getDate() < inicio.getDate()) meses--
  return Math.max(0, meses)
}
