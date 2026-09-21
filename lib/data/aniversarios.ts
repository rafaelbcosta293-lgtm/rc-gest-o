export function proximoAniversario(nascimentoISO: string, hoje: Date): { data: Date; dias: number } {
  const nasc = new Date(`${nascimentoISO}T00:00:00`)
  const hojeSemHora = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  let proximo = new Date(hojeSemHora.getFullYear(), nasc.getMonth(), nasc.getDate())
  if (proximo < hojeSemHora) {
    proximo = new Date(hojeSemHora.getFullYear() + 1, nasc.getMonth(), nasc.getDate())
  }
  const dias = Math.round((proximo.getTime() - hojeSemHora.getTime()) / 86400000)
  return { data: proximo, dias }
}

export function idadeEm(nascimentoISO: string, naData: Date): number {
  const nasc = new Date(`${nascimentoISO}T00:00:00`)
  let idade = naData.getFullYear() - nasc.getFullYear()
  const aindaNaoFezAnos =
    naData.getMonth() < nasc.getMonth() ||
    (naData.getMonth() === nasc.getMonth() && naData.getDate() < nasc.getDate())
  if (aindaNaoFezAnos) idade--
  return idade
}

export function preencherMensagem(template: string, nome: string) {
  return template.replaceAll('{nome}', nome)
}

export function fmtDiaMes(data: Date) {
  return data.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
}
