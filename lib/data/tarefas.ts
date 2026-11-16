import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { idsContasPartilhadas } from './contasPartilhadas'
import { inicioDaSemana } from './horarios'

export type EstadoTarefa = 'por_fazer' | 'em_curso' | 'feito'

export const ESTADOS_TAREFA: { valor: EstadoTarefa; rotulo: string }[] = [
  { valor: 'por_fazer', rotulo: 'Por fazer' },
  { valor: 'em_curso', rotulo: 'Em curso' },
  { valor: 'feito', rotulo: 'Feito' },
]

export type Tarefa = {
  id: string
  titulo: string
  descricao: string | null
  lista: string | null
  estudio_id: number | null
  responsavel_id: string | null
  prazo: string | null
  estado: EstadoTarefa
  foco_semana: string | null
  reservada: boolean
  // Hora do prazo ("HH:MM:SS") e data de início, ambas opcionais.
  hora: string | null
  inicio: string | null
  prioridade: Prioridade | null
  etiquetas: string[]
  // Subtarefa de outra tarefa.
  tarefa_mae_id: string | null
  // Dias da semana em que se repete (1 = segunda … 7 = domingo).
  repete_dias: number[] | null
  // Repete todos os meses, no dia do prazo (ou no mesmo dia da semana,
  // ex.: 1.ª segunda-feira, com repete_mensal_dia_semana).
  repete_mensal: boolean
  repete_mensal_dia_semana: boolean
  repete_anual: boolean
  // "Periodicamente": N dias depois de ser concluída.
  repete_apos_dias: number | null
  // De quantas em quantas semanas/meses/anos (1 = todas).
  repete_intervalo: number
  // A repetição acaba nesta data.
  repete_ate: string | null
  concluida_em: string | null
  // Quem executou a tarefa (indicado ao concluir).
  feita_por: string | null
  criado_em: string
}

export type Prioridade = 'baixa' | 'media' | 'alta'
export const PRIORIDADES: { valor: Prioridade; rotulo: string }[] = [
  { valor: 'alta', rotulo: 'Alta' },
  { valor: 'media', rotulo: 'Média' },
  { valor: 'baixa', rotulo: 'Baixa' },
]

export const COLUNAS_TAREFA =
  'id, titulo, descricao, lista, estudio_id, responsavel_id, prazo, hora, inicio, prioridade, etiquetas, tarefa_mae_id, estado, foco_semana, reservada, repete_dias, repete_mensal, repete_mensal_dia_semana, repete_anual, repete_apos_dias, repete_intervalo, repete_ate, concluida_em, feita_por, criado_em'

// Cada pessoa escolhe no máximo estas tarefas para a semana — a ideia do
// foco é obrigar a escolher, não fazer uma segunda lista de tudo.
export const MAX_FOCO_POR_PESSOA = 3
// As feitas ficam à vista durante estes dias; depois saem do ecrã (não
// se apagam).
export const DIAS_FEITAS_VISIVEIS = 14
// Uma tarefa sem prazo parada há mais do que isto fica assinalada.
export const DIAS_TAREFA_PARADA = 30

// ── Tarefas que se repetem ───────────────────────────────────────────
// Como no Asana: ao concluir uma tarefa que se repete, nasce a seguinte
// com o próximo prazo (ver app/painel/tarefasActions.ts).

export const DIAS_DA_SEMANA = [
  { valor: 1, curto: 'seg' },
  { valor: 2, curto: 'ter' },
  { valor: 3, curto: 'qua' },
  { valor: 4, curto: 'qui' },
  { valor: 5, curto: 'sex' },
  { valor: 6, curto: 'sáb' },
  { valor: 7, curto: 'dom' },
]

// As escolhas do formulário. "dias" usa as caixas dos dias da semana.
export const REPETICOES_TAREFA: { valor: string; rotulo: string; dias?: number[] }[] = [
  { valor: 'nao', rotulo: 'Não se repete' },
  { valor: 'uteis', rotulo: 'Dias úteis (seg a sex)', dias: [1, 2, 3, 4, 5] },
  { valor: 'seg-sab', rotulo: 'Segunda a sábado', dias: [1, 2, 3, 4, 5, 6] },
  { valor: 'todos', rotulo: 'Todos os dias', dias: [1, 2, 3, 4, 5, 6, 7] },
  { valor: 'dias', rotulo: 'Semanal — dias à escolha' },
  { valor: 'mensal', rotulo: 'Mensal — no dia do prazo' },
  { valor: 'mensal-semana', rotulo: 'Mensal — no mesmo dia da semana' },
  { valor: 'anual', rotulo: 'Anual' },
  { valor: 'apos', rotulo: 'Periódica — dias depois de concluir' },
]

