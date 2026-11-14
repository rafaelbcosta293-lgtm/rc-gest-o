// Passagem extra pelos lembretes de treino (ver vercel.json): a mesma
// rota do envio das 10h, noutro horário, para apanhar as marcações
// feitas depois de os lembretes do dia já terem saído. Só envia o que
// ainda não foi enviado (lembrete_enviado = false), por isso ninguém
// recebe a mensagem duas vezes.
export { GET } from '../lembretes-sms/route'

export const dynamic = 'force-dynamic'
