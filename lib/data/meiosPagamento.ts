// Meios de pagamento de cada estúdio mostrados no tablet de check-in a quem
// tem a mensalidade por regularizar (config: pagamento_<campo>_<slug>, lidos
// pela função resposta_sem_mensalidade na base de dados).
export const CAMPOS_PAGAMENTO = [
  { campo: 'link', rotulo: 'Link de pagamento (aparece como QR code)', exemplo: 'https://… (link do banco ou do serviço de pagamentos)' },
  { campo: 'mbway', rotulo: 'MB Way (nº de telemóvel)', exemplo: '912 345 678' },
  { campo: 'iban', rotulo: 'IBAN (transferência)', exemplo: 'PT50 0000 0000 0000 0000 0000 0' },
  { campo: 'titular', rotulo: 'Titular da conta', exemplo: 'RC Private Fitness Studio, Lda' },
  { campo: 'nota', rotulo: 'Nota (opcional)', exemplo: 'Também pode pagar por Multibanco na receção.' },
] as const

// O link do QR code tem de ser https (o tablet ignora outra coisa).
export function validarLinkPagamento(v: string): string | null {
  const t = v.trim()
  if (!t) return null
  return /^https:\/\/\S+$/i.test(t) ? null : 'O link de pagamento tem de começar por https://'
}