export type Repeticao = Pick<
  Tarefa,
  'repete_dias' | 'repete_mensal' | 'repete_mensal_dia_semana' | 'repete_anual' | 'repete_apos_dias' | 'repete_intervalo' | 'repete_ate'
>

export const SEM_REPETICAO: Repeticao = {
  repete_dias: null,
  repete_mensal: false,
  repete_mensal_dia_semana: false,
  repete_anual: false,
  repete_apos_dias: null,
  repete_intervalo: 1,
  repete_ate: null,
}

export function repeteSe(t: Partial<Repeticao>): boolean {
  return !!t.repete_mensal || !!t.repete_anual || !!t.repete_apos_dias || (t.repete_dias?.length ?? 0) > 0
}

// Que escolha do formulário corresponde a esta tarefa.
export function escolhaDeRepeticao(t: Partial<Repeticao>): string {
  if (t.repete_mensal) return t.repete_mensal_dia_semana ? 'mensal-semana' : 'mensal'
  if (t.repete_anual) return 'anual'
  if (t.repete_apos_dias) return 'apos'
  const dias = [...(t.repete_dias ?? [])].sort().join(',')
  if (!dias) return 'nao'
  if ((t.repete_intervalo ?? 1) > 1) return 'dias'
  return REPETICOES_TAREFA.find((r) => r.dias?.join(',') === dias)?.valor ?? 'dias'
}

const dataPt = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

// "dias úteis", "seg e sex", "de 2 em 2 semanas: seg", "todos os meses",
// "na 1.ª seg do mês", "todos os anos", "7 dias depois de concluir"…
export function descricaoRepeticao(t: Partial<Repeticao> & { prazo?: string | null }): string | null {
  const n = t.repete_intervalo ?? 1
  let texto: string | null = null
  if (t.repete_apos_dias) texto = `${t.repete_apos_dias} dia${t.repete_apos_dias === 1 ? '' : 's'} depois de concluir`
  else if (t.repete_anual) texto = n > 1 ? `de ${n} em ${n} anos` : 'todos os anos'
  else if (t.repete_mensal) {
    const cada = n > 1 ? `de ${n} em ${n} meses` : 'todos os meses'
    if (t.repete_mensal_dia_semana && t.prazo) {
      const ordem = Math.ceil(Number(t.prazo.slice(8, 10)) / 7)
      const dia = DIAS_DA_SEMANA[diaDaSemanaISO(t.prazo) - 1].curto
      texto = `${ordem >= 5 ? 'último' : `${ordem}.º`} ${dia} do mês${n > 1 ? `, ${cada}` : ''}`
    } else texto = cada
  } else {
    const dias = [...(t.repete_dias ?? [])].sort()
    if (dias.length === 0) return null
    const chave = dias.join(',')
    const nomes = dias.map((d) => DIAS_DA_SEMANA[d - 1].curto)
    const quais =
      chave === '1,2,3,4,5'
        ? 'dias úteis'
        : chave === '1,2,3,4,5,6'
          ? 'seg a sáb'
          : chave === '1,2,3,4,5,6,7'
            ? 'todos os dias'
            : nomes.length === 1
              ? nomes[0]
              : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
    texto = n > 1 ? `de ${n} em ${n} semanas: ${quais}` : nomes.length === 1 && chave.length === 1 ? `${quais}, todas as semanas` : quais
  }
  return t.repete_ate ? `${texto}, até ${dataPt(t.repete_ate)}` : texto
}

const UM_DIA_MS = 86_400_000
const paraISO = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const deISO = (iso: string) => Date.parse(`${iso}T00:00:00Z`)

// 1 = segunda … 7 = domingo.
export function diaDaSemanaISO(dataISO: string): number {
  return new Date(deISO(dataISO)).getUTCDay() || 7
}

// O primeiro dia, a partir de "desde" (inclusive), que calha num dos
// dias da semana pedidos.
export function primeiroDiaEm(dias: number[], desde: string): string {
  let ms = deISO(desde)
  for (let i = 0; i < 7 && !dias.includes(diaDaSemanaISO(paraISO(ms))); i++) ms += UM_DIA_MS
  return paraISO(ms)
}

