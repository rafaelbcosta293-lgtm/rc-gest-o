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

// --- Reconhecer clientes pelo nome nos eventos --------------------------
//
// A equipa nem sempre escreve o nome completo no evento ("Ana Costa" para
// a cliente "Ana Sofia Pereira Costa"), por isso o cliente é reconhecido
// pelo PRIMEIRO e ÚLTIMO nome; os nomes do meio só servem para desempatar
// entre clientes com o mesmo primeiro e último nome.
//
// Aviso: continua a ser uma comparação por nome, não por um identificador
// único. Para resolver por completo, a forma mais simples é a equipa
// passar a incluir o número de sócio no título do evento (ex.: "F24201 —
// Ana Sofia") — nesse caso, dá para trocar isto por uma busca exata do
// número de sócio no texto do evento.

// Partículas que ligam nomes ("Ana da Costa", "João dos Santos") — não
// contam nem como primeiro nem como último nome.
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'd'])

// Quantas palavras podem aparecer no evento entre o primeiro e o último
// nome (ex.: "Ana Sofia Pereira Costa" tem 2 pelo meio). Mais do que isto
// já não é tratado como o nome de uma só pessoa.
const MAX_PALAVRAS_ENTRE_NOMES = 3

// Texto normalizado partido em palavras soltas, sem pontuação — para que
// "Ana Costa," / "(Ana Costa)" / "Ana-Costa" deem as mesmas palavras e
// "Ana" não seja encontrada dentro de "Mariana".
function palavras(texto: string): string[] {
  return normalizar(texto)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

type NomeCliente = {
  primeiro: string
  ultimo: string
  meio: string[]
  // Cliente registado na app com uma só palavra no nome (ex.: só "Ana").
  soUmNome: boolean
}

function partesDoNome(nome: string): NomeCliente | null {
  const p = palavras(nome).filter((w) => !PARTICULAS.has(w))
  if (p.length === 0) return null
  return { primeiro: p[0], ultimo: p[p.length - 1], meio: p.slice(1, -1), soUmNome: p.length === 1 }
}

type Ocorrencia = { pontos: number; inicio: number; fim: number }

// Onde (e quão bem) o nome do cliente aparece nas palavras do evento: o
// primeiro nome e, a seguir, o último (com no máximo
// MAX_PALAVRAS_ENTRE_NOMES palavras pelo meio). Pontos = 2 + nomes do
// meio do cliente que também aparecem entre os dois — é isso que separa
// "Ana Sofia Costa" de "Ana Rita Costa" quando o evento diz "Ana Sofia
// Costa". Um cliente registado só com um nome é uma correspondência
// fraca (1 ponto), se essa palavra aparecer.
function ocorrenciaNoEvento(palavrasEvento: string[], nome: NomeCliente): Ocorrencia | null {
  if (nome.soUmNome) {
    const i = palavrasEvento.indexOf(nome.primeiro)
    return i === -1 ? null : { pontos: 1, inicio: i, fim: i }
  }

  let melhor: Ocorrencia | null = null
  for (let i = 0; i < palavrasEvento.length; i++) {
    if (palavrasEvento[i] !== nome.primeiro) continue
    const limite = Math.min(palavrasEvento.length - 1, i + 1 + MAX_PALAVRAS_ENTRE_NOMES)
    for (let j = i + 1; j <= limite; j++) {
      if (palavrasEvento[j] !== nome.ultimo) continue
      const entre = palavrasEvento.slice(i + 1, j)
      const pontos = 2 + nome.meio.filter((m) => entre.includes(m)).length
      if (!melhor || pontos > melhor.pontos) melhor = { pontos, inicio: i, fim: j }
    }
  }
  return melhor
}

// Todo o texto (título + descrição, normalizado) de cada evento futuro
// do calendário — uma só chamada à API por calendário, em vez de uma
// por cliente. A correspondência é feita por nome (é como a equipa já
// escreve os eventos hoje) — ver o aviso em "Reconhecer clientes pelo
// nome nos eventos", mais acima, sobre a limitação disto.
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

// As mesmas listas de textos são verificadas para muitos clientes
// seguidos — parte-se cada texto em palavras uma só vez por lista.
const palavrasPorLista = new WeakMap<string[], string[][]>()

// Reconhece o cliente pelo primeiro e último nome (ver ocorrenciaNoEvento).
// Aqui basta o nome aparecer num evento futuro: na dúvida (dois clientes
// com o mesmo primeiro e último nome), conta como agendado para ambos,
// para não encher as Pendências de falsos alertas.
export function clienteTemEventoFuturo(nomeCliente: string, textosEventos: string[]): boolean {
  const nome = partesDoNome(nomeCliente)
  if (!nome) return false

  let listas = palavrasPorLista.get(textosEventos)
  if (!listas) {
    listas = textosEventos.map(palavras)
    palavrasPorLista.set(textosEventos, listas)
  }
  return listas.some((palavrasEvento) => ocorrenciaNoEvento(palavrasEvento, nome) !== null)
}

export type EventoComCor = {
  id: string
  // Data local do início (YYYY-MM-DD), tirada diretamente da string que
  // o Google devolve (já no fuso do calendário) — não se converte para
  // UTC para não arriscar deslizar de dia perto da meia-noite.
  data: string
  hora: string
  fim: Date
  // undefined/null = evento sem cor própria, a mostrar na cor
  // predefinida do calendário. Qualquer valor = cor escolhida à mão
  // para aquele evento específico, substituindo a predefinida.
  colorId: string | null
  texto: string
  // Título por extenso (não normalizado) — só para diagnóstico humano;
  // a comparação usa sempre "texto".
  resumo: string
}

// Eventos com hora marcada (exclui eventos de dia inteiro, que não têm
// start.dateTime) num intervalo — usado para decidir presença pela cor,
// não só para verificar se "há algum evento" como textosDeEventosFuturos.
export async function eventosComCorNoIntervalo(
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<EventoComCor[]> {
  const calendar = clienteGoogle()

  const { data } = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    maxResults: 2500,
    fields: 'items(id,summary,description,start,end,colorId)',
  })

  const eventos: EventoComCor[] = []
  for (const ev of data.items ?? []) {
    if (!ev.id || !ev.start?.dateTime || !ev.end?.dateTime) continue
    eventos.push({
      id: ev.id,
      data: ev.start.dateTime.slice(0, 10),
      hora: ev.start.dateTime.slice(11, 16),
      fim: new Date(ev.end.dateTime),
      colorId: ev.colorId ?? null,
      texto: normalizar(`${ev.summary ?? ''} ${ev.description ?? ''}`),
      resumo: ev.summary ?? '(sem título)',
    })
  }
  return eventos
}

