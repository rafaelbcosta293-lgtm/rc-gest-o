import {
  UsersRound,
  Dumbbell,
  CalendarCheck2,
  CalendarDays,
  Gauge,
  Megaphone,
  CreditCard,
  KeyRound,
  AlarmClock,
  BellRing,
  Target,
  type LucideIcon,
} from 'lucide-react'

// Paleta única da app: cada família de cor tem sempre o mesmo par
// fundo/texto, esteja onde estiver (alertas, estados, leads, secções,
// instrutores). Antes havia duas variantes de âmbar/laranja ligeiramente
// diferentes a competir lado a lado — unificado para a app parecer um
// sistema só, não vários painéis pintados à parte.
export const PALETA = {
  teal: { bg: '#DFF5F3', tx: '#0D7D7C' },
  roxo: { bg: '#EBE6F8', tx: '#5B3FA0' },
  azul: { bg: '#E2EEFC', tx: '#1D5FA8' },
  laranja: { bg: '#FCE8DA', tx: '#B6560F' },
  ambar: { bg: '#FDF0DC', tx: '#A5690A' },
  verde: { bg: '#E1F5EA', tx: '#157347' },
  vermelho: { bg: '#FBE4E3', tx: '#B3261E' },
  neutro: { bg: '#EEF1F5', tx: '#5B6472' },
} as const

// Cores por estúdio, só para a interface (a lista de estúdios em si vem
// da base de dados, tabela "estudios"). Um estúdio novo que não esteja
// aqui usa a cor por omissão.
const CORES_ESTUDIO: Record<string, { cor: string; bg: string }> = {
  fatima: { cor: PALETA.teal.tx, bg: PALETA.teal.bg },
  leiria: { cor: PALETA.laranja.tx, bg: PALETA.laranja.bg },
}
const COR_ESTUDIO_OMISSAO = { cor: PALETA.roxo.tx, bg: PALETA.roxo.bg }

export function corEstudio(slug: string) {
  return CORES_ESTUDIO[slug] ?? COR_ESTUDIO_OMISSAO
}

// Cor de cada estúdio só para traços de gráfico — mais viva que a cor
// de texto das pastilhas (CORES_ESTUDIO), que em cima do fundo escuro da
// Administração lia quase cinzenta. Validada com o validador de paletas
// (checks de luminância, croma, distinção CVD e contraste) para o fundo
// escuro e o claro, em vez de escolhida a olho.
export const CORES_GRAFICO_ESTUDIO: Record<string, string> = {
  fatima: '#13A89A',
  leiria: '#D5680A',
}
const COR_GRAFICO_OMISSAO = '#8B5CF6'

export function corGraficoEstudio(slug: string) {
  return CORES_GRAFICO_ESTUDIO[slug] ?? COR_GRAFICO_OMISSAO
}

// Telemóvel físico de cada estúdio — uma página web não consegue fazer
// esse telemóvel tocar sozinho a partir de outro aparelho (isso só com
// um serviço de chamadas pago, tipo Twilio, a fazer de ponte); por
// pedido do dono, mostra-se só o número certo para ligar à mão a
// partir desse telemóvel.
export const TELEFONE_ESTUDIO: Record<string, string> = {
  fatima: '+351 913 188 090',
  leiria: '+351 913 188 080',
}

export const ALERTAS = {
  Nenhum: { ...PALETA.verde, dot: '#1E9A52', label: 'Sem alertas' },
  Lesão: { ...PALETA.vermelho, dot: PALETA.vermelho.tx, label: 'Lesão' },
  Doença: { ...PALETA.laranja, dot: PALETA.laranja.tx, label: 'Doença' },
  'Prova/Evento': { ...PALETA.roxo, dot: PALETA.roxo.tx, label: 'Prova a chegar' },
  Limitação: { ...PALETA.ambar, dot: PALETA.ambar.tx, label: 'Limitação' },
} as const

export type AlertaTipo = keyof typeof ALERTAS

export const CORREU = {
  'Muito bem': PALETA.verde,
  Bem: PALETA.teal,
  Razoável: PALETA.ambar,
  Difícil: PALETA.laranja,
  Interrompido: PALETA.vermelho,
} as const

export const PRESENCAS = {
  Presente: PALETA.verde,
  Faltou: PALETA.vermelho,
  'Faltou (avisou)': PALETA.ambar,
  Remarcado: PALETA.azul,
} as const

// "Ex-cliente" na base de dados é mostrado como "Inativo" na interface —
// mais claro para quem não mexeu na ficha. Não existe ainda um estado
// "Pendente" na base de dados (só Ativo / Suspenso / Ex-cliente).
export const ESTADOS_CLIENTE = {
  Ativo: { ...PALETA.verde, label: 'Ativo' },
  Suspenso: { ...PALETA.ambar, label: 'Suspenso' },
  'Ex-cliente': { ...PALETA.neutro, label: 'Inativo' },
} as const