const segundaDe = (iso: string) => deISO(iso) - (diaDaSemanaISO(iso) - 1) * UM_DIA_MS
const ultimoDia = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate()

// O mesmo dia, N meses à frente; um prazo no último dia do mês passa
// para o último dia do mês de destino (31/01 → 28/02 → 31/03).
function somarMeses(iso: string, n: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  const total = ano * 12 + (mes - 1) + n
  const novoAno = Math.floor(total / 12)
  const novoMes = (total % 12) + 1
  const ultimoDestino = ultimoDia(novoAno, novoMes)
  const novoDia = dia === ultimoDia(ano, mes) ? ultimoDestino : Math.min(dia, ultimoDestino)
  return paraISO(Date.UTC(novoAno, novoMes - 1, novoDia))
}

// O mesmo "n-ésimo dia da semana" (ex.: 2.ª terça), N meses à frente; a
// 5.ª vez de um mês conta como "a última".
function somarMesesPeloDiaDaSemana(iso: string, n: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  const ordem = Math.ceil(dia / 7)
  const total = ano * 12 + (mes - 1) + n
  const novoAno = Math.floor(total / 12)
  const novoMes = (total % 12) + 1
  const primeiro = primeiroDiaEm([diaDaSemanaISO(iso)], paraISO(Date.UTC(novoAno, novoMes - 1, 1)))
  let alvo = Number(primeiro.slice(8, 10)) + (ordem - 1) * 7
  while (alvo > ultimoDia(novoAno, novoMes)) alvo -= 7
  return paraISO(Date.UTC(novoAno, novoMes - 1, alvo))
}

// A vez a seguir a "data" no calendário de uma tarefa que se repete —
// sem olhar para o dia de hoje. (Na repetição "N dias depois de
// concluir" conta-se a partir da data dada.)
function vezSeguinte(t: Repeticao, data: string): string {
  const n = Math.max(1, t.repete_intervalo ?? 1)
  if (t.repete_apos_dias) return paraISO(deISO(data) + t.repete_apos_dias * UM_DIA_MS)
  if (t.repete_anual) return somarMeses(data, 12 * n)
  if (t.repete_mensal) return t.repete_mensal_dia_semana ? somarMesesPeloDiaDaSemana(data, n) : somarMeses(data, n)
  // Dias da semana, de N em N semanas: na mesma semana ainda valem os
  // dias que faltam; depois salta-se N semanas.
  const dias = t.repete_dias ?? []
  const semana = segundaDe(data)
  for (let k = 1; k <= 7 * (n + 1); k++) {
    const candidata = paraISO(deISO(data) + k * UM_DIA_MS)
    const semanasDepois = Math.round((segundaDe(candidata) - semana) / (7 * UM_DIA_MS))
    if (dias.includes(diaDaSemanaISO(candidata)) && semanasDepois % n === 0) return candidata
  }
  return paraISO(deISO(data) + 7 * n * UM_DIA_MS)
}

// O prazo da vez seguinte de uma tarefa que se repete, ou null se não
// se repete (ou se a repetição já acabou). É sempre depois de hoje:
// concluir com atraso uma tarefa diária não cria uma fila de dias que já
// passaram.
export function proximaOcorrencia(t: Repeticao & Pick<Tarefa, 'prazo'>, hoje: string): string | null {
  if (!repeteSe(t)) return null
  let seguinte: string
  if (t.repete_apos_dias) seguinte = vezSeguinte(t, hoje)
  else {
    seguinte = vezSeguinte(t, t.prazo ?? hoje)
    for (let i = 0; i < 5000 && seguinte <= hoje; i++) seguinte = vezSeguinte(t, seguinte)
  }
  return t.repete_ate && seguinte > t.repete_ate ? null : seguinte
}

// As vezes seguintes de uma tarefa que se repete, entre duas datas — as
// que ainda não existem (só nascem quando a anterior é concluída), para
// o calendário as poder mostrar como previstas.
export function ocorrenciasPrevistas(t: Repeticao & Pick<Tarefa, 'prazo'>, de: string, ate: string): string[] {
  if (!repeteSe(t) || !t.prazo) return []
  const fim = t.repete_ate && t.repete_ate < ate ? t.repete_ate : ate
  const datas: string[] = []
  let atual = t.prazo
  for (let i = 0; i < 800; i++) {
    atual = vezSeguinte(t, atual)
    if (atual > fim) break
    if (atual >= de) datas.push(atual)
  }
  return datas
}

