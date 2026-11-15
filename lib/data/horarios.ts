export const DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

// Blocos de meia em meia hora, das 7h às 22h (o último bloco é o das
// 21:30–22:00). Cada bloco guarda-se pela hora a que COMEÇA ("label"),
// mas mostra-se sempre como intervalo ("intervalo", ex.: "20:30–21:00"):
// só com a hora de início, a última linha de um turno até às 21:00
// lia-se "20:30" e parecia que acabava aí.
const HORA_INICIO = 7
const HORA_FIM = 22

const hhmm = (totalMin: number) =>
  `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`

export const BLOCOS_HORARIO: { hora: number; minuto: number; label: string; intervalo: string }[] = Array.from(
  { length: (HORA_FIM - HORA_INICIO) * 2 },
  (_, i) => {
    const hora = HORA_INICIO + Math.floor(i / 2)
    const minuto = i % 2 === 0 ? 0 : 30
    const inicio = hora * 60 + minuto
    return { hora, minuto, label: hhmm(inicio), intervalo: `${hhmm(inicio)}–${hhmm(inicio + 30)}` }
  }
)

const CHAVES_DE_BLOCO = new Set(BLOCOS_HORARIO.map((b) => `${b.hora}_${b.minuto}`))

// true se a chave de um slot ("AAAA-MM-DD_hora_minuto") corresponde a um
// bloco que a grelha mostra. Um turno gravado fora da grelha não se
// mostra nem se volta a gravar.
export function slotDentroDaGrelha(chave: string): boolean {
  return CHAVES_DE_BLOCO.has(chave.slice(chave.indexOf('_') + 1))
}

export function chaveBloco(hora: number, minuto: number) {
  return `${hora}-${minuto}`
}

// Usada tanto por Server Components (para montar o objeto "slots") como
// pelo GrelhaHorarios ("use client") — tem de viver num ficheiro sem
// "use client", senão o servidor não pode chamá-la diretamente (só pode
// renderizá-la ou passá-la como prop).
export function chaveSlot(data: string, hora: number, minuto: number) {
  return `${data}_${hora}_${minuto}`
}

export function inicioDaSemana(dataISO: string): string {
  const d = new Date(`${dataISO}T00:00:00`)
  const dow = d.getDay() // 0 = domingo
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

export function somarDias(dataISO: string, dias: number): string {
  const d = new Date(`${dataISO}T00:00:00`)
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

export function diasDaSemana(inicioISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => somarDias(inicioISO, i))
}
