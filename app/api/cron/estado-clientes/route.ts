import { createAdminClient } from '@/lib/supabase/admin'
import { getEstudios } from '@/lib/data/estudios'
import { calcularTransicaoAutomatica } from '@/lib/data/estadoClientes'
import type { Cliente, EstadoCliente } from '@/lib/supabase/database.types'

// Corre uma vez por dia (ver .github/workflows/estado-clientes.yml).
// Transição automática de estado por falta de pagamento: 1 mês sem
// mensalidade ativa -> Suspenso, 2 meses ou mais -> Ex-cliente. Nunca
// mexe num cliente com o estado alterado manualmente (estado_automatico
// = false) — essa é a única exceção pedida. Voltar a Ativo não é tarefa
// deste cron: isso só acontece ao registar um pagamento (ver
// criarPagamento em app/painel/[estudio]/pagamentos/actions.ts).
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
    return Response.json({ ok: true, suspensos: 0, exClientes: 0 })
  }

  const [
    { data: clientesData, error: erroClientes },
    { data: pagamentosData, error: erroPagamentos },
  ] = await Promise.all([
    admin
      .from('clientes')
      .select('id, estado, estado_automatico')
      .neq('estado', 'Ex-cliente')
      .in('estudio_id', estudioIds),
    admin.from('pagamentos').select('cliente_id, valido_ate'),
  ])
  if (erroClientes) return Response.json({ error: erroClientes.message }, { status: 500 })
  if (erroPagamentos) return Response.json({ error: erroPagamentos.message }, { status: 500 })

  const validoAtePorCliente = new Map<string, string>()
  for (const p of pagamentosData ?? []) {
    const atual = validoAtePorCliente.get(p.cliente_id)
    if (!atual || p.valido_ate > atual) validoAtePorCliente.set(p.cliente_id, p.valido_ate)
  }

  const clientes = (clientesData ?? []) as Pick<Cliente, 'id' | 'estado' | 'estado_automatico'>[]

  const idsPorNovoEstado: Record<EstadoCliente, string[]> = { Ativo: [], Suspenso: [], 'Ex-cliente': [] }

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

  return Response.json({
    ok: true,
    suspensos: idsPorNovoEstado.Suspenso.length,
    exClientes: idsPorNovoEstado['Ex-cliente'].length,
  })
}
