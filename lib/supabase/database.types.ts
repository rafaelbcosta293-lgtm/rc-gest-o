import type { AlertaTipo, BlocoTipo, CorreuTipo, EstudioId } from '@/lib/data/constantes'

export type Profile = {
  id: string
  nome: string
  role: 'pt' | 'admin'
  created_at: string
}

export type Cliente = {
  id: string
  nome: string
  estudio: EstudioId
  pt: string | null
  objetivo: string | null
  frequencia: number | null
  alerta: AlertaTipo
  detalhe: string | null
  evento: string | null
  evento_data: string | null
  nascimento: string | null
  telefone: string | null
  estado: 'Ativo' | 'Ex-cliente'
  saiu_em: string | null
  motivo_saida: string | null
  created_at: string
  updated_at: string
}

export type ExercicioSessao = {
  id: string
  bloco: BlocoTipo
  nome: string
  series: string
  reps: string
  carga: string
  descanso: string
  nota: string
}

export type Sessao = {
  id: string
  cliente_id: string
  data: string
  pt: string | null
  foco: string | null
  correu: CorreuTipo | null
  exercicios: ExercicioSessao[]
  nota_proxima: string | null
  tipo_nota: string | null
  created_at: string
  updated_at: string
}
