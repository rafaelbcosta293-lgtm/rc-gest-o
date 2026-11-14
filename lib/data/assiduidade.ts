import { feriadosObrigatorios, type Feriado } from './feriados'

// Feriado municipal de cada estúdio: Fátima pertence ao concelho de
// Ourém (20 de junho), Leiria tem o seu a 22 de maio.
const FERIADO_MUNICIPAL: Record<string, { mes: number; dia: number; nome: string }> = {
  fatima: { mes: 6, dia: 20, nome: 'Feriado municipal (Ourém)' },
  leiria: { mes: 5, dia: 22, nome: 'Feriado municipal (Leiria)' },
}

export const DIA_ABERTURA_FECHO = 25
export const HORAS_DIARIAS_OMISSAO = 8

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

// "Hoje" em Portugal — o servidor corre em UTC, e entre a meia-noite e
// a 1h (no verão) ainda daria o dia anterior.
export function hojeLisboa(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(agora)
}

export function feriadosDoEstudio(slug: string, ano: number): Feriado[] {
  const lista = [...feriadosObrigatorios(ano)]
  const municipal = FERIADO_MUNICIPAL[slug]
  if (municipal) lista.push({ data: `${ano}-${pad2(municipal.mes)}-${pad2(municipal.dia)}`, nome: municipal.nome })
  return lista.sort((a, b) => a.data.localeCompare(b.data))
}

export function feriadoNoEstudio(dataISO: string, slug: string): Feriado | null {
  return feriadosDoEstudio(slug, Number(dataISO.slice(0, 4))).find((f) => f.data === dataISO) ?? null
}

// 0 = domingo … 6 = sábado (em UTC, para não depender do fuso do servidor).
export function diaDaSemana(dataISO: string): number {
  return new Date(`${dataISO}T00:00:00Z`).getUTCDay()
}

export function ehSabado(dataISO: string): boolean {
  return diaDaSemana(dataISO) === 6
}

// Dia útil = segunda a sexta, fora dos feriados nacionais e do municipal.
export function ehDiaUtil(dataISO: string, slug: string): boolean {
  const d = diaDaSemana(dataISO)
  return d >= 1 && d <= 5 && !feriadoNoEstudio(dataISO, slug)
}

export function diasDoMesISO(ano: number, mes: number): string[] {
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  return Array.from({ length: ultimo }, (_, i) => `${ano}-${pad2(mes)}-${pad2(i + 1)}`)
}

export function diasUteisDoMes(ano: number, mes: number, slug: string): string[] {
  return diasDoMesISO(ano, mes).filter((d) => ehDiaUtil(d, slug))
}

export function diasUteisEm(dias: string[], slug: string): number {
  return dias.filter((d) => ehDiaUtil(d, slug)).length
}

function minutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

export function horasEntre(entrada: string | null, saida: string | null): number {
  if (!entrada || !saida) return 0
  return Math.max(0, minutos(saida) - minutos(entrada)) / 60
}

export type TurnosDia = {
  entrada_1: string | null
  saida_1: string | null
  entrada_2: string | null
  saida_2: string | null
}

export function horasDoDia(t: TurnosDia): number {
  return horasEntre(t.entrada_1, t.saida_1) + horasEntre(t.entrada_2, t.saida_2)
}

// Valida os turnos de um dia antes de gravar — devolve a mensagem de erro
// ou null. As mesmas regras estão na base de dados (registos_horario).
export function erroTurnos(t: TurnosDia): string | null {
  const pares: [string | null, string | null, string][] = [
    [t.entrada_1, t.saida_1, '1.º turno'],
    [t.entrada_2, t.saida_2, '2.º turno'],
  ]
  for (const [e, s, nome] of pares) {
    if (!!e !== !!s) return `${nome}: indica a entrada e a saída.`
    if (e && s && minutos(s) <= minutos(e)) return `${nome}: a saída tem de ser depois da entrada.`
  }
  if (!t.entrada_1 && !t.entrada_2) return 'Indica pelo menos um turno.'
  if (t.saida_1 && t.entrada_2 && minutos(t.entrada_2) < minutos(t.saida_1)) {
    return 'O 2.º turno tem de começar depois do fim do 1.º.'
  }
  return null
}

