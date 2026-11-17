import type { SupabaseClient } from '@supabase/supabase-js'
import type { EstadoCliente } from '@/lib/supabase/database.types'
import { somarDias } from './horarios'

// Gestão isolada de um serviço de grupo (Treino Acompanhado, Pilates):
// quem está inscrito nele — incluindo quem também é cliente de PT, que
// aparece aqui e no PT, com o estado próprio de cada lado — com a
// validade dos pagamentos DESTE serviço e as aulas marcadas.

export type ClienteDoServico = {
  clienteId: string
  nome: string
  numeroSocio: string | null
  telefone: string | null
  estado: EstadoCliente
  inicio: string | null
  saiuEm: string | null
  // Validade da última mensalidade deste serviço (null = nunca pagou).
  validoAte: string | null
  emDia: boolean
  // Também é cliente de PT (e qual o estado lá).
  estadoPt: EstadoCliente | null
  proximaAula: string | null
  ultimaPresenca: string | null
  presencasMes: number
}

export type ResumoServico = {
  ativos: number
  pendentes: number
  emAtraso: number
  semAulasMarcadas: number
  tambemPt: number
  aulasSemana: number
  ocupacaoSemana: number | null // % de lugares ocupados nas aulas abertas da semana
}

// Dias à frente em que alguém ativo devia ter pelo menos uma aula marcada.
export const DIAS_SEM_AULA = 7

// Quem precisa de atenção: pagamentos em atraso (menos os inativos) e
// ativos sem nenhuma aula marcada nos próximos dias.
export function emAtraso(c: Pick<ClienteDoServico, 'estado' | 'emDia'>): boolean {
  return c.estado !== 'Inativo' && !c.emDia
}

export function semAulaMarcada(c: Pick<ClienteDoServico, 'estado' | 'proximaAula'>, hoje: string): boolean {
  return c.estado === 'Ativo' && (!c.proximaAula || c.proximaAula > somarDias(hoje, DIAS_SEM_AULA))
}

export function resumir(clientes: ClienteDoServico[], hoje: string, aulas: { lotacao: number; ocupadas: number }[]): ResumoServico {
  const lugares = aulas.reduce((s, a) => s + a.lotacao, 0)
  return {
    ativos: clientes.filter((c) => c.estado === 'Ativo').length,
    pendentes: clientes.filter((c) => c.estado === 'Pendente').length,
    emAtraso: clientes.filter(emAtraso).length,
    semAulasMarcadas: clientes.filter((c) => semAulaMarcada(c, hoje)).length,
    tambemPt: clientes.filter((c) => c.estado !== 'Inativo' && c.estadoPt && c.estadoPt !== 'Inativo').length,
    aulasSemana: aulas.length,
    ocupacaoSemana: lugares > 0 ? Math.round((aulas.reduce((s, a) => s + a.ocupadas, 0) / lugares) * 100) : null,
  }
}

export async function carregarClientesDoServico(
  supabase: SupabaseClient,
  estudioId: number,
  servicoId: number,
  hoje: string
): Promise<ClienteDoServico[]> {
  const { data: inscricoes } = await supabase
    .from('clientes_servicos')
    .select('cliente_id, estado, inicio, saiu_em, cliente:clientes!inner(id, nome, numero_socio, telefone, estado, cliente_pt, estudio_id)')
    .eq('servico_id', servicoId)
    .eq('cliente.estudio_id', estudioId)
  const linhas = (inscricoes ?? []) as unknown as {
    cliente_id: string
    estado: EstadoCliente
    inicio: string | null
    saiu_em: string | null
    cliente: { nome: string; numero_socio: string | null; telefone: string | null; estado: EstadoCliente; cliente_pt: boolean }
  }[]
  if (linhas.length === 0) return []
  const ids = linhas.map((l) => l.cliente_id)
  const inicioMes = `${hoje.slice(0, 7)}-01`

  const [{ data: validades }, { data: aulasCliente }] = await Promise.all([
    supabase.from('v_validade_por_servico').select('cliente_id, validade_maxima').eq('servico_id', servicoId).in('cliente_id', ids),
    supabase
      .from('aulas_inscricoes')
      .select('cliente_id, estado, aula:aulas!inner(data, servico_id, estado)')
      .in('cliente_id', ids)
      .eq('aula.servico_id', servicoId),
  ])
  const validade = new Map((validades ?? []).map((v) => [v.cliente_id as string, v.validade_maxima as string]))
  const porCliente = new Map<string, { estado: string; data: string; aulaEstado: string }[]>()
  for (const i of (aulasCliente ?? []) as unknown as { cliente_id: string; estado: string; aula: { data: string; estado: string } }[]) {
    porCliente.set(i.cliente_id, [...(porCliente.get(i.cliente_id) ?? []), { estado: i.estado, data: i.aula.data, aulaEstado: i.aula.estado }])
  }

  return linhas
    .map((l) => {
      const aulas = porCliente.get(l.cliente_id) ?? []
      const futuras = aulas
        .filter((a) => a.estado === 'Inscrito' && a.aulaEstado === 'Aberta' && a.data >= hoje)
        .map((a) => a.data)
        .sort()
      const presencas = aulas.filter((a) => a.estado === 'Presente').map((a) => a.data).sort()
      const validoAte = validade.get(l.cliente_id) ?? null
      return {
        clienteId: l.cliente_id,
        nome: l.cliente.nome,
        numeroSocio: l.cliente.numero_socio,
        telefone: l.cliente.telefone,
        estado: l.estado,
        inicio: l.inicio,
        saiuEm: l.saiu_em,
        validoAte,
        emDia: !!validoAte && validoAte >= hoje,
        estadoPt: l.cliente.cliente_pt ? l.cliente.estado : null,
        proximaAula: futuras[0] ?? null,
        ultimaPresenca: presencas[presencas.length - 1] ?? null,
        presencasMes: presencas.filter((d) => d >= inicioMes && d <= hoje).length,
      }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
}

// Aulas abertas da semana de um serviço, com a ocupação (para o resumo).
export async function carregarOcupacaoSemana(
  supabase: SupabaseClient,
  estudioId: number,
  servicoId: number,
  inicio: string,
  fim: string
): Promise<{ lotacao: number; ocupadas: number }[]> {
  const { data } = await supabase
    .from('aulas')
    .select('lotacao, aulas_inscricoes(estado)')
    .eq('estudio_id', estudioId)
    .eq('servico_id', servicoId)
    .eq('estado', 'Aberta')
    .gte('data', inicio)
    .lte('data', fim)
  return ((data ?? []) as { lotacao: number; aulas_inscricoes: { estado: string }[] | null }[]).map((a) => ({
    lotacao: a.lotacao,
    ocupadas: (a.aulas_inscricoes ?? []).filter((i) => i.estado !== 'Cancelada').length,
  }))
}
