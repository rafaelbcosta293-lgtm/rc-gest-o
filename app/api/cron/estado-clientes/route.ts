import { createAdminClient } from '@/lib/supabase/admin'
import { todasAsLinhas } from '@/lib/supabase/todasAsLinhas'
import { getEstudios } from '@/lib/data/estudios'
import { calcularTransicaoAutomatica, melhorEstado } from '@/lib/data/estadoClientes'
import type { Cliente, EstadoCliente } from '@/lib/supabase/database.types'

// Corre uma vez por dia (ver .github/workflows/estado-clientes.yml).
// Transição automática de estado por falta de pagamento: logo no
// primeiro dia sem pagamento válido -> Pendente, 2 meses (60 dias) ou
// mais -> Inativo. Nunca mexe num cliente Suspenso (essa saída é
// sempre manual) nem num com o estado alterado manualmente
// (estado_automatico = false). Voltar a Ativo não é tarefa deste
// cron: isso só acontece ao registar um pagamento (ver criarPagamento
// em app/painel/[estudio]/pagamentos/actions.ts).
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const esperado = process.env.CRON_SECRET
  const recebido = request.headers.get('authorization')
  if (!esperado || recebido !== `Bearer ${esperado}`) {
    return new Response('unauthorized', { status: 401 })
  }

  const admin = createAdminClient()
  const hojeISO = new Date().toISOString().slice(0, 10)

  const estudios = await getEstudios(admin)
  const estudioIds = estudios.map((e) => e.id)
  if (estudioIds.length === 0) {
    return Response.json({ ok: true, pendentes: 0, inativos: 0 })
  }

  const [
    { data: clientesData, error: erroClientes },
    { data: pagamentosData, error: erroPagamentos },
  ] = await Promise.all([
    admin
      .from('clientes')
      .select('id, estado, estado_automatico')
      .not('estado', 'in', '(Suspenso,Inativo)')
      .eq('cliente_pt', true)
      .eq('teste', false)
      .in('estudio_id', estudioIds),
    todasAsLinhas<{ cliente_id: string; validade_maxima: string }>((de, ate) =>
      admin
        .from('v_resumo_pagamentos_cliente')
        .select('cliente_id, validade_maxima')
        .order('cliente_id')
        .range(de, ate)
    ),
  ])
  if (erroClientes) return Response.json({ error: erroClientes.message }, { status: 500 })
  if (erroPagamentos) return Response.json({ error: erroPagamentos.message }, { status: 500 })

  const validoAtePorCliente = new Map(pagamentosData.map((p) => [p.cliente_id, p.validade_maxima]))

  const clientes = (clientesData ?? []) as Pick<Cliente, 'id' | 'estado' | 'estado_automatico'>[]

  const idsPorNovoEstado: Record<EstadoCliente, string[]> = {
    Ativo: [],
    Pendente: [],
    Suspenso: [],
    Inativo: [],
  }

  for (const c of clientes) {
    const novoEstado = calcularTransicaoAutomatica(
      {
        id: c.id,
        estado: c.estado,
        estadoAutomatico: c.estado_automatico,
        validoAte: validoAtePorCliente.get(c.id) ?? null,
      },
      hojeISO
    )
    if (novoEstado) idsPorNovoEstado[novoEstado].push(c.id)
  }

  for (const [estado, ids] of Object.entries(idsPorNovoEstado) as [EstadoCliente, string[]][]) {
    if (ids.length === 0) continue
    const { error } = await admin.from('clientes').update({ estado }).in('id', ids)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  // ── Outros serviços (aulas de grupo, nutrição) ─────────────────────
  // As mesmas regras, por serviço, com os pagamentos desse serviço.
  const [{ data: inscricoesData, error: erroInscricoes }, { data: validadesData, error: erroValidades }] =
    await Promise.all([
      admin.from('clientes_servicos').select('cliente_id, servico_id, estado, estado_automatico'),
      admin.from('v_validade_por_servico').select('cliente_id, servico_id, validade_maxima').neq('servico_id', 1),
    ])
  if (erroInscricoes) return Response.json({ error: erroInscricoes.message }, { status: 500 })
  if (erroValidades) return Response.json({ error: erroValidades.message }, { status: 500 })
  const validade = new Map((validadesData ?? []).map((v) => [`${v.cliente_id}|${v.servico_id}`, v.validade_maxima as string]))
  const inscricoes = (inscricoesData ?? []) as {
    cliente_id: string
    servico_id: number
    estado: EstadoCliente
    estado_automatico: boolean
  }[]
  let mudancasServicos = 0
  for (const i of inscricoes) {
    const novo = calcularTransicaoAutomatica(
      {
        id: i.cliente_id,
        estado: i.estado,
        estadoAutomatico: i.estado_automatico,
        validoAte: validade.get(`${i.cliente_id}|${i.servico_id}`) ?? null,
      },
      hojeISO
    )
    if (!novo) continue
    const { error } = await admin
      .from('clientes_servicos')
      .update({ estado: novo, ...(novo === 'Inativo' ? { saiu_em: hojeISO } : {}) })
      .eq('cliente_id', i.cliente_id)
      .eq('servico_id', i.servico_id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    i.estado = novo
    mudancasServicos++
  }

  // Quem não é cliente de PT: o estado geral acompanha o melhor estado
  // nos outros serviços (é o que as listas gerais mostram).
  const { data: soOutrosData, error: erroSoOutros } = await admin
    .from('clientes')
    .select('id, estado')
    .eq('cliente_pt', false)
    .eq('teste', false)
    .in('estudio_id', estudioIds)
  if (erroSoOutros) return Response.json({ error: erroSoOutros.message }, { status: 500 })
  for (const c of (soOutrosData ?? []) as { id: string; estado: EstadoCliente }[]) {
    const novo = melhorEstado(inscricoes.filter((i) => i.cliente_id === c.id).map((i) => i.estado))
    if (novo === c.estado) continue
    const { error } = await admin.from('clientes').update({ estado: novo }).eq('id', c.id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({
    ok: true,
    pendentes: idsPorNovoEstado.Pendente.length,
    inativos: idsPorNovoEstado.Inativo.length,
    mudancasServicos,
  })
}
