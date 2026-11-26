// Controlo do trabalho dos instrutores: cada treino da Agenda tem de ter
// o instrutor que o deu e um plano de treino associado. Daqui saem os
// sinais nos eventos da Agenda e o relatório "Avaliação de instrutores".
import type { EstadoEventoAgenda, TipoEventoAgenda } from '@/lib/supabase/database.types'

// O controlo conta a partir deste dia: o que está para trás não tinha
// instrutor nos treinos e ficava tudo assinalado sem remédio.
export const INICIO_CONTROLO = '2026-11-27'

// Só os treinos têm de ter instrutor (reuniões, avaliações e sessões
// experimentais continuam livres).
export const exigeInstrutor = (tipo: TipoEventoAgenda | string) => tipo === 'Treino'

export const MENSAGEM_FALTA_INSTRUTOR = 'Escolhe o instrutor que dá este treino.'

// O instrutor de um treino atribui-se treino a treino, por quem o dá —
// nunca passa sozinho para os outros treinos da mesma série (nem ao
// criar uma repetição, nem ao editar "toda a série", nem nos que o cron
// vai gerando). Assim cada treino fica com o sinal "sem instrutor" até
// alguém o assumir, em vez de herdar um nome que pode estar errado.
// Nos outros tipos de evento (reuniões, etc.) continua a copiar-se.
export const instrutorHerdado = (tipo: TipoEventoAgenda | string, ptId: string | null) => (exigeInstrutor(tipo) ? null : ptId)

type EventoBase = {
  tipo: TipoEventoAgenda | string
  estado: EstadoEventoAgenda | string
  data: string
  pt_id: string | null
  cliente_id: string | null
}

const contaParaOControlo = (e: EventoBase) =>
  e.tipo === 'Treino' && e.estado !== 'Cancelado' && e.data >= INICIO_CONTROLO

// Treino sem instrutor associado (assinala-se em qualquer data a partir
// do início do controlo, também nos que ainda vêm).
export const faltaInstrutor = (e: EventoBase) => contaParaOControlo(e) && !e.pt_id

// O plano só se cobra até ao dia seguinte: assinalar todos os treinos
// das próximas semanas enchia a Agenda de avisos sem utilidade.
export const precisaDePlano = (e: EventoBase, amanha: string) =>
  contaParaOControlo(e) && !!e.cliente_id && e.data <= amanha

// Um plano só conta quando tem exercícios — criar o plano e deixá-lo
// vazio não é planear.
export type EstadoPlano = 'feito' | 'vazio' | 'nenhum'
export const estadoDoPlano = (plano: { exercicios: number } | undefined | null): EstadoPlano =>
  !plano ? 'nenhum' : plano.exercicios > 0 ? 'feito' : 'vazio'

export const ROTULO_PLANO: Record<EstadoPlano, string> = {
  feito: 'Com plano de treino',
  vazio: 'Plano de treino vazio (sem exercícios)',
  nenhum: 'Sem plano de treino',
}

// ---------- Relatório ----------

export type EventoRelatorio = {
  id: string
  grupo_id: string | null
  estudio_id: number
  cliente_id: string | null
  cliente_nome: string | null
  pt_id: string | null
  data: string
  hora_inicio: string
}

export type PlanoRelatorio = {
  id: string
  agenda_evento_id: string | null
  pt_id: string | null
  data: string
  // Quando o plano foi criado (ISO, com fuso).
  criado_em: string
  exercicios: number
  // "Como correu" já registado depois do treino.
  registado: boolean
}

export type ClienteDoInstrutor = { clienteId: string; nome: string; treinos: number; comPlano: number }

export type LinhaInstrutor = {
  ptId: string
  nome: string
  // Treinos dados (um treino em simultâneo conta uma vez).
  treinos: number
  // Treinos por cliente (num treino em dupla são dois).
  treinosCliente: number
  comPlano: number
  semPlano: number
  // Dos treinos que deu, quantos ficaram com o "como correu" registado.
  registados: number
  clientes: ClienteDoInstrutor[]
  // Planos que ele próprio fez (com exercícios), no período.
  planosFeitos: number
  // Desses, quantos foram criados antes da hora do treino.
  planosATempo: number
  planosVazios: number
}

export type AvaliacaoInstrutores = {
  linhas: LinhaInstrutor[]
  // Treinos do período sem instrutor associado (não contam para ninguém).
  treinosSemInstrutor: number
  // Planos do período que não estão ligados a nenhum treino da Agenda.
  planosSemTreino: number
  // Planos sem autor.
  planosSemAutor: number
  totalTreinos: number
  totalComPlano: number
}

// Hora de Lisboa de um instante, em "AAAA-MM-DD HH:MM" — para comparar
// com o dia e a hora do treino (que estão guardados na hora de Lisboa).
const fmtLisboa = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Lisbon',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
export const instanteEmLisboa = (iso: string) => fmtLisboa.format(new Date(iso))

const taxa = (parte: number, total: number) => (total > 0 ? parte / total : null)
export const taxaDePlano = (l: { comPlano: number; treinosCliente: number }) => taxa(l.comPlano, l.treinosCliente)

