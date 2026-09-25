// Cores por estúdio, só para a interface (a lista de estúdios em si vem
// da base de dados, tabela "estudios"). Um estúdio novo que não esteja
// aqui usa a cor por omissão.
const CORES_ESTUDIO: Record<string, { cor: string; bg: string }> = {
  fatima: { cor: '#0E9594', bg: '#DDF3F2' },
  leiria: { cor: '#ED7D31', bg: '#FDEBDD' },
}
const COR_ESTUDIO_OMISSAO = { cor: '#5B3FA0', bg: '#E9E5F7' }

export function corEstudio(slug: string) {
  return CORES_ESTUDIO[slug] ?? COR_ESTUDIO_OMISSAO
}

export const ALERTAS = {
  Nenhum: { bg: '#E3F3EA', tx: '#1E7145', dot: '#2FA36B', label: 'Sem alertas' },
  Lesão: { bg: '#FBE4E4', tx: '#B3261E', dot: '#B3261E', label: 'Lesão' },
  Doença: { bg: '#FDEBDD', tx: '#9A4A0F', dot: '#ED7D31', label: 'Doença' },
  'Prova/Evento': { bg: '#E9E5F7', tx: '#5B3FA0', dot: '#5B3FA0', label: 'Prova a chegar' },
  Limitação: { bg: '#FFF4DE', tx: '#9C6B00', dot: '#D9A404', label: 'Limitação' },
} as const

export type AlertaTipo = keyof typeof ALERTAS

export const CORREU = {
  'Muito bem': { bg: '#E3F3EA', tx: '#1E7145' },
  Bem: { bg: '#DDF3F2', tx: '#0E9594' },
  Razoável: { bg: '#FFF4DE', tx: '#9C6B00' },
  Difícil: { bg: '#FDEBDD', tx: '#9A4A0F' },
  Interrompido: { bg: '#FBE4E4', tx: '#B3261E' },
} as const

export const PRESENCAS = {
  Presente: { bg: '#E3F3EA', tx: '#1E7145' },
  Faltou: { bg: '#FBE4E4', tx: '#B3261E' },
  'Faltou (avisou)': { bg: '#FDEBDD', tx: '#9A4A0F' },
  Remarcado: { bg: '#E1EEF9', tx: '#1F6FB2' },
} as const

// "Ex-cliente" na base de dados é mostrado como "Inativo" na interface —
// mais claro para quem não mexeu na ficha. Não existe ainda um estado
// "Pendente" na base de dados (só Ativo / Suspenso / Ex-cliente).
export const ESTADOS_CLIENTE = {
  Ativo: { bg: '#E3F3EA', tx: '#1E7145', label: 'Ativo' },
  Suspenso: { bg: '#FFF4DE', tx: '#9C6B00', label: 'Suspenso' },
  'Ex-cliente': { bg: '#F2F5FA', tx: '#6B7688', label: 'Inativo' },
} as const

export const ESTADOS_LEAD = {
  Novo: { bg: '#E1EEF9', tx: '#1F6FB2' },
  Contactado: { bg: '#FFF4DE', tx: '#9C6B00' },
  'Visita marcada': { bg: '#E9E5F7', tx: '#5B3FA0' },
  'Visita feita': { bg: '#DDF3F2', tx: '#0E9594' },
  Convertido: { bg: '#E3F3EA', tx: '#1E7145' },
  Perdido: { bg: '#FBE4E4', tx: '#B3261E' },
} as const

export const TIPOS_CONTACTO = ['Telefone', 'WhatsApp', 'Email', 'Presencial', 'Mensagem redes'] as const

export const RECORRENCIAS = ['Diária', 'Semanal', 'Mensal', 'Anual'] as const

// Uma cor por instrutor (por ordem alfabética, atribuída pela posição na
// lista) — para se identificar quem trabalha quando só de olhar para a
// grelha de horários, sem ter de ler cada nome.
const PALETA_INSTRUTORES = [
  { bg: '#DDF3F2', tx: '#0E9594' },
  { bg: '#E9E5F7', tx: '#5B3FA0' },
  { bg: '#E1EEF9', tx: '#1F6FB2' },
  { bg: '#FDEBDD', tx: '#9A4A0F' },
  { bg: '#FFF4DE', tx: '#9C6B00' },
  { bg: '#E3F3EA', tx: '#1E7145' },
  { bg: '#FBE4E4', tx: '#B3261E' },
  { bg: '#F2F5FA', tx: '#3D4759' },
] as const

export function corInstrutor(indice: number) {
  return PALETA_INSTRUTORES[indice % PALETA_INSTRUTORES.length]
}

export const BLOCOS = ['Aquecimento', 'Principal', 'Acessório', 'Final'] as const
export type BlocoTipo = (typeof BLOCOS)[number]

export const BLOCO_COR: Record<BlocoTipo, string> = {
  Aquecimento: '#0E9594',
  Principal: '#1F3864',
  Acessório: '#5B3FA0',
  Final: '#1E7145',
}

type Modulo = {
  id: string
  nome: string
  icone: string
  desc: string
  pronto: boolean
  restrito?: 'admin' | 'gestao'
}

export const MODULOS: Modulo[] = [
  { id: 'clientes', nome: 'Clientes', icone: '📁', desc: 'Ficha completa de cada cliente, tudo num só sítio', pronto: true },
  { id: 'treinos', nome: 'Treinos', icone: '🏋️', desc: 'Planos, histórico e notas entre PTs', pronto: true },
  { id: 'presencas', nome: 'Presenças', icone: '✅', desc: 'Quem treinou e quem faltou', pronto: true },
  { id: 'avaliacoes', nome: 'Avaliações', icone: '📏', desc: 'Avaliações, reavaliações e evolução', pronto: true },
  { id: 'leads', nome: 'Leads', icone: '📣', desc: 'Contactos, origem e seguimento', pronto: true },
  { id: 'pagamentos', nome: 'Pagamentos', icone: '💳', desc: 'Quem tem o pagamento em dia', pronto: true, restrito: 'admin' },
  { id: 'checklist', nome: 'Abertura / Fecho', icone: '🔑', desc: 'Checklist diária do estúdio', pronto: true },
  { id: 'tarefas', nome: 'Tarefas diárias', icone: '🧹', desc: 'Toalhas, lixos, reposições — o que falta fazer hoje', pronto: true },
  { id: 'horarios', nome: 'Horários', icone: '🕗', desc: 'Escala da semana e ausências da equipa', pronto: true },
]

// Coordenação e Administração deixaram de ser por estúdio — passaram a
// uma página combinada (Fátima + Leiria juntas), acessível a partir de
// /painel (só para admin), não daqui. Ficam de fora desta lista para
// não aparecerem (nem, já agora, como links partidos) na navegação de
// cada estúdio.
