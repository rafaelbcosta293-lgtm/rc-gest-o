'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual } from '@/lib/data/sessao'
import { podeAcederAdmin } from '@/lib/data/acessos'
import { hojeEmLisboa } from '@/lib/data/hoje'
import { arquivarRegistosDoMes } from '@/lib/data/arquivoRegistos'

const ROTA = '/painel/admin/horas'

function voltar(mes: string, extra: Record<string, string>): never {
  const qs = new URLSearchParams(/^\d{4}-\d{2}$/.test(mes) ? { mes } : {})
  for (const [k, v] of Object.entries(extra)) qs.set(k, v)
  // O número de meses por aprovar aparece no menu da Administração.
  revalidatePath('/painel/admin', 'layout')
  redirect(`${ROTA}?${qs.toString()}`)
}

// Aprovar as horas submetidas por um instrutor, ou reabrir o mês para
// ele o corrigir e submeter outra vez. Só o dono entra na Administração
// (e a base de dados confirma: só a gestão altera um mês já submetido).
export async function reverHorasDoMes(formData: FormData) {
  const sessao = await getSessaoAtual()
  if (!podeAcederAdmin(sessao.email)) redirect('/painel?erro=sem-acesso')
  const mesISO = String(formData.get('mes') ?? '')
  const perfilId = String(formData.get('perfil_id') ?? '')
  const [ano, mes] = mesISO.split('-').map(Number)
  if (!ano || !mes || !perfilId) voltar(mesISO, { error: 'Pedido inválido.' })
  const aprovar = formData.get('decisao') === 'aprovar'

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fechos_horario')
    .update(
      aprovar
        ? { estado: 'Aprovado', aprovado_por: sessao.userId, aprovado_em: new Date().toISOString() }
        : { estado: 'Rascunho', aprovado_por: null, aprovado_em: null, submetido_em: null }
    )
    .eq('perfil_id', perfilId)
    .eq('ano', ano)
    .eq('mes', mes)
    .select('id')
  if (error) voltar(mesISO, { error: error.message })
  if (!data || data.length === 0) voltar(mesISO, { error: 'Esse mês ainda não foi submetido.' })
  voltar(mesISO, { ok: aprovar ? 'aprovado' : 'reaberto' })
}

// Guarda (ou refaz) no arquivo o PDF dos registos dos instrutores de um
// mês — o mesmo que a tarefa automática faz nos primeiros dias do mês.
export async function arquivarMes(formData: FormData) {
  const sessao = await getSessaoAtual()
  if (!podeAcederAdmin(sessao.email)) redirect('/painel?erro=sem-acesso')
  const mesISO = String(formData.get('mes') ?? '')
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mesISO)) voltar(mesISO, { error: 'Pedido inválido.' })
  const [ano, mes] = mesISO.split('-').map(Number)
  try {
    await arquivarRegistosDoMes(ano, mes, hojeEmLisboa())
  } catch (e) {
    voltar(mesISO, { error: `Não foi possível guardar o PDF no arquivo: ${(e as Error).message}` })
  }
  voltar(mesISO, { ok: 'arquivado' })
}