// ── Estatísticas (painel) ────────────────────────────────────────────

export type TarefaFeita = Pick<
  Tarefa,
  'id' | 'titulo' | 'lista' | 'estudio_id' | 'responsavel_id' | 'prazo' | 'concluida_em' | 'feita_por' | 'criado_em'
>

const SEMANAS_NO_PAINEL = 8

// O dia (em Portugal) em que uma tarefa foi concluída.
function diaDeConclusao(concluidaEm: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date(concluidaEm))
}

export type EstatisticasTarefas = {
  abertas: number
  emAtraso: number
  paraHoje: number
  semPrazo: number
  feitas7: number
  feitas30: number
  // Das concluídas nos últimos 30 dias que tinham prazo: quantas dentro dele.
  comPrazo30: number
  noPrazo30: number
  // Concluídas por semana (segunda a domingo), da mais antiga para a atual.
  porSemana: { inicio: string; total: number }[]
  porPessoa: { id: string | null; abertas: number; emAtraso: number; feitas30: number }[]
  // Quem executou as tarefas concluídas (o nome indicado ao concluir).
  porQuemFez: { id: string | null; feitas7: number; feitas30: number }[]
  porLista: { lista: string | null; abertas: number; feitas30: number }[]
  // As tarefas abertas há mais tempo (sem contar as rotinas que se repetem).
  maisAntigas: Tarefa[]
}

export function estatisticasTarefas(abertas: Tarefa[], feitas: TarefaFeita[], hoje: string): EstatisticasTarefas {
  const ha = (dias: number) => paraISO(deISO(hoje) - dias * UM_DIA_MS)
  const comDia = feitas.filter((f) => f.concluida_em).map((f) => ({ ...f, dia: diaDeConclusao(f.concluida_em!) }))
  const feitas30 = comDia.filter((f) => f.dia > ha(30))
  const comPrazo30 = feitas30.filter((f) => f.prazo)

  const estaSemana = inicioDaSemana(hoje)
  const porSemana = Array.from({ length: SEMANAS_NO_PAINEL }, (_, i) => {
    const inicio = paraISO(deISO(estaSemana) - (SEMANAS_NO_PAINEL - 1 - i) * 7 * UM_DIA_MS)
    const fim = paraISO(deISO(inicio) + 6 * UM_DIA_MS)
    return { inicio, total: comDia.filter((f) => f.dia >= inicio && f.dia <= fim).length }
  })

  const pessoas = new Map<string | null, { abertas: number; emAtraso: number; feitas30: number }>()
  const listas = new Map<string | null, { abertas: number; feitas30: number }>()
  const daPessoa = (id: string | null) => pessoas.get(id) ?? pessoas.set(id, { abertas: 0, emAtraso: 0, feitas30: 0 }).get(id)!
  const daLista = (lista: string | null) => listas.get(lista) ?? listas.set(lista, { abertas: 0, feitas30: 0 }).get(lista)!
  for (const t of abertas) {
    daPessoa(t.responsavel_id).abertas++
    if (t.prazo && t.prazo < hoje) daPessoa(t.responsavel_id).emAtraso++
    daLista(t.lista).abertas++
  }
  const quemFez = new Map<string | null, { feitas7: number; feitas30: number }>()
  for (const f of feitas30) {
    daPessoa(f.responsavel_id).feitas30++
    daLista(f.lista).feitas30++
    const linha = quemFez.get(f.feita_por) ?? quemFez.set(f.feita_por, { feitas7: 0, feitas30: 0 }).get(f.feita_por)!
    linha.feitas30++
    if (f.dia > ha(7)) linha.feitas7++
  }

  return {
    abertas: abertas.length,
    emAtraso: abertas.filter((t) => t.prazo && t.prazo < hoje).length,
    paraHoje: abertas.filter((t) => t.prazo === hoje).length,
    semPrazo: abertas.filter((t) => !t.prazo).length,
    feitas7: comDia.filter((f) => f.dia > ha(7)).length,
    feitas30: feitas30.length,
    comPrazo30: comPrazo30.length,
    noPrazo30: comPrazo30.filter((f) => f.dia <= f.prazo!).length,
    porSemana,
    porPessoa: [...pessoas.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.abertas - a.abertas || b.feitas30 - a.feitas30),
    porQuemFez: [...quemFez.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.feitas30 - a.feitas30),
    porLista: [...listas.entries()].map(([lista, v]) => ({ lista, ...v })).sort((a, b) => b.abertas - a.abertas || b.feitas30 - a.feitas30),
    maisAntigas: abertas
      .filter((t) => !repeteSe(t))
      .sort((a, b) => a.criado_em.localeCompare(b.criado_em))
      .slice(0, 5),
  }
}

