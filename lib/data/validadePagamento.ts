function pad2(n: number) {
  return String(n).padStart(2, '0')
}

// Último dia do mês de dataISO (ou de N meses depois). Feito só com
// números, sem toISOString: no horário de verão isso recuava um dia
// (a meia-noite local ainda é o dia anterior em UTC).
export function fimDoMes(dataISO: string, mesesAFrente = 0): string {
  const [ano, mes] = dataISO.split('-').map(Number)
  const indice = mes - 1 + mesesAFrente
  const anoAlvo = ano + Math.floor(indice / 12)
  const mesAlvo = ((indice % 12) + 12) % 12 + 1
  const ultimoDia = new Date(Date.UTC(anoAlvo, mesAlvo, 0)).getUTCDate()
  return `${anoAlvo}-${pad2(mesAlvo)}-${pad2(ultimoDia)}`
}

// A mensalidade cobre um mês inteiro: o mês em que é paga, ou o
// seguinte quando o cliente já tem o mês atual pago (paga adiantado).
export function validadeSugerida(hojeISO: string, validadeAtual: string | null): string {
  const fimEsteMes = fimDoMes(hojeISO)
  return validadeAtual && validadeAtual >= fimEsteMes ? fimDoMes(hojeISO, 1) : fimEsteMes
}