// O cliente (de entre os ativos passados) a que o evento se refere,
// reconhecido pelo primeiro e último nome. Se vários clientes tiverem
// esse primeiro e último nome, ganha o que tiver mais nomes do meio
// escritos no evento. Se continuar empatado — ou se o evento mencionar
// pessoas diferentes em sítios diferentes do texto — devolve null:
// prefere-se não marcar nada a arriscar marcar o cliente errado.
export function clienteExatoDoEvento<T extends { id: string; nome: string }>(
  texto: string,
  clientes: T[]
): T | null {
  const palavrasEvento = palavras(texto)

  const candidatos: { cliente: T; ocorrencia: Ocorrencia }[] = []
  for (const cliente of clientes) {
    const nome = partesDoNome(cliente.nome)
    if (!nome) continue
    const ocorrencia = ocorrenciaNoEvento(palavrasEvento, nome)
    if (ocorrencia) candidatos.push({ cliente, ocorrencia })
  }

  // Quem é reconhecido pelo primeiro e último nome tem prioridade sobre
  // clientes registados só com um nome (que podem ser, por exemplo, o
  // nome do PT escrito no evento).
  const fortes = candidatos.filter((c) => c.ocorrencia.pontos >= 2)
  const considerados = fortes.length > 0 ? fortes : candidatos
  if (considerados.length === 0) return null

  const maxPontos = Math.max(...considerados.map((c) => c.ocorrencia.pontos))
  const melhores = considerados.filter((c) => c.ocorrencia.pontos === maxPontos)
  if (melhores.length !== 1) return null
  const vencedor = melhores[0]

  // Outro cliente reconhecido noutro sítio do texto (ex.: "Ana Costa e
  // João Silva") quer dizer que o evento tem mais do que uma pessoa.
  const outraPessoa = considerados.some(
    (c) =>
      c !== vencedor &&
      (c.ocorrencia.fim < vencedor.ocorrencia.inicio || c.ocorrencia.inicio > vencedor.ocorrencia.fim)
  )
  return outraPessoa ? null : vencedor.cliente
}
