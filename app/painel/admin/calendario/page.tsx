import { createClient } from '@/lib/supabase/server'
import { areaBloqueada } from '@/lib/data/gate'
import { getEstudios } from '@/lib/data/estudios'
import { dataNoMes, gerarDespesasRecorrentes } from '@/lib/data/despesas'
import { hojeEmLisboa } from '@/lib/data/hoje'
import { carregarItensCalendario, DIAS_LEMBRETE_ATRASADO, somarDiasISO } from '@/lib/data/lembretes'
import { desbloquearAdmin } from '../actions'
import PortaSenha from '@/components/PortaSenha'
import VistaCalendario from './VistaCalendario'

const ROTA = '/painel/admin/calendario'

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; dia?: string; error?: string; ok?: string; erroSenha?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()

  if (await areaBloqueada(supabase, 'admin')) {
    return <PortaSenha titulo="Administração — Calendário" destino={ROTA} action={desbloquearAdmin} erro={sp.erroSenha} />
  }

  const hoje = hojeEmLisboa()
  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? '') ? sp.mes! : hoje.slice(0, 7)
  const inicioMes = `${mes}-01`
  const fimMes = dataNoMes(mes, 31)
  const diaSel =
    /^\d{4}-\d{2}-\d{2}$/.test(sp.dia ?? '') && sp.dia!.slice(0, 7) === mes ? sp.dia! : mes === hoje.slice(0, 7) ? hoje : inicioMes

  // As recorrentes deste mês e do próximo entram como despesas a sério
  // sem esperar pelo cron (o resto aparece como "previsto").
  try {
    await gerarDespesasRecorrentes(supabase, hoje)
  } catch (e) {
    console.error('Despesas recorrentes não geradas:', e)
  }

  // Uma só leitura cobre o mês aberto e a janela do "por tratar"
  // (atrasados dos últimos dois meses + próximos 7 dias).
  const deAtrasados = somarDiasISO(hoje, -DIAS_LEMBRETE_ATRASADO)
  const ateProximos = somarDiasISO(hoje, 7)
  const de = inicioMes < deAtrasados ? inicioMes : deAtrasados
  const ate = fimMes > ateProximos ? fimMes : ateProximos
  const [itens, estudios] = await Promise.all([carregarItensCalendario(supabase, de, ate, hoje), getEstudios(supabase)])

  return <VistaCalendario itens={itens} estudios={estudios} mes={mes} diaSel={diaSel} hoje={hoje} ok={sp.ok} error={sp.error} />
}
