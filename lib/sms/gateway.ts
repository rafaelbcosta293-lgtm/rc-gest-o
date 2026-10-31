// Cliente para o SMS Gate (android-sms-gateway, app instalada no
// telemóvel que faz de gateway) — API "3rdparty" v1, autenticação
// HTTP Basic com o utilizador/password definidos na própria app do
// telemóvel. Documentação: https://docs.sms-gate.app
//
// Se o telemóvel/instância self-hosted usar uma versão da API que
// difira neste detalhe, este é o único sítio a ajustar.
const CAMINHO_ENVIO = '/3rdparty/v1/message'
const TIMEOUT_MS = 15_000

export type ResultadoEnvioSms =
  | { ok: true }
  | { ok: false; tipo: 'offline'; mensagem: string }
  | { ok: false; tipo: 'rejeitado'; mensagem: string }
  | { ok: false; tipo: 'configuracao'; mensagem: string }

// Normaliza para o formato internacional que o gateway espera. Os
// números na app nem sempre têm o "+351" (ver limpeza feita em
// Clientes) — assume-se Portugal quando não há indicação de outro
// país. Devolve null quando não há dados suficientes para enviar.
export function normalizarTelefoneSms(telefone: string | null): string | null {
  if (!telefone) return null
  const limpo = telefone.replace(/[\s()-]/g, '')
  if (!limpo) return null
  if (limpo.startsWith('+')) return limpo
  if (/^9\d{8}$/.test(limpo)) return `+351${limpo}`
  if (/^351\d{9}$/.test(limpo)) return `+${limpo}`
  return null
}

function baseUrl(): string {
  const url = process.env.SMS_GATEWAY_URL
  if (!url) throw new Error('SMS_GATEWAY_URL não está configurada.')
  return url.replace(/\/$/, '')
}

export async function enviarSms(telefoneDestino: string, texto: string): Promise<ResultadoEnvioSms> {
  const url = process.env.SMS_GATEWAY_URL
  const utilizador = process.env.SMS_GATEWAY_USERNAME
  const password = process.env.SMS_GATEWAY_PASSWORD
  if (!url || !utilizador || !password) {
    return {
      ok: false,
      tipo: 'configuracao',
      mensagem: 'SMS_GATEWAY_URL / SMS_GATEWAY_USERNAME / SMS_GATEWAY_PASSWORD não estão configuradas.',
    }
  }

  const numero = normalizarTelefoneSms(telefoneDestino)
  if (!numero) {
    return { ok: false, tipo: 'rejeitado', mensagem: `Número inválido: "${telefoneDestino}".` }
  }

  const autenticacao = Buffer.from(`${utilizador}:${password}`).toString('base64')
  const controlador = new AbortController()
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS)

  try {
    const resposta = await fetch(`${baseUrl()}${CAMINHO_ENVIO}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${autenticacao}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: texto, phoneNumbers: [numero] }),
      signal: controlador.signal,
    })

    if (resposta.ok) {
      return { ok: true }
    }

    const corpo = await resposta.text().catch(() => '')
    // 401/403 (credenciais erradas ou dispositivo não autorizado) e
    // 5xx (app no telemóvel em baixo/sem resposta) tratam-se como
    // "gateway offline" — o resto (ex.: 400 por número inválido) é um
    // problema deste envio específico, não da ligação ao telemóvel.
    if (resposta.status === 401 || resposta.status === 403 || resposta.status >= 500) {
      return { ok: false, tipo: 'offline', mensagem: `HTTP ${resposta.status}: ${corpo}` }
    }
    return { ok: false, tipo: 'rejeitado', mensagem: `HTTP ${resposta.status}: ${corpo}` }
  } catch (erro) {
    // Falha de rede/timeout a chegar ao telemóvel — sem bateria, sem
    // rede, ou o endereço deixou de responder.
    const mensagem = erro instanceof Error ? erro.message : String(erro)
    return { ok: false, tipo: 'offline', mensagem }
  } finally {
    clearTimeout(temporizador)
  }
}
