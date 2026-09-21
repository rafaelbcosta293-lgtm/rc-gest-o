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
