import { somarDias } from '@/lib/data/horarios'
import { PALETA } from '@/lib/data/constantes'
import { normalizarTexto } from '@/lib/texto'
import type { EstadoEventoAgenda, RepeticaoSerieAgenda, TipoEventoAgenda } from '@/lib/supabase/database.types'

export const TIPOS_EVENTO_AGENDA: TipoEventoAgenda[] = [
  'Treino',
  'Sessão experimental',
  'Avaliação',
  'Reunião',
  'Outro',
]

const COR_TIPO_EVENTO: Record<TipoEventoAgenda, keyof typeof PALETA> = {
  Treino: 'teal',
  'Sessão experimental': 'teal',
  Avaliação: 'azul',
  Reunião: 'roxo',
  Outro: 'neutro',
}

export function corTipoEvento(tipo: TipoEventoAgenda) {
  return PALETA[COR_TIPO_EVENTO[tipo]]
}

// "SE - Nome" é só a forma de apresentar — o que fica guardado em
// "titulo" é sempre o nome, nunca o prefixo.
export function rotuloTipoEvento(tipo: TipoEventoAgenda, titulo: string | null): string {
  if (tipo === 'Sessão experimental' && titulo) return `SE - ${titulo}`
  return titulo ?? tipo
}

export type Repeticao = 'nao' | 'semanal' | 'quinzenal'
export type LimiteRepeticao =
  | { modo: 'ate'; ate: string }
  | { modo: 'vezes'; vezes: number }
  // "Até eu interromper" — nunca se gera "para sempre" de uma vez: cria-se
  // só a janela inicial (até HORIZONTE_INDEFINIDO_DIAS) e o cron diário
  // (/api/cron/agenda-series) vai estendendo essa janela, sempre com o
  // mesmo horizonte à frente, enquanto a série em agenda_series continuar
  // "ativa" — ver gerarExtensaoSerie.
  | { modo: 'indefinido' }

// Nunca gera mais do que isto numa só vez — evita que um "até" muito
// distante no futuro, por engano, crie centenas de linhas de uma vez.
const MAX_OCORRENCIAS = 52

// Janela de ocorrências já criadas à frente, para uma série indefinida —
// dá folga suficiente para a pessoa ver e gerir as próximas marcações
// sem o cron ter de correr a cada pedido.
const HORIZONTE_INDEFINIDO_DIAS = 90

// Expande "repete toda a semana/quinzena até Y", "N vezes" ou
// "indefinidamente" numa lista de datas. Cada data vira depois uma linha
// própria em agenda_eventos, ligada por serie_id — por isso só é preciso
// calcular isto uma vez, ao criar o evento, nunca ao mostrar a agenda.
export function gerarOcorrencias(
  dataInicial: string,
  repeticao: Repeticao,
  limite: LimiteRepeticao
): string[] {
  if (repeticao === 'nao') return [dataInicial]

  const passo = repeticao === 'semanal' ? 7 : 14
  const datas: string[] = []
  let cursor = dataInicial

  if (limite.modo === 'vezes') {
    const total = Math.max(1, Math.min(limite.vezes, MAX_OCORRENCIAS))
    for (let i = 0; i < total; i++) {
      datas.push(cursor)
      cursor = somarDias(cursor, passo)
    }
    return datas
  }

  const ateData = limite.modo === 'ate' ? limite.ate : somarDias(dataInicial, HORIZONTE_INDEFINIDO_DIAS)
  while (cursor <= ateData && datas.length < MAX_OCORRENCIAS) {
    datas.push(cursor)
    cursor = somarDias(cursor, passo)
  }
  return datas
}

// Só para o cron: dada a última data já gerada de uma série indefinida
// ainda ativa, devolve as datas novas precisas para a janela voltar a
// chegar ao horizonte de hoje — lista vazia quando já lá está (nada a
// fazer nessa série, nesse dia).
export function gerarExtensaoSerie(
  ultimaDataGerada: string,
  repeticao: RepeticaoSerieAgenda,
  hoje: string
): string[] {
  const passo = repeticao === 'semanal' ? 7 : 14
  const ateData = somarDias(hoje, HORIZONTE_INDEFINIDO_DIAS)
  const datas: string[] = []
  let cursor = somarDias(ultimaDataGerada, passo)
  while (cursor <= ateData && datas.length < MAX_OCORRENCIAS) {
    datas.push(cursor)
    cursor = somarDias(cursor, passo)
  }
  return datas
}

