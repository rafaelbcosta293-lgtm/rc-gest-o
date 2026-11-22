'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual } from '@/lib/data/sessao'

// A equipa recusa um pedido de desmarcação feito na app do cliente. A
// resposta chega à app na próxima sincronização (segundos). As regras da
// base de dados só deixam mexer em pedidos "em análise" do próprio estúdio.
export async function recusarPedidoApp(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const motivo = String(formData.get('resposta') ?? '').trim().slice(0, 200)
  if (!id) return
  const sessao = await getSessaoAtual()
  const supabase = await createClient()
  await supabase
    .from('app_clientes_pedidos')
    .update({
      estado: 'recusado',
      resposta: motivo ? `Não foi possível desmarcar: ${motivo}` : 'Não foi possível desmarcar este treino. Fale com a equipa do estúdio.',
      tratado_em: new Date().toISOString(),
      tratado_por: sessao.perfil?.id ?? null,
    })
    .eq('id', id)
    .eq('estado', 'em_analise')
  revalidatePath('/painel', 'layout')
}
