// Envio de emails de alerta via Resend (https://resend.com) — API
// simples, sem dependências extra (um único POST). Sem domínio
// próprio verificado no Resend, o remetente por omissão
// "onboarding@resend.dev" só entrega ao email da própria conta Resend,
// o que é suficiente para este alerta (destinatário único, definido em
// NOTIFICATION_EMAIL). Se mais tarde verificarem um domínio, define
// RESEND_FROM_EMAIL para usar um remetente próprio.
const REMETENTE_OMISSAO = 'onboarding@resend.dev'

export async function enviarEmailAlerta(assunto: string, corpo: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const destino = process.env.NOTIFICATION_EMAIL
  const remetente = process.env.RESEND_FROM_EMAIL || REMETENTE_OMISSAO

  if (!apiKey || !destino) {
    console.error(
      'Email de alerta não enviado: RESEND_API_KEY ou NOTIFICATION_EMAIL em falta.',
      assunto
    )
    return
  }

  try {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: remetente, to: [destino], subject: assunto, text: corpo }),
    })
    if (!resposta.ok) {
      console.error('Falha ao enviar email de alerta:', resposta.status, await resposta.text())
    }
  } catch (erro) {
    console.error('Falha ao enviar email de alerta:', erro)
  }
}