// Os eventos e planos já vêm filtrados pelo período (e só treinos não
// desmarcados que já aconteceram); aqui só se cruzam.
export function calcularAvaliacaoInstrutores(
  eventos: EventoRelatorio[],
  planos: PlanoRelatorio[],
  instrutores: { id: string; nome: string }[]
): AvaliacaoInstrutores {
  const planoDoEvento = new Map<string, PlanoRelatorio>()
  for (const p of planos) if (p.agenda_evento_id) planoDoEvento.set(p.agenda_evento_id, p)
  const eventoPorId = new Map(eventos.map((e) => [e.id, e]))

  const nomes = new Map(instrutores.map((i) => [i.id, i.nome]))
  const linhas = new Map<string, LinhaInstrutor & { vistos: Set<string>; porCliente: Map<string, ClienteDoInstrutor> }>()
  const linha = (ptId: string) => {
    let l = linhas.get(ptId)
    if (!l) {
      l = {
        ptId,
        nome: nomes.get(ptId) ?? 'Instrutor sem acesso ativo',
        treinos: 0,
        treinosCliente: 0,
        comPlano: 0,
        semPlano: 0,
        registados: 0,
        clientes: [],
        planosFeitos: 0,
        planosATempo: 0,
        planosVazios: 0,
        vistos: new Set(),
        porCliente: new Map(),
      }
      linhas.set(ptId, l)
    }
    return l
  }
  // Toda a equipa aparece, mesmo quem não deu nenhum treino no período.
  for (const i of instrutores) linha(i.id)

  let treinosSemInstrutor = 0
  let totalTreinos = 0
  let totalComPlano = 0
  for (const e of eventos) {
    if (!e.cliente_id) continue
    totalTreinos++
    const plano = planoDoEvento.get(e.id)
    const temPlano = estadoDoPlano(plano) === 'feito'
    if (temPlano) totalComPlano++
    if (!e.pt_id) {
      treinosSemInstrutor++
      continue
    }
    const l = linha(e.pt_id)
    const chave = e.grupo_id ?? e.id
    if (!l.vistos.has(chave)) {
      l.vistos.add(chave)
      l.treinos++
    }
    l.treinosCliente++
    if (temPlano) l.comPlano++
    else l.semPlano++
    if (plano?.registado) l.registados++
    const c = l.porCliente.get(e.cliente_id) ?? { clienteId: e.cliente_id, nome: e.cliente_nome ?? 'Cliente', treinos: 0, comPlano: 0 }
    c.treinos++
    if (temPlano) c.comPlano++
    l.porCliente.set(e.cliente_id, c)
  }

  let planosSemTreino = 0
  let planosSemAutor = 0
  for (const p of planos) {
    if (!p.agenda_evento_id) planosSemTreino++
    if (!p.pt_id) {
      planosSemAutor++
      continue
    }
    const l = linha(p.pt_id)
    if (p.exercicios === 0) {
      l.planosVazios++
      continue
    }
    l.planosFeitos++
    const evento = p.agenda_evento_id ? eventoPorId.get(p.agenda_evento_id) : undefined
    // Sem treino associado, compara-se com o dia do plano.
    const limite = evento ? `${evento.data} ${evento.hora_inicio.slice(0, 5)}` : `${p.data} 23:59`
    if (instanteEmLisboa(p.criado_em) <= limite) l.planosATempo++
  }

  const resultado: LinhaInstrutor[] = [...linhas.values()]
    .map(({ vistos, porCliente, ...l }) => {
      void vistos
      return { ...l, clientes: [...porCliente.values()].sort((a, b) => b.treinos - a.treinos || a.nome.localeCompare(b.nome)) }
    })
    .sort((a, b) => b.treinos - a.treinos || a.nome.localeCompare(b.nome))

  return { linhas: resultado, treinosSemInstrutor, planosSemTreino, planosSemAutor, totalTreinos, totalComPlano }
}

// ---------- Períodos ----------

export type ModoPeriodo = 'trimestre' | 'mes'
export type PeriodoAvaliacao = {
  modo: ModoPeriodo
  inicio: string
  fimExclusivo: string
  titulo: string
  anterior: string
  seguinte: string
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const iso = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, '0')}-01`
const somarMeses = (ano: number, mes: number, n: number) => {
  const total = ano * 12 + (mes - 1) + n
  return { ano: Math.floor(total / 12), mes: (total % 12) + 1 }
}

// O trimestre (ou mês) que contém o dia dado; "anterior" e "seguinte"
// são um dia de cada período vizinho, para navegar.
export function periodoDaAvaliacao(dia: string, modo: ModoPeriodo): PeriodoAvaliacao {
  const ano = Number(dia.slice(0, 4))
  const mes = Number(dia.slice(5, 7))
  const tamanho = modo === 'trimestre' ? 3 : 1
  const primeiroMes = modo === 'trimestre' ? Math.floor((mes - 1) / 3) * 3 + 1 : mes
  const fim = somarMeses(ano, primeiroMes, tamanho)
  const antes = somarMeses(ano, primeiroMes, -tamanho)
  return {
    modo,
    inicio: iso(ano, primeiroMes),
    fimExclusivo: iso(fim.ano, fim.mes),
    titulo: modo === 'trimestre' ? `${Math.floor((mes - 1) / 3) + 1}.º trimestre de ${ano}` : `${MESES[mes - 1]} de ${ano}`,
    anterior: iso(antes.ano, antes.mes),
    seguinte: iso(fim.ano, fim.mes),
  }
}
