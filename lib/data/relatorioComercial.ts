// Relatório comercial — o funil do trabalho no CRM, do contacto à
// inscrição, para qualquer intervalo de datas (o ecrã mostra o dia, o
// mês e o acumulado do ano lado a lado):
//
//   leads angariadas (por origem) + walk-ins (por tipo)
//   → contactos (com e sem sucesso)      · taxa de contacto
//   → marcações                          · taxa de marcação
//   → marcações em agenda → visitas      · taxa de comparência
//   → inscrições de visitas              · taxa de fecho de visitas
//   walk-ins → walk-ins fechados         · taxa de fecho de walk-ins
//   = total de inscrições
//
// Tudo contas puras sobre dados já carregados (ver
// relatorioComercialDados.ts), para o dia, o mês e o ano saírem dos
// mesmos dados e nunca darem números diferentes para a mesma coisa.

import type { EstadoLead } from '@/lib/supabase/database.types'

// As origens de uma lead, tal como entram no relatório. Os walk-ins não
// estão aqui: contam-se à parte, pelo tipo (TIPOS_WALK_IN).
export const CANAIS_LEAD = [
  'Landing page',
  'Formulário Meta',
  'Referência POS',
  'Member-get-member',
  'Call-in',
  'Chat Messenger',
  'Chat Instagram',
  'Email',
] as const
export type CanalLead = (typeof CANAIS_LEAD)[number]

export const CANAL_WALK_IN = 'Walk-in'
export const SEM_ORIGEM = 'Sem origem'

export const TIPOS_WALK_IN = ['Passagem', 'Member-get-member', 'Redes sociais'] as const
export type TipoWalkIn = (typeof TIPOS_WALK_IN)[number]
export const ROTULO_TIPO_WALK_IN: Record<TipoWalkIn, string> = {
  Passagem: 'De passagem',
  'Member-get-member': 'Member-get-member',
  'Redes sociais': 'Viu as redes sociais',
}
export const WALK_IN_POR_CLASSIFICAR = 'Por classificar'

// Uma visita marcada a uma lead é um treino experimental ou uma visita
// para conhecer as condições (guardado no evento da Agenda; as marcações
// antigas, sem tipo, contam como treino experimental).
export const TIPOS_VISITA = ['Treino experimental', 'Visita de condições'] as const
export type TipoVisita = (typeof TIPOS_VISITA)[number]
export const tipoDeVisita = (valor: string | null | undefined): TipoVisita =>
  valor === 'Visita de condições' ? 'Visita de condições' : 'Treino experimental'
export const SEM_VISITA = 'Sem visita registada'

const semAcentos = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

// Como a mesma origem foi sendo escrita ao longo do tempo (à mão e pelas
// entradas automáticas: "Meta Ads", "Website", "instagram"…) → o canal
// do relatório.
const SINONIMOS: Record<string, CanalLead | typeof CANAL_WALK_IN> = {
  'landing page': 'Landing page',
  landing: 'Landing page',
  website: 'Landing page',
  // O formulário da landing page é um Google Forms.
  'google forms': 'Landing page',
  'google form': 'Landing page',
  site: 'Landing page',
  'formulario meta': 'Formulário Meta',
  'formulario do meta': 'Formulário Meta',
  'meta ads': 'Formulário Meta',
  meta: 'Formulário Meta',
  'facebook ads': 'Formulário Meta',
  facebook: 'Formulário Meta',
  'referencia pos': 'Referência POS',
  'referencias pos': 'Referência POS',
  pos: 'Referência POS',
  'member get member': 'Member-get-member',
  mgm: 'Member-get-member',
  'amigo traz amigo': 'Member-get-member',
  indicacao: 'Member-get-member',
  'call in': 'Call-in',
  chamada: 'Call-in',
  'chamada telefonica': 'Call-in',
  telefonema: 'Call-in',
  telefone: 'Call-in',
  'chat messenger': 'Chat Messenger',
  messenger: 'Chat Messenger',
  'facebook messenger': 'Chat Messenger',
  'chat instagram': 'Chat Instagram',
  instagram: 'Chat Instagram',
  'instagram dm': 'Chat Instagram',
  email: 'Email',
  'e mail': 'Email',
  mail: 'Email',
  'walk in': CANAL_WALK_IN,
  walkin: CANAL_WALK_IN,
}