// Ordem = ordem do funil (ver docs/ESPECIFICACAO_CRM_ANALITICA.md §3) —
// várias páginas usam Object.keys(ESTADOS_LEAD) para a ordem do Kanban
// e dos filtros, por isso a ordem aqui importa tanto quanto a cor.
export const ESTADOS_LEAD = {
  Nova: PALETA.azul,
  Contactada: PALETA.ambar,
  Qualificada: PALETA.laranja,
  'Experimental agendada': PALETA.roxo,
  'Experimental realizada': PALETA.teal,
  'Falhou a experimental': PALETA.vermelho,
  'Proposta / Em decisão': PALETA.ambar,
  Ganha: PALETA.verde,
  Perdida: PALETA.neutro,
} as const

export const TIPOS_CONTACTO = ['Telefone', 'WhatsApp', 'Email', 'Presencial', 'Mensagem redes'] as const

// Uma cor por instrutor (por ordem alfabética, atribuída pela posição na
// lista) — para se identificar quem trabalha quando só de olhar para a
// grelha de horários, sem ter de ler cada nome.
const PALETA_INSTRUTORES = [
  PALETA.teal,
  PALETA.roxo,
  PALETA.azul,
  PALETA.laranja,
  PALETA.ambar,
  PALETA.verde,
  PALETA.vermelho,
  PALETA.neutro,
] as const

export function corInstrutor(indice: number) {
  return PALETA_INSTRUTORES[indice % PALETA_INSTRUTORES.length]
}

export const BLOCOS = ['Aquecimento', 'Principal', 'Acessório', 'Final'] as const
export type BlocoTipo = (typeof BLOCOS)[number]

export const BLOCO_COR: Record<BlocoTipo, string> = {
  Aquecimento: PALETA.teal.tx,
  Principal: '#1F3864',
  Acessório: PALETA.roxo.tx,
  Final: PALETA.verde.tx,
}

type Modulo = {
  id: string
  nome: string
  // Nome curto para a barra de separadores do telemóvel — alguns nomes
  // completos ("Abertura / Fecho") não cabem por baixo de um ícone.
  curto?: string
  icone: LucideIcon
  cor: keyof typeof PALETA
  desc: string
  pronto: boolean
  restrito?: 'admin' | 'gestao'
}

// Ordem pedida para a barra superior (computador/tablet) e para a barra
// do telemóvel: Clientes, Agenda, Leads, Objetivos, Presenças,
// Pagamentos, Alertas, Horários, Abertura/Fecho. Treinos e Avaliações
// não têm pílula própria na barra do computador (ver
// NavLinkClientesComSubmenu, aparecem como subpastas de Clientes), mas
// continuam na barra do telemóvel — ficam logo a seguir a Clientes, de
// quem são conceptualmente uma extensão.
export const MODULOS: Modulo[] = [
  { id: 'clientes', nome: 'Clientes', icone: UsersRound, cor: 'teal', desc: 'Ficha completa de cada cliente, tudo num só sítio', pronto: true },
  { id: 'treinos', nome: 'Treinos', icone: Dumbbell, cor: 'roxo', desc: 'Planos, histórico e notas entre PTs', pronto: true },
  { id: 'avaliacoes', nome: 'Avaliações', icone: Gauge, cor: 'azul', desc: 'Avaliações, reavaliações e evolução', pronto: true },
  { id: 'agenda', nome: 'Agenda', icone: CalendarDays, cor: 'roxo', desc: 'Treinos, avaliações e reuniões — dia, semana e mês', pronto: true },
  { id: 'leads', nome: 'Leads', icone: Megaphone, cor: 'laranja', desc: 'Contactos, origem e seguimento', pronto: true },
  { id: 'objetivos', nome: 'Objetivos', icone: Target, cor: 'verde', desc: 'Metas do mês, progresso e a calculadora de funil inverso', pronto: true },
  { id: 'presencas', nome: 'Presenças', icone: CalendarCheck2, cor: 'verde', desc: 'Quem treinou e quem faltou', pronto: true },
  { id: 'pagamentos', nome: 'Pagamentos', icone: CreditCard, cor: 'ambar', desc: 'Quem tem o pagamento em dia', pronto: true },
  { id: 'alertas', nome: 'Alertas', icone: BellRing, cor: 'vermelho', desc: 'Leads, clientes e pagamentos que precisam de atenção agora', pronto: true },
  { id: 'horarios', nome: 'Horários', icone: AlarmClock, cor: 'vermelho', desc: 'Escala da semana e ausências da equipa', pronto: true },
  { id: 'checklist', nome: 'Abertura / Fecho', curto: 'Checklist', icone: KeyRound, cor: 'neutro', desc: 'Checklist diária do estúdio', pronto: true },
]

// Coordenação e Administração deixaram de ser por estúdio — passaram a
// uma página combinada (Fátima + Leiria juntas), acessível a partir de
// /painel (só para admin), não daqui. Ficam de fora desta lista para
// não aparecerem (nem, já agora, como links partidos) na navegação de
// cada estúdio.
