import { google } from 'googleapis'

// Um calendário Google partilhado por estúdio (não por PT) — o email da
// conta de serviço (GOOGLE_SERVICE_ACCOUNT_EMAIL) tem de estar
// convidado como "Ver todos os detalhes do evento" em cada um destes
// calendários, no Google Calendar.
const CALENDAR_ID_POR_ESTUDIO: Record<string, string | undefined> = {
  fatima: process.env.GOOGLE_CALENDAR_ID_FATIMA,
  leiria: process.env.GOOGLE_CALENDAR_ID_LEIRIA,
}

export function calendarIdDoEstudio(slug: string): string | null {
  return CALENDAR_ID_POR_ESTUDIO[slug] ?? null
}

function clienteGoogle() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const chave = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY

  if (!email || !chave) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY não estão configuradas.'
    )
  }

  const auth = new google.auth.JWT({
    email,
    // No Vercel (e na maioria dos sítios onde se guardam variáveis de
    // ambiente em texto), as quebras de linha da chave privada vêm
    // escapadas como "\n" literal — têm de voltar a ser quebras reais.
    key: chave.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  })

  return google.calendar({ version: 'v3', auth })
}

// Remove acentos, baixa para minúsculas e normaliza espaços, para
// comparar "Ana   Sofia" com "ana sofia" ou "Ana Sofia" sem falhar por
// causa de acentuação/maiúsculas diferentes.
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

// Todo o texto (título + descrição, normalizado) de cada evento futuro
// do calendário — uma só chamada à API por calendário, em vez de uma
// por cliente. A correspondência é feita por nome (é como a equipa já
// escreve os eventos hoje) — ver aviso em clienteTemEventoFuturo sobre
// a limitação disto.
export async function textosDeEventosFuturos(calendarId: string): Promise<string[]> {
  const calendar = clienteGoogle()

  const { data } = await calendar.events.list({
    calendarId,
    timeMin: new Date().toISOString(),
    singleEvents: true,
    maxResults: 2500,
    fields: 'items(summary,description)',
  })

  return (data.items ?? []).map((ev) => normalizar(`${ev.summary ?? ''} ${ev.description ?? ''}`))
}

// Aviso: isto compara por nome, não por um identificador único — dois
// clientes ativos com o mesmo nome (ou nomes muito parecidos) no mesmo
// estúdio podem fazer com que um "herde" o evento do outro. Para
// resolver por completo, a forma mais simples é a equipa passar a
// incluir o número de sócio no título do evento (ex.: "F24201 — Ana
// Sofia") — nesse caso, dá para trocar esta comparação por uma busca
// exata do número de sócio no texto do evento.
export function clienteTemEventoFuturo(nomeCliente: string, textosEventos: string[]): boolean {
  const nomeNormalizado = normalizar(nomeCliente)
  return textosEventos.some((texto) => texto.includes(nomeNormalizado))
}
