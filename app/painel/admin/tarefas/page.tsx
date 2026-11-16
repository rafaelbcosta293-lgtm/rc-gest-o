import { createClient } from '@/lib/supabase/server'
import { areaBloqueada } from '@/lib/data/gate'
import PortaSenha from '@/components/PortaSenha'
import VistaTarefas, { type ParametrosTarefas } from '@/components/tarefas/VistaTarefas'
import { desbloquearAdmin } from '../actions'

const ROTA = '/painel/admin/tarefas'

export default async function TarefasAdminPage({ searchParams }: { searchParams: Promise<ParametrosTarefas & { erroSenha?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  if (await areaBloqueada(supabase, 'admin')) {
    return <PortaSenha titulo="Administração — Tarefas" destino={ROTA} action={desbloquearAdmin} erro={sp.erroSenha} />
  }
  return <VistaTarefas base={ROTA} sp={sp} voltarPara={{ href: '/painel/admin', rotulo: 'Administração' }} />
}