// Usada pelo cron de presenças (app/api/cron/presencas-agenda) para
// decidir quando um evento passa a "Concluído", e pelas ações de
// mover/redimensionar/editar (app/painel/[estudio]/agenda/actions.ts)
// para repor "Agendado" sempre que um evento já concluído é levado
// para uma data/hora cujo fim ainda não chegou — senão fica preso em
// "Concluído" com uma data no futuro.
export function eventoJaTerminou(data: string, horaInicio: string, duracaoMin: number): boolean {
  const fim = new Date(`${data}T${horaInicio.slice(0, 5)}:00`)
  fim.setMinutes(fim.getMinutes() + duracaoMin)
  return fim.getTime() <= Date.now()
}

export type EventoPesquisavel = {
  id: string
  data: string
  hora_inicio: string
  duracao_min: number
  tipo: TipoEventoAgenda
  titulo: string | null
  estado: EstadoEventoAgenda
  nota: string | null
  cliente: { nome: string; nome_preferido: string | null; numero_socio: string | null } | null
  pt: { nome: string } | null
}

// As palavras de uma pesquisa, sem acentos nem maiúsculas.
export function palavrasDaPesquisa(texto: string): string[] {
  return normalizarTexto(texto).split(/[\s,;]+/).filter(Boolean)
}

// Encontra por palavras, em qualquer ordem: "Maria Garcia" encontra
// "Maria João Garcia", e "João Maria" encontra "Maria João". Cada
// palavra escrita tem de aparecer em algum dos campos (sem acentos nem
// maiúsculas; basta o início ou um pedaço da palavra).
export function correspondePalavras(palavras: string[], campos: (string | null | undefined)[]): boolean {
  if (palavras.length === 0) return false
  const tudo = normalizarTexto(campos.filter(Boolean).join(' '))
  return palavras.every((p) => tudo.includes(p))
}

// Pesquisa na agenda: compara as palavras escritas (em qualquer ordem,
// ver correspondePalavras) com tudo o que pode identificar um evento —
// nome e nº de sócio do cliente, nome do instrutor, título (Reunião/
// Outro/Sessão experimental) e nota — para "pesquisar o nome de um
// cliente" encontrar todos os eventos dele, sejam de que tipo forem.
export function pesquisarEventosAgenda<T extends EventoPesquisavel>(eventos: T[], texto: string): T[] {
  const palavras = palavrasDaPesquisa(texto.trim())
  if (palavras.length === 0) return []
  return eventos.filter((e) =>
    correspondePalavras(palavras, [
      e.cliente?.nome,
      e.cliente?.nome_preferido,
      e.cliente?.numero_socio,
      e.pt?.nome,
      e.titulo,
      e.nota,
      rotuloTipoEvento(e.tipo, e.titulo),
    ])
  )
}

// ── Mover uma série ao arrastar ──────────────────────────────────────

// Dias entre duas datas (b − a).
export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

export type OcorrenciaDaSerie = { id: string; data: string; hora_inicio: string; duracao_min: number; estado: EstadoEventoAgenda }

// As ocorrências de uma série que um arrasto "este e os seguintes" ou
// "toda a série" deve mudar, e a data nova de cada uma (a mesma
// deslocação de dias do evento arrastado — ex.: de terça para segunda,
// todas um dia antes). As que já aconteceram (ou foram desmarcadas)
// ficam como estão: são histórico.
export function ocorrenciasAMover(
  ocorrencias: OcorrenciaDaSerie[],
  escopo: 'seguintes' | 'serie',
  dataArrastada: string,
  dataNova: string,
  terminou: (o: OcorrenciaDaSerie) => boolean = (o) => eventoJaTerminou(o.data, o.hora_inicio, o.duracao_min)
): { id: string; dataNova: string }[] {
  const deslocacao = diasEntre(dataArrastada, dataNova)
  return ocorrencias
    .filter((o) => (escopo === 'serie' || o.data >= dataArrastada) && o.estado !== 'Cancelado' && !terminou(o))
    .map((o) => ({ id: o.id, dataNova: somarDias(o.data, deslocacao) }))
}