// As concluídas nas últimas semanas (para o painel) — só as colunas
// precisas para contar.
export async function carregarTarefasFeitas(supabase: SupabaseClient, hoje: string): Promise<TarefaFeita[]> {
  const desde = new Date(deISO(inicioDaSemana(hoje)) - (SEMANAS_NO_PAINEL - 1) * 7 * UM_DIA_MS).toISOString()
  const { data, error } = await supabase
    .from('tarefas')
    .select('id, titulo, lista, estudio_id, responsavel_id, prazo, concluida_em, feita_por, criado_em')
    .eq('estado', 'feito')
    .is('tarefa_mae_id', null)
    .gte('concluida_em', desde)
    .limit(5000)
  if (error) throw new Error(error.message)
  return (data ?? []) as TarefaFeita[]
}

export function idadeEmDias(criadoEm: string, hoje: string): number {
  const inicio = Date.parse(`${criadoEm.slice(0, 10)}T00:00:00Z`)
  const fim = Date.parse(`${hoje}T00:00:00Z`)
  return Math.max(0, Math.round((fim - inicio) / 86_400_000))
}

// "hoje", "há 1 dia", "há 12 dias", "há 3 meses".
export function haQuantoTempo(dias: number): string {
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'há 1 dia'
  if (dias < 60) return `há ${dias} dias`
  return `há ${Math.floor(dias / 30)} meses`
}

export function emFoco(t: Pick<Tarefa, 'foco_semana' | 'estado'>, hoje: string): boolean {
  return t.estado !== 'feito' && t.foco_semana === inicioDaSemana(hoje)
}

export type GruposDeTarefas = {
  // Escolhidas para esta semana.
  foco: Tarefa[]
  // Prazo já passado ou para hoje.
  urgentes: Tarefa[]
  // Com prazo mais à frente, da mais próxima para a mais distante.
  proximas: Tarefa[]
  // Sem prazo — "para ir fazendo" — da mais antiga para a mais recente,
  // para as que estão há mais tempo à espera não afundarem.
  paraIrFazendo: Tarefa[]
  // Concluídas há pouco, da mais recente para a mais antiga.
  feitas: Tarefa[]
}

