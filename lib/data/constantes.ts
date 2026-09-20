export const ESTUDIOS = [
  { id: 'fatima', nome: 'Fátima', cor: '#0E9594', bg: '#DDF3F2' },
  { id: 'leiria', nome: 'Leiria', cor: '#ED7D31', bg: '#FDEBDD' },
] as const

export type EstudioId = (typeof ESTUDIOS)[number]['id']

export function estudioDe(id: string) {
  return ESTUDIOS.find((e) => e.id === id) ?? ESTUDIOS[0]
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

export type CorreuTipo = keyof typeof CORREU

export const BLOCOS = ['Aquecimento', 'Principal', 'Acessório', 'Final'] as const
export type BlocoTipo = (typeof BLOCOS)[number]

export const BLOCO_COR: Record<BlocoTipo, string> = {
  Aquecimento: '#0E9594',
  Principal: '#1F3864',
  Acessório: '#5B3FA0',
  Final: '#1E7145',
}

export const MODULOS = [
  { id: 'treinos', nome: 'Treinos', icone: '🏋️', desc: 'Planos, histórico e notas entre PTs', pronto: true },
  { id: 'presencas', nome: 'Presenças', icone: '✅', desc: 'Quem treinou e quem faltou', pronto: false },
  { id: 'avaliacoes', nome: 'Avaliações', icone: '📏', desc: 'Avaliações, reavaliações e evolução', pronto: false },
  { id: 'leads', nome: 'Leads', icone: '📣', desc: 'Contactos, origem e seguimento', pronto: false },
  { id: 'pagamentos', nome: 'Pagamentos', icone: '💳', desc: 'Quem tem o pagamento em dia', pronto: false },
  { id: 'aniversarios', nome: 'Aniversários', icone: '🎂', desc: 'Mensagens de parabéns', pronto: false },
  { id: 'checklist', nome: 'Abertura / Fecho', icone: '🔑', desc: 'Checklist diária do estúdio', pronto: false },
  { id: 'horarios', nome: 'Horários', icone: '🕗', desc: 'Escala da semana e fecho do dia', pronto: false },
  { id: 'coordenacao', nome: 'Coordenação', icone: '🗂️', desc: 'Escalas, controlos e o que está pendente', pronto: false },
  { id: 'admin', nome: 'Administração', icone: '🔒', desc: 'Financeiro e alertas de gestão', pronto: false },
] as const
