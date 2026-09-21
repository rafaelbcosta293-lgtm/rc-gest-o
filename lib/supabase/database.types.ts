import type { BlocoTipo } from '@/lib/data/constantes'

export type Papel = 'admin' | 'studio_manager' | 'master_trainer' | 'pt'

export type Estudio = {
  id: number
  slug: string
  nome: string
  endereco: string | null
  ativo: boolean
}

export type Perfil = {
  id: string
  nome: string
  papel: Papel
  telefone: string | null
  ativo: boolean
  saiu_em: string | null
  criado_em: string
}

export type EstadoCliente = 'Ativo' | 'Suspenso' | 'Ex-cliente'

export type Cliente = {
  id: string
  estudio_id: number
  nome: string
  telefone: string | null
  email: string | null
  nascimento: string | null
  objetivo: string | null
  frequencia_semanal: number | null
  pt_principal_id: string | null
  estado: EstadoCliente
  alerta: string
  alerta_detalhe: string | null
  evento: string | null
  evento_data: string | null
  inicio_contrato: string | null
  fim_experiencia: string | null
  saiu_em: string | null
  motivo_saida: string | null
  notas: string | null
  criado_em: string
}

export type Sessao = {
  id: string
  cliente_id: string
  pt_id: string | null
  estudio_id: number
  data: string
  foco: string | null
  correu: string | null
  nota_proxima: string
  tipo_nota: string | null
  validada_por: string | null
  validada_em: string | null
  criado_em: string
}

export type SessaoExercicio = {
  id: string
  sessao_id: string
  ordem: number
  bloco: BlocoTipo
  exercicio_id: string | null
  exercicio_nome: string
  series: string | null
  reps: string | null
  carga: string | null
  descanso: string | null
  nota: string | null
}

export type Categoria = {
  id: string
  parte: 'A' | 'B'
  nome: string
  nota: string | null
  ordem: number
  ativo: boolean
}

export type ExercicioCatalogo = {
  id: string
  nome: string
  notas: string | null
  ativo: boolean
}

export type TipoOperacao = 'Abertura' | 'Fecho'

export type ChecklistModelo = {
  id: string
  tipo: TipoOperacao
  secao: string
  item: string
  ordem: number
  ativo: boolean
}

export type ChecklistRegisto = {
  id: string
  estudio_id: number
  tipo: TipoOperacao
  data: string
  hora: string
  pt_id: string | null
  concluidos: number
  total: number
  ocorrencia: string | null
  criado_em: string
}

export type ChecklistResposta = {
  id: string
  registo_id: string
  secao: string
  item: string
  ok: boolean
}

export type EstadoLead =
  | 'Novo'
  | 'Contactado'
  | 'Visita marcada'
  | 'Visita feita'
  | 'Convertido'
  | 'Perdido'

export type TipoContacto = 'Telefone' | 'WhatsApp' | 'Email' | 'Presencial' | 'Mensagem redes'

export type Lead = {
  id: string
  estudio_id: number
  nome: string
  telefone: string | null
  email: string | null
  origem: string | null
  objetivo: string | null
  interesse: string | null
  disponibilidade: string | null
  estado: EstadoLead
  responsavel_id: string | null
  entrada: string
  proximo_contacto: string | null
  visita_data: string | null
  visita_hora: string | null
  visita_marcada_em: string | null
  fecho_em: string | null
  valor_potencial: number | null
  motivo_perda: string | null
  cliente_id: string | null
  nota: string | null
  criado_em: string
}

export type LeadContacto = {
  id: string
  lead_id: string
  data: string
  tipo: TipoContacto
  resultado: string
  nota: string | null
  feito_por: string | null
  criado_em: string
}

export type Escala = {
  id: string
  estudio_id: number
  data: string
  hora: number
  minuto: number
  pt_id: string
  criado_em: string
}

export type TipoAusencia = 'Férias' | 'Baixa' | 'Formação' | 'Outra'

export type Ausencia = {
  id: string
  pt_id: string
  inicio: string
  fim: string
  tipo: TipoAusencia
  nota: string | null
}

export type Plano = {
  id: string
  nome: string
  valor: number
  sessoes_por_semana: number | null
  ativo: boolean
}

export type Pagamento = {
  id: string
  cliente_id: string
  plano_id: string | null
  valor: number
  metodo: string | null
  data_pagamento: string
  valido_ate: string
  inclui_inscricao: boolean
  inclui_seguro: boolean
  inclui_reativacao: boolean
  nota: string | null
  registado_por: string | null
  criado_em: string
}

export type EstadoPagamento = {
  cliente_id: string
  estudio_id: number
  nome: string
  valido_ate: string | null
  em_dia: boolean
}

export type ConfigLinha = {
  chave: string
  valor: string | null
}

export type LeadParada = Lead & {
  ultimo_contacto: string | null
  dias_sem_contacto: number
}

export type ReavaliacaoPendente = {
  cliente_id: string
  estudio_id: number
  nome: string
  ultima_avaliacao: string | null
  proxima_reavaliacao: string | null
  dias_para_reavaliar: number | null
  precisa_atencao: boolean
}

export type RegistoPt = {
  id: string
  pt_id: string
  estudio_id: number
  data: string
  horas: number
  treinos_40: number
  treinos_60: number
  nota: string | null
  criado_em: string
}

export type Avaliacao = {
  id: string
  cliente_id: string
  pt_id: string | null
  data: string
  peso_kg: number | null
  altura_cm: number | null
  massa_gorda_pct: number | null
  massa_gorda_kg: number | null
  massa_muscular_kg: number | null
  massa_magra_kg: number | null
  gordura_visceral: number | null
  hidratacao_pct: number | null
  metabolismo_kcal: number | null
  imc: number | null
  proxima_reavaliacao: string | null
  nota: string | null
  validada_por: string | null
  criado_em: string
}