// 6.5 → "6h30"; com sinal: "+6h30" / "-2h15".
export function formatarHoras(horas: number, comSinal = false): string {
  const totalMin = Math.round(Math.abs(horas) * 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  const texto = `${h}h${pad2(m)}`
  if (!comSinal) return horas < 0 ? `-${texto}` : texto
  if (totalMin === 0) return '0h00'
  return `${horas > 0 ? '+' : '-'}${texto}`
}

export type ResumoMes = {
  diasUteis: number
  diasTrabalhados: number
  diasFerias: string[]
  diasSemRegisto: string[]
  faltas: number
  horasDiarias: number
  horasEsperadas: number
  horasRealizadas: number
  saldo: number
  horasExtra: number
}

// Regras do mês: só segunda a sexta (fora de feriados) contam como dias
// trabalhados; as horas de sábado (ou de qualquer outro dia) somam só às
// horas realizadas. Os dias de férias descontam à meta:
//   horas esperadas = (dias úteis − dias de férias) × horas diárias
export function calcularResumoMes({
  ano,
  mes,
  slug,
  horasDiarias,
  registos,
  diasFerias,
  ateDia,
}: {
  ano: number
  mes: number
  slug: string
  horasDiarias: number
  registos: { data: string; horas: number }[]
  diasFerias: string[]
  ateDia?: string
}): ResumoMes {
  const uteis = diasUteisDoMes(ano, mes, slug)
  const prefixo = `${ano}-${pad2(mes)}-`
  const doMes = registos.filter((r) => r.data.startsWith(prefixo))
  const trabalhados = new Set(doMes.filter((r) => r.horas > 0 && ehDiaUtil(r.data, slug)).map((r) => r.data))
  const ferias = Array.from(new Set(diasFerias))
    .filter((d) => d.startsWith(prefixo) && ehDiaUtil(d, slug) && !trabalhados.has(d))
    .sort()
  const feriasSet = new Set(ferias)
  const semRegisto = uteis.filter((d) => !trabalhados.has(d) && !feriasSet.has(d) && (!ateDia || d <= ateDia))
  const horasRealizadas = Math.round(doMes.reduce((s, r) => s + r.horas, 0) * 100) / 100
  const horasEsperadas = Math.round((uteis.length - ferias.length) * horasDiarias * 100) / 100
  const saldo = Math.round((horasRealizadas - horasEsperadas) * 100) / 100
  return {
    diasUteis: uteis.length,
    diasTrabalhados: trabalhados.size,
    diasFerias: ferias,
    diasSemRegisto: semRegisto,
    faltas: Math.max(0, uteis.length - trabalhados.size - ferias.length),
    horasDiarias,
    horasEsperadas,
    horasRealizadas,
    saldo,
    horasExtra: Math.max(0, saldo),
  }
}

// O fecho de um mês abre a partir do dia 25 desse mês; um mês já
// passado (que ficou por submeter) pode ser fechado em qualquer altura.
export function fechoDisponivel(hojeISO: string, ano: number, mes: number): boolean {
  const atual = hojeISO.slice(0, 7)
  const alvo = `${ano}-${pad2(mes)}`
  if (alvo < atual) return true
  if (alvo > atual) return false
  return Number(hojeISO.slice(8, 10)) >= DIA_ABERTURA_FECHO
}

export type BloqueioFerias = { inicio: string; fim: string; estudio_id: number | null; motivo: string }

// Porque é que um dia não pode ser escolhido para férias — ou null se pode.
export function motivoBloqueioFerias(
  dataISO: string,
  {
    slug,
    estudioId,
    bloqueios,
    outrosDeFerias,
    limiteSimultaneo,
  }: {
    slug: string
    estudioId: number
    bloqueios: BloqueioFerias[]
    outrosDeFerias: Map<string, number>
    limiteSimultaneo: number | null
  }
): string | null {
  if (!ehDiaUtil(dataISO, slug)) {
    const feriado = feriadoNoEstudio(dataISO, slug)
    return feriado ? feriado.nome : 'Fim de semana'
  }
  const regra = bloqueios.find(
    (b) => dataISO >= b.inicio && dataISO <= b.fim && (b.estudio_id === null || b.estudio_id === estudioId)
  )
  if (regra) return regra.motivo
  const ocupados = outrosDeFerias.get(dataISO) ?? 0
  if (limiteSimultaneo !== null && ocupados >= limiteSimultaneo) {
    return `Limite de ${limiteSimultaneo} instrutor${limiteSimultaneo === 1 ? '' : 'es'} de férias em simultâneo`
  }
  return null
}

// "12/08 a 16/08" (ou só "12/08" para um dia) — para avisos e listas.
export function intervaloDias(dias: string[]): string {
  if (dias.length === 0) return ''
  const ordenados = [...dias].sort()
  const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
  const primeiro = ordenados[0]
  const ultimo = ordenados[ordenados.length - 1]
  return primeiro === ultimo ? fmt(primeiro) : `${fmt(primeiro)} a ${fmt(ultimo)}`
}
