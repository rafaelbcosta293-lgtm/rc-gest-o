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
  // Dias da semana em que se repete (1 = segunda … 7 = domingo).
  repete_dias: number[] | null
  // Repete todos os meses, no dia do prazo.
  repete_mensal: boolean
  concluida_em: string | null
  criado_em: string
}

export const COLUNAS_TAREFA =
  'id, titulo, descricao, lista, estudio_id, responsavel_id, prazo, estado, foco_semana, reservada, repete_dias, repete_mensal, concluida_em, criado_em'

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
  { valor: 'dias', rotulo: 'Nos dias da semana escolhidos' },
  { valor: 'mensal', rotulo: 'Todos os meses' },
]

type Repeticao = Pick<Tarefa, 'repete_dias' | 'repete_mensal'>

export function repeteSe(t: Repeticao): boolean {
  return t.repete_mensal || (t.repete_dias?.length ?? 0) > 0
}

// Que escolha do formulário corresponde a esta tarefa.
export function escolhaDeRepeticao(t: Repeticao): string {
  if (t.repete_mensal) return 'mensal'
  const dias = [...(t.repete_dias ?? [])].sort().join(',')
  if (!dias) return 'nao'
  return REPETICOES_TAREFA.find((r) => r.dias?.join(',') === dias)?.valor ?? 'dias'
}

// "dias úteis", "seg a sáb", "seg e sex", "todos os meses"…
export function descricaoRepeticao(t: Repeticao): string | null {
  if (t.repete_mensal) return 'todos os meses'
  const dias = [...(t.repete_dias ?? [])].sort()
  if (dias.length === 0) return null
  const chave = dias.join(',')
  if (chave === '1,2,3,4,5') return 'dias úteis'
  if (chave === '1,2,3,4,5,6') return 'seg a sáb'
  if (chave === '1,2,3,4,5,6,7') return 'todos os dias'
  const nomes = dias.map((d) => DIAS_DA_SEMANA[d - 1].curto)
  return nomes.length === 1 ? `${nomes[0]}, todas as semanas` : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
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

// O mesmo dia do mês seguinte; um prazo no último dia do mês passa para
// o último dia do mês seguinte (31/01 → 28/02 → 31/03).
function mesSeguinte(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  const ultimoDeste = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const ultimoDoSeguinte = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()
  const novoDia = dia === ultimoDeste ? ultimoDoSeguinte : Math.min(dia, ultimoDoSeguinte)
  return paraISO(Date.UTC(ano, mes, novoDia))
}

// O prazo da vez seguinte de uma tarefa que se repete, ou null se não
// se repete. É sempre depois de hoje: concluir com atraso uma tarefa
// diária não cria uma fila de dias que já passaram.
export function proximaOcorrencia(t: Repeticao & Pick<Tarefa, 'prazo'>, hoje: string): string | null {
  if (!repeteSe(t)) return null
  const prazo = t.prazo ?? hoje
  if (t.repete_mensal) {
    let seguinte = mesSeguinte(prazo)
    while (seguinte <= hoje) seguinte = mesSeguinte(seguinte)
    return seguinte
  }
  const base = prazo > hoje ? prazo : hoje
  return primeiroDiaEm(t.repete_dias!, paraISO(deISO(base) + UM_DIA_MS))
}

// As vezes seguintes de uma tarefa que se repete, entre duas datas — as
// que ainda não existem (só nascem quando a anterior é concluída), para
// o calendário as poder mostrar como previstas.
export function ocorrenciasPrevistas(t: Repeticao & Pick<Tarefa, 'prazo'>, de: string, ate: string): string[] {
  if (!repeteSe(t) || !t.prazo) return []
  const datas: string[] = []
  let atual = t.prazo
  for (let i = 0; i < 800; i++) {
    atual = t.repete_mensal ? mesSeguinte(atual) : primeiroDiaEm(t.repete_dias!, paraISO(deISO(atual) + UM_DIA_MS))
    if (atual > ate) break
    if (atual >= de) datas.push(atual)
  }
  return datas
}

// ── Estatísticas (painel) ────────────────────────────────────────────

export type TarefaFeita = Pick<Tarefa, 'id' | 'titulo' | 'lista' | 'estudio_id' | 'responsavel_id' | 'prazo' | 'concluida_em' | 'criado_em'>

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
  for (const f of feitas30) {
    daPessoa(f.responsavel_id).feitas30++
    daLista(f.lista).feitas30++
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
    .select('id, titulo, lista, estudio_id, responsavel_id, prazo, concluida_em, criado_em')
    .eq('estado', 'feito')
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
  const porPrazo = (a: Tarefa, b: Tarefa) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999') || a.criado_em.localeCompare(b.criado_em)
  grupos.foco.sort(porPrazo)
  grupos.urgentes.sort(porPrazo)
  grupos.proximas.sort(porPrazo)
  grupos.paraIrFazendo.sort((a, b) => a.criado_em.localeCompare(b.criado_em))
  grupos.feitas.sort((a, b) => (b.concluida_em ?? '').localeCompare(a.concluida_em ?? ''))
  return grupos
}

export type FiltroTarefas = { pessoa?: string; estudioId?: number | 'geral'; lista?: string }

// "pessoa": id de um perfil, ou "sem" para as que não têm responsável.
export function filtrarTarefas(tarefas: Tarefa[], filtro: FiltroTarefas): Tarefa[] {
  return tarefas.filter((t) => {
    if (filtro.pessoa === 'sem' ? t.responsavel_id !== null : filtro.pessoa ? t.responsavel_id !== filtro.pessoa : false) return false
    if (filtro.estudioId === 'geral' ? t.estudio_id !== null : filtro.estudioId != null ? t.estudio_id !== filtro.estudioId : false) return false
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

// O número que aparece no menu: tarefas com o prazo passado ou para
// hoje. Nunca parte a página.
export async function contarTarefasUrgentes(supabase: SupabaseClient, hoje: string): Promise<number> {
  const { count, error } = await supabase.from('tarefas').select('id', { count: 'exact', head: true }).neq('estado', 'feito').lte('prazo', hoje)
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