// O canal de uma origem: um dos CANAIS_LEAD, "Walk-in", a própria origem
// tal como foi escrita (quando não é nenhuma das conhecidas — aparece no
// relatório com esse nome) ou "Sem origem".
export function canalDaOrigem(origem: string | null | undefined): string {
  const texto = origem?.trim()
  if (!texto) return SEM_ORIGEM
  return SINONIMOS[semAcentos(texto)] ?? texto
}

export type LeadRelatorio = {
  id: string
  origem: string | null
  walk_in: boolean
  walk_in_tipo: string | null
  estado: EstadoLead
  entrada: string
  fecho_em: string | null
}

export type ContactoRelatorio = { lead_id: string; data: string; sucesso: boolean | null }

// Uma visita marcada (sessão experimental ou visita para conhecer as
// condições): o dia em que foi marcada, o dia para que foi marcada e o
// que lhe aconteceu.
export type SessaoRelatorio = {
  lead_id: string | null
  tipo: TipoVisita
  data: string
  marcadaEm: string
  cancelada: boolean
  concluida: boolean
}

export type DadosRelatorioComercial = {
  leads: LeadRelatorio[]
  contactos: ContactoRelatorio[]
  sessoes: SessaoRelatorio[]
  // Leads com registo de terem vindo à visita (passaram por "Experimental
  // realizada", ou já estão em proposta ou inscritas).
  compareceram: Set<string>
}

export type Contagem = { nome: string; n: number }

export type MetricasComerciais = {
  leads: number
  porCanal: Contagem[]
  outrasOrigens: Contagem[]
  walkIns: number
  walkInsPorTipo: Contagem[]
  contactosSucesso: number
  contactosSemSucesso: number
  contactosTotal: number
  leadsContactadas: number
  marcacoes: number
  marcacoesPorTipo: Contagem[]
  emAgenda: number
  emAgendaPorTipo: Contagem[]
  visitas: number
  visitasPorTipo: Contagem[]
  visitasPorRegistar: number
  inscricoesVisitas: number
  // Pelo tipo da última visita (não desmarcada) de cada lead inscrita.
  inscricoesPorTipo: Contagem[]
  walkInsFechados: number
  totalInscricoes: number
  taxaContacto: number | null
  taxaMarcacao: number | null
  taxaComparencia: number | null
  taxaFechoVisitas: number | null
  taxaFechoWalkIns: number | null
}

export const ehWalkIn = (l: Pick<LeadRelatorio, 'walk_in' | 'origem'>) => l.walk_in || canalDaOrigem(l.origem) === CANAL_WALK_IN

const taxa = (parte: number, todo: number): number | null => (todo > 0 ? parte / todo : null)

