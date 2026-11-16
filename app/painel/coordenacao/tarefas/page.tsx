import { createClient } from '@/lib/supabase/server'
import { areaBloqueada } from '@/lib/data/gate'
import PortaSenha from '@/components/PortaSenha'
import VistaTarefas, { type ParametrosTarefas } from '@/components/tarefas/VistaTarefas'
import { desbloquearCoordenacao } from '../actions'

const ROTA = '/painel/coordenacao/tarefas'

export default async function TarefasCoordenacaoPage({ searchParams }: { searchParams: Promise<ParametrosTarefas & { erroSenha?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  if (await areaBloqueada(supabase, 'coordenacao')) {
    return <PortaSenha titulo="Coordenação — Tarefas" destino={ROTA} action={desbloquearCoordenacao} erro={sp.erroSenha} />
  }
  return <VistaTarefas base={ROTA} sp={sp} voltarPara={{ href: '/painel/coordenacao', rotulo: 'Resumo' }} />
}
