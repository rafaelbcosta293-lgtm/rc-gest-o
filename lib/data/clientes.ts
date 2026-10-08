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

// O seguro renova todos os anos no mês em que o cliente entrou (ex.:
// entrou em fevereiro de 2025 → renova em fevereiro de 2026, 2027, …).
// Fica ativo o mês inteiro, a partir do dia 1 — não exige dia exato.
// Exclui o próprio mês/ano de entrada (isso é a inscrição, não uma
// renovação).
export function precisaRenovarSeguro(inicioContrato: string | null, hoje: Date): boolean {
  if (!inicioContrato) return false
  const anoInicio = Number(inicioContrato.slice(0, 4))
  const mesInicio = Number(inicioContrato.slice(5, 7))
  return mesInicio === hoje.getMonth() + 1 && anoInicio < hoje.getFullYear()
}