// As contas do relatório para o intervalo [inicio, fimExclusivo). "hoje"
// serve só para saber que visitas já deviam ter resultado registado.
export function calcularRelatorioComercial(
  d: DadosRelatorioComercial,
  inicio: string,
  fimExclusivo: string,
  hoje: string
): MetricasComerciais {
  const dentro = (data: string | null | undefined) => !!data && data >= inicio && data < fimExclusivo

  // 1) Angariação: leads por origem; walk-ins à parte, por tipo.
  const entradas = d.leads.filter((l) => dentro(l.entrada))
  const leadsNormais = entradas.filter((l) => !ehWalkIn(l))
  const walkIns = entradas.filter(ehWalkIn)

  const conta = new Map<string, number>()
  for (const l of leadsNormais) {
    const canal = canalDaOrigem(l.origem)
    conta.set(canal, (conta.get(canal) ?? 0) + 1)
  }
  const conhecidos = new Set<string>(CANAIS_LEAD)
  const porCanal = CANAIS_LEAD.map((nome) => ({ nome, n: conta.get(nome) ?? 0 }))
  const outrasOrigens = [...conta.entries()]
    .filter(([nome]) => !conhecidos.has(nome))
    .map(([nome, n]) => ({ nome, n }))
    .sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome, 'pt'))

  const tipos = new Set<string>(TIPOS_WALK_IN)
  const walkInsPorTipo: Contagem[] = [
    ...TIPOS_WALK_IN.map((t) => ({ nome: t as string, n: walkIns.filter((l) => l.walk_in_tipo === t).length })),
    { nome: WALK_IN_POR_CLASSIFICAR, n: walkIns.filter((l) => !l.walk_in_tipo || !tipos.has(l.walk_in_tipo)).length },
  ]

  // 2) Contactos. Um contacto sem indicação de sucesso (registos antigos)
  //    conta como sem sucesso: não há prova de que a pessoa atendeu.
  const contactos = d.contactos.filter((c) => dentro(c.data))
  const comSucesso = contactos.filter((c) => c.sucesso === true)
  const leadsContactadas = new Set(comSucesso.map((c) => c.lead_id)).size

  // 3) Marcações feitas no período e 4) visitas marcadas PARA o período.
  const marcadas = d.sessoes.filter((s) => dentro(s.marcadaEm))
  const marcacoes = marcadas.length
  const paraOPeriodo = d.sessoes.filter((s) => dentro(s.data))
  const veio = (s: SessaoRelatorio) => !s.cancelada && (s.concluida || (!!s.lead_id && d.compareceram.has(s.lead_id)))
  const realizadas = paraOPeriodo.filter(veio)
  const visitas = realizadas.length
  const porTipo = (lista: SessaoRelatorio[]): Contagem[] => TIPOS_VISITA.map((t) => ({ nome: t, n: lista.filter((s) => s.tipo === t).length }))
  const visitasPorRegistar = paraOPeriodo.filter((s) => !s.cancelada && !veio(s) && s.data < hoje).length

  // 5) Inscrições (lead ganha, pela data do fecho).
  const ganhas = d.leads.filter((l) => l.estado === 'Ganha' && dentro(l.fecho_em))
  const inscritas = ganhas.filter((l) => !ehWalkIn(l))
  const inscricoesVisitas = inscritas.length
  // Cada inscrição fica com o tipo da última visita (não desmarcada) da lead.
  const ultimaVisita = new Map<string, SessaoRelatorio>()
  for (const s of d.sessoes) {
    if (!s.lead_id || s.cancelada) continue
    const atual = ultimaVisita.get(s.lead_id)
    if (!atual || s.data > atual.data) ultimaVisita.set(s.lead_id, s)
  }
  const tipoDaInscricao = (l: LeadRelatorio) => ultimaVisita.get(l.id)?.tipo ?? SEM_VISITA
  const inscricoesPorTipo: Contagem[] = [...TIPOS_VISITA, SEM_VISITA].map((t) => ({ nome: t, n: inscritas.filter((l) => tipoDaInscricao(l) === t).length }))
  const walkInsFechados = ganhas.filter(ehWalkIn).length

  return {
    leads: leadsNormais.length,
    porCanal,
    outrasOrigens,
    walkIns: walkIns.length,
    walkInsPorTipo,
    contactosSucesso: comSucesso.length,
    contactosSemSucesso: contactos.length - comSucesso.length,
    contactosTotal: contactos.length,
    leadsContactadas,
    marcacoes,
    marcacoesPorTipo: porTipo(marcadas),
    emAgenda: paraOPeriodo.length,
    emAgendaPorTipo: porTipo(paraOPeriodo),
    visitas,
    visitasPorTipo: porTipo(realizadas),
    visitasPorRegistar,
    inscricoesVisitas,
    inscricoesPorTipo,
    walkInsFechados,
    totalInscricoes: inscricoesVisitas + walkInsFechados,
    taxaContacto: taxa(leadsContactadas, leadsNormais.length),
    // Cada marcação nasce de um contacto com sucesso (marcar a visita
    // regista um): compara-se com os contactos, não com as leads.
    taxaMarcacao: taxa(marcacoes, comSucesso.length),
    taxaComparencia: taxa(visitas, paraOPeriodo.length),
    taxaFechoVisitas: taxa(inscricoesVisitas, visitas),
    taxaFechoWalkIns: taxa(walkInsFechados, walkIns.length),
  }
}

// Os três períodos do relatório para um dia de referência: o próprio
// dia, o mês até esse dia e o ano até esse dia. [inicio, fimExclusivo).
export function periodosDoRelatorio(dia: string): { dia: [string, string]; mes: [string, string]; ano: [string, string] } {
  const [a, m, d] = dia.split('-').map(Number)
  const seguinte = new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10)
  return {
    dia: [dia, seguinte],
    mes: [`${dia.slice(0, 7)}-01`, seguinte],
    ano: [`${dia.slice(0, 4)}-01-01`, seguinte],
  }
}
