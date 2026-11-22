import { createHash } from 'node:crypto'
import { primeiroNome } from '@/lib/data/clientes'
import { instanteLisboa } from './tempo'

// O que se copia para a base de dados da app do cliente. Funções puras:
// recebem linhas da gestão e devolvem SÓ os campos que o cliente pode
// ver — nunca nomes de outros clientes, notas internas, telefones,
// pagamentos, etc. (ver app-clientes/supabase/migrations).

export const HORAS_CANCELAR_AULA = 2

export type AulaGestao = {
  id: string
  estudio_id: number
  servico_id: number
  data: string
  hora_inicio: string
  duracao_min: number
  instrutor_id: string | null
  lotacao: number
  estado: string
}

export type AulaApp = {
  id: string
  estudio_slug: string
  servico: string
  data: string
  hora_inicio: string
  duracao_min: number
  instrutor: string | null
  lotacao: number
  ocupadas: number
  estado: string
  reserva_abre_em: string | null
  cancelar_ate: string
}

const hhmm = (h: string) => h.slice(0, 5)

export function montarAulas(
  aulas: AulaGestao[],
  ocupadas: Map<string, number>,
  servicos: Map<number, { nome: string; reserva_abre_horas: number | null }>,
  nomes: Map<string, string>,
  slugs: Map<number, string>
): AulaApp[] {
  const r: AulaApp[] = []
  for (const a of aulas) {
    const slug = slugs.get(a.estudio_id)
    if (!slug) continue
    const servico = servicos.get(a.servico_id)
    const inicio = instanteLisboa(a.data, a.hora_inicio)
    const abre = servico?.reserva_abre_horas
    r.push({
      id: a.id,
      estudio_slug: slug,
      servico: servico?.nome ?? 'Aula',
      data: a.data,
      hora_inicio: hhmm(a.hora_inicio),
      duracao_min: a.duracao_min,
      instrutor: a.instrutor_id ? primeiroNome(nomes.get(a.instrutor_id) ?? '') || null : null,
      lotacao: a.lotacao,
      ocupadas: Math.min(a.lotacao, ocupadas.get(a.id) ?? 0),
      estado: a.estado,
      reserva_abre_em: abre ? new Date(inicio.getTime() - abre * 3600_000).toISOString() : null,
      cancelar_ate: new Date(inicio.getTime() - HORAS_CANCELAR_AULA * 3600_000).toISOString(),
    })
  }
  return r.sort((x, y) => (x.data + x.hora_inicio).localeCompare(y.data + y.hora_inicio) || x.id.localeCompare(y.id))
}

export type EventoGestao = {
  id: string
  cliente_id: string
  tipo: string
  data: string
  hora_inicio: string
  duracao_min: number
  estado: string
  pt_id: string | null
  servico_id: number | null
}
export type PresencaGestao = { id: string; cliente_id: string; data: string; estado: string }
export type InscricaoGestao = { id: string; cliente_id: string; aula_id: string; estado: string; data: string; servico_id: number }
export type AvaliacaoGestao = {
  id: string
  cliente_id: string
  data: string
  peso_kg: number | null
  altura_cm: number | null
  massa_gorda_pct: number | null
  massa_gorda_kg: number | null
  massa_magra_kg: number | null
  massa_muscular_kg: number | null
  gordura_visceral: number | null
  hidratacao_pct: number | null
  metabolismo_kcal: number | null
  idade_metabolica: number | null
  imc: number | null
  proxima_reavaliacao: string | null
}

export type DadosConta = {
  conta_id: string
  nome: string
  inscricoes: { aula_id: string; estado: string }[]
  treinos: { id: string; data: string; hora_inicio: string; duracao_min: number; servico: string | null; instrutor: string | null; estado: string }[]
  presencas: { id: string; data: string; estado: string; tipo: string }[]
  avaliacoes: Omit<AvaliacaoGestao, 'cliente_id'>[]
}

const porDataHora = <T extends { data: string; hora_inicio?: string; id: string }>(a: T, b: T) =>
  (a.data + (a.hora_inicio ?? '')).localeCompare(b.data + (b.hora_inicio ?? '')) || a.id.localeCompare(b.id)

export function montarDadosConta(input: {
  contaId: string
  nome: string
  eventos: EventoGestao[]
  presencas: PresencaGestao[]
  inscricoes: InscricaoGestao[]
  avaliacoes: AvaliacaoGestao[]
  aulasNaApp: Set<string>
  servicos: Map<number, { nome: string }>
  nomes: Map<string, string>
}): DadosConta {
  const nomeServico = (id: number | null) => (id != null ? input.servicos.get(id)?.nome ?? null : null)
  const treinos = input.eventos
    .filter((e) => e.tipo === 'Treino' || e.tipo === 'Avaliação')
    .map((e) => ({
      id: e.id,
      data: e.data,
      hora_inicio: hhmm(e.hora_inicio),
      duracao_min: e.duracao_min,
      servico: e.tipo === 'Avaliação' ? 'Avaliação física' : nomeServico(e.servico_id) ?? 'Treino',
      instrutor: e.pt_id ? primeiroNome(input.nomes.get(e.pt_id) ?? '') || null : null,
      estado: e.estado,
    }))
    .sort(porDataHora)

  const presencas = [
    ...input.presencas.map((p) => ({ id: p.id, data: p.data, estado: p.estado, tipo: 'Treino' })),
    ...input.inscricoes
      .filter((i) => i.estado === 'Presente' || i.estado === 'Faltou')
      .map((i) => ({ id: i.id, data: i.data, estado: i.estado, tipo: nomeServico(i.servico_id) ?? 'Aula' })),
  ].sort(porDataHora)

  return {
    conta_id: input.contaId,
    nome: input.nome,
    inscricoes: input.inscricoes
      .filter((i) => input.aulasNaApp.has(i.aula_id))
      .map((i) => ({ aula_id: i.aula_id, estado: i.estado }))
      .sort((a, b) => a.aula_id.localeCompare(b.aula_id)),
    treinos,
    presencas,
    avaliacoes: input.avaliacoes
      .map((a) => {
        const { cliente_id, ...resto } = a
        void cliente_id
        return resto
      })
      .sort(porDataHora),
  }
}

// Impressão digital dos dados de uma conta: só se envia de novo quando muda.
export function impressao(d: unknown): string {
  return createHash('sha256').update(JSON.stringify(d)).digest('hex')
}