// Arruma as tarefas pelas secções do ecrã. Cada tarefa aparece numa só
// (uma tarefa em foco não se repete mais abaixo).
export function agruparTarefas(tarefas: Tarefa[], hoje: string): GruposDeTarefas {
  const grupos: GruposDeTarefas = { foco: [], urgentes: [], proximas: [], paraIrFazendo: [], feitas: [] }
  const limiteFeitas = Date.parse(`${hoje}T00:00:00Z`) - DIAS_FEITAS_VISIVEIS * 86_400_000
  for (const t of tarefas) {
    if (t.estado === 'feito') {
      if (t.concluida_em && Date.parse(t.concluida_em) >= limiteFeitas) grupos.feitas.push(t)
    } else if (emFoco(t, hoje)) grupos.foco.push(t)
    else if (!t.prazo) grupos.paraIrFazendo.push(t)
    else if (t.prazo <= hoje) grupos.urgentes.push(t)
    else grupos.proximas.push(t)
  }
  const porPrazo = (a: Tarefa, b: Tarefa) =>
    (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999') || (a.hora ?? '99').localeCompare(b.hora ?? '99') || a.criado_em.localeCompare(b.criado_em)
  grupos.foco.sort(porPrazo)
  grupos.urgentes.sort(porPrazo)
  grupos.proximas.sort(porPrazo)
  grupos.paraIrFazendo.sort((a, b) => a.criado_em.localeCompare(b.criado_em))
  grupos.feitas.sort((a, b) => (b.concluida_em ?? '').localeCompare(a.concluida_em ?? ''))
  return grupos
}

// "doEstudio": as tarefas desse estúdio e as da empresa toda — é o que
// se vê dentro de cada estúdio (as do outro estúdio ficam de fora).
export type FiltroTarefas = { pessoa?: string; estudioId?: number | 'geral'; doEstudio?: number; lista?: string }

// "pessoa": id de um perfil, ou "sem" para as que não têm responsável.
export function filtrarTarefas(tarefas: Tarefa[], filtro: FiltroTarefas): Tarefa[] {
  return tarefas.filter((t) => {
    if (filtro.pessoa === 'sem' ? t.responsavel_id !== null : filtro.pessoa ? t.responsavel_id !== filtro.pessoa : false) return false
    if (filtro.estudioId === 'geral' ? t.estudio_id !== null : filtro.estudioId != null ? t.estudio_id !== filtro.estudioId : false) return false
    if (filtro.doEstudio != null && t.estudio_id !== null && t.estudio_id !== filtro.doEstudio) return false
    if (filtro.lista && (t.lista ?? '') !== filtro.lista) return false
    return true
  })
}

// Quantas tarefas em foco esta semana tem já este responsável (para o
// limite de MAX_FOCO_POR_PESSOA), sem contar a própria tarefa.
export function focoDaPessoa(tarefas: Tarefa[], responsavelId: string | null, hoje: string, excluirId?: string): number {
  return tarefas.filter((t) => t.id !== excluirId && t.responsavel_id === responsavelId && emFoco(t, hoje)).length
}

export async function carregarTarefas(supabase: SupabaseClient, hoje: string): Promise<Tarefa[]> {
  // Todas as abertas, mais as concluídas há pouco (as antigas não vêm).
  const desde = new Date(Date.parse(`${hoje}T00:00:00Z`) - DIAS_FEITAS_VISIVEIS * 86_400_000).toISOString()
  const { data, error } = await supabase
    .from('tarefas')
    .select(COLUNAS_TAREFA)
    .or(`estado.neq.feito,concluida_em.gte.${desde}`)
    .order('criado_em')
  if (error) throw new Error(error.message)
  return (data ?? []) as Tarefa[]
}

export type ComentarioTarefa = { id: string; autor_id: string | null; autor_nome: string | null; texto: string; criado_em: string }

// Os passos (subtarefas) e os comentários de uma tarefa, para quando
// está aberta. Nunca parte a página.
export async function carregarDetalheTarefa(supabase: SupabaseClient, id: string): Promise<{ passos: Tarefa[]; comentarios: ComentarioTarefa[] }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { passos: [], comentarios: [] }
  const [passos, comentarios] = await Promise.all([
    supabase.from('tarefas').select(COLUNAS_TAREFA).eq('tarefa_mae_id', id).order('criado_em'),
    supabase.from('tarefas_comentarios').select('id, autor_id, autor_nome, texto, criado_em').eq('tarefa_id', id).order('criado_em'),
  ])
  return { passos: (passos.data ?? []) as Tarefa[], comentarios: (comentarios.data ?? []) as ComentarioTarefa[] }
}

// O número que aparece no menu: tarefas com o prazo passado ou para
// hoje. Nunca parte a página.
// Com "estudioId": só as desse estúdio e as da empresa toda.
export async function contarTarefasUrgentes(supabase: SupabaseClient, hoje: string, estudioId?: number): Promise<number> {
  let consulta = supabase
    .from('tarefas')
    .select('id', { count: 'exact', head: true })
    .neq('estado', 'feito')
    .lte('prazo', hoje)
    .is('tarefa_mae_id', null)
  if (estudioId != null) consulta = consulta.or(`estudio_id.eq.${estudioId},estudio_id.is.null`)
  const { count, error } = await consulta
  return error ? 0 : (count ?? 0)
}

export type PessoaTarefas = { id: string; nome: string }

// A quem se pode atribuir uma tarefa: as pessoas ativas da equipa (dono
// incluído), sem as contas partilhadas — essas são "o tablet do
// estúdio", não alguém. Lido com o cliente de serviço (só nomes): as
// contas partilhadas não veem as fichas da equipa do outro estúdio.
export const pessoasParaTarefas = cache(async (): Promise<PessoaTarefas[]> => {
  try {
    const admin = createAdminClient()
    const [{ data, error }, partilhadas] = await Promise.all([
      admin.from('perfis').select('id, nome').eq('ativo', true),
      idsContasPartilhadas(),
    ])
    if (error) throw new Error(error.message)
    return (data ?? [])
      .filter((p) => !partilhadas.has(p.id))
      .map((p) => ({ id: p.id as string, nome: String(p.nome).trim() }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
  } catch {
    return []
  }
})
