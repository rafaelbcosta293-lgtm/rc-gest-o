// Passagem extra pelos lembretes de treino a meio da tarde (ver
// vercel.json): apanha as marcações feitas depois do meio-dia e volta a
// tentar os que falharam de manhã, sem esperar pela passagem da noite.
// Só envia o que ainda não saiu (lembrete_enviado = false).
export { GET } from '../lembretes-sms/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 300
