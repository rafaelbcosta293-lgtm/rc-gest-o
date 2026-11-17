'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { ehContaFixa } from '@/lib/data/acessos'
import { hojeEmLisboa } from '@/lib/data/hoje'
import { gerarAulas, type EstadoInscricao } from '@/lib/data/aulas'

export type ResultadoAula = { ok: true } | { error: string }

const caminho = (slug: string) => `/painel/${slug}/aulas`

// Mesma regra da Agenda: as contas pessoais só podem ver, a não ser que
// a Administração lhes tenha dado escrita na Agenda.
async function podeEscrever(): Promise<boolean> {
  const sessao = await getSessaoAtual()
  return ehContaFixa(sessao.email) || !!sessao.agendaEscrita
}

async function soGestao(): Promise<boolean> {
  return papeisDaSessao(await getSessaoAtual()).ehGestao
}

// Inscreve um cliente numa aula. A vaga é garantida pela base de dados
// (inscrever_em_aula) — é a mesma função que a app dos clientes vai usar.
export async function inscreverNaAula(input: { estudioSlug: string; aulaId: string; clienteId: string }): Promise<ResultadoAula> {
  if (!(await podeEscrever())) return { error: 'A tua conta só pode ver as aulas.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('inscrever_em_aula', { p_aula: input.aulaId, p_cliente: input.clienteId, p_origem: 'equipa' })
  if (error) return { error: error.message }
  revalidatePath(caminho(input.estudioSlug))
  return { ok: true }
}

// Presente / Faltou / Inscrito (desfazer) / Cancelada (liberta a vaga).
export async function mudarInscricao(input: { estudioSlug: string; inscricaoId: string; estado: EstadoInscricao }): Promise<ResultadoAula> {
  if (!(await podeEscrever())) return { error: 'A tua conta só pode ver as aulas.' }
  if (!['Inscrito', 'Presente', 'Faltou', 'Cancelada'].includes(input.estado)) return { error: 'Estado inválido.' }
  const supabase = await createClient()
  if (input.estado === 'Inscrito') {
    // Voltar a "Inscrito" depois de cancelada ocupa outra vez um lugar:
    // passa pela função que confere a lotação.
    const { data: i } = await supabase.from('aulas_inscricoes').select('aula_id, cliente_id, estado').eq('id', input.inscricaoId).maybeSingle()
    if (i?.estado === 'Cancelada') {
      const { error } = await supabase.rpc('inscrever_em_aula', { p_aula: i.aula_id, p_cliente: i.cliente_id, p_origem: 'equipa' })
      if (error) return { error: error.message }
      revalidatePath(caminho(input.estudioSlug))
      return { ok: true }
    }
  }
  const { error } = await supabase
    .from('aulas_inscricoes')
    .update({ estado: input.estado, atualizado_em: new Date().toISOString() })
    .eq('id', input.inscricaoId)
  if (error) return { error: error.message }
  revalidatePath(caminho(input.estudioSlug))
  return { ok: true }
}

export async function cancelarAula(input: { estudioSlug: string; aulaId: string; motivo: string | null }): Promise<ResultadoAula> {
  if (!(await podeEscrever())) return { error: 'A tua conta só pode ver as aulas.' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('aulas')
    .update({ estado: 'Cancelada', motivo_cancelamento: input.motivo?.trim() || null })
    .eq('id', input.aulaId)
  if (error) return { error: error.message }
  revalidatePath(caminho(input.estudioSlug))
  return { ok: true }
}

export async function reabrirAula(input: { estudioSlug: string; aulaId: string }): Promise<ResultadoAula> {
  if (!(await podeEscrever())) return { error: 'A tua conta só pode ver as aulas.' }
  const supabase = await createClient()
  const { error } = await supabase.from('aulas').update({ estado: 'Aberta', motivo_cancelamento: null }).eq('id', input.aulaId)
  if (error) return { error: error.message }
  revalidatePath(caminho(input.estudioSlug))
  return { ok: true }
}

// Lotação, instrutor, hora e duração de uma aula concreta (não mexe no
// horário semanal — só nesta aula).
export async function editarAula(input: {
  estudioSlug: string
  aulaId: string
  lotacao: number
  instrutorId: string | null
  horaInicio: string
  duracaoMin: number
}): Promise<ResultadoAula> {
  if (!(await podeEscrever())) return { error: 'A tua conta só pode ver as aulas.' }
  if (!Number.isInteger(input.lotacao) || input.lotacao < 1 || input.lotacao > 50) return { error: 'Lotação inválida.' }
  if (!/^\d{2}:\d{2}/.test(input.horaInicio)) return { error: 'Hora inválida.' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('aulas')
    .update({ lotacao: input.lotacao, instrutor_id: input.instrutorId || null, hora_inicio: input.horaInicio, duracao_min: input.duracaoMin })
    .eq('id', input.aulaId)
  if (error) return { error: error.message }
  revalidatePath(caminho(input.estudioSlug))
  return { ok: true }
}

function texto(f: FormData, k: string): string | null {
  const v = f.get(k)
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function voltar(f: FormData, extra: Record<string, string>) {
  const base = texto(f, 'voltar') ?? caminho(String(f.get('estudio_slug')))
  const url = new URL(base, 'http://x')
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v)
  redirect(`${url.pathname}${url.search}`)
}

// Lotação escrita no formulário, ou a do serviço (8 / 5) se vazia.
async function lotacaoDoFormulario(supabase: Awaited<ReturnType<typeof createClient>>, f: FormData, servicoId: number): Promise<number | null> {
  const escrita = Number(f.get('lotacao'))
  if (Number.isInteger(escrita) && escrita > 0) return escrita
  const { data } = await supabase.from('servicos').select('lotacao_omissao').eq('id', servicoId).maybeSingle()
  return (data?.lotacao_omissao as number | null) ?? null
}

// Uma aula avulsa (fora do horário semanal).
export async function criarAulaAvulsa(formData: FormData) {
  if (!(await podeEscrever())) voltar(formData, { error: 'A tua conta só pode ver as aulas.' })
  const estudioId = Number(formData.get('estudio_id'))
  const servicoId = Number(formData.get('servico_id'))
  const data = texto(formData, 'data')
  const hora = texto(formData, 'hora_inicio')
  const supabase = await createClient()
  const lotacao = await lotacaoDoFormulario(supabase, formData, servicoId)
  if (!estudioId || !servicoId || !data || !hora || !lotacao) voltar(formData, { error: 'Indica o serviço, o dia, a hora e a lotação.' })
  const { data: fechado } = await supabase.from('dias_fechados').select('motivo').eq('estudio_id', estudioId).eq('data', data!).maybeSingle()
  if (fechado) voltar(formData, { error: `O estúdio está fechado nesse dia (${fechado.motivo ?? 'dia fechado'}).` })
  const { error } = await supabase.from('aulas').insert({
    estudio_id: estudioId,
    servico_id: servicoId,
    data,
    hora_inicio: hora,
    duracao_min: Number(formData.get('duracao_min')) || 50,
    instrutor_id: texto(formData, 'instrutor_id'),
    lotacao,
  })
  if (error) voltar(formData, { error: error.message })
  revalidatePath(caminho(String(formData.get('estudio_slug'))))
  voltar(formData, { ok: 'aula-criada' })
}

// Horário semanal (só a gestão): cria o modelo e abre logo as aulas das
// próximas semanas.
export async function guardarHorarioAula(formData: FormData) {
  if (!(await soGestao())) voltar(formData, { error: 'Só a gestão pode mudar o horário das aulas.' })
  const estudioId = Number(formData.get('estudio_id'))
  const servicoId = Number(formData.get('servico_id'))
  const dia = Number(formData.get('dia_semana'))
  const hora = texto(formData, 'hora_inicio')
  const supabase = await createClient()
  const lotacao = await lotacaoDoFormulario(supabase, formData, servicoId)
  if (!estudioId || !servicoId || !dia || !hora || !lotacao) voltar(formData, { error: 'Indica o serviço, o dia, a hora e a lotação.' })
  const { error } = await supabase.from('aulas_horario').insert({
    estudio_id: estudioId,
    servico_id: servicoId,
    dia_semana: dia,
    hora_inicio: hora,
    duracao_min: Number(formData.get('duracao_min')) || 50,
    instrutor_id: texto(formData, 'instrutor_id'),
    lotacao,
    desde: texto(formData, 'desde') ?? hojeEmLisboa(),
  })
  if (error) voltar(formData, { error: error.message })
  await gerarAulas(supabase, estudioId, hojeEmLisboa())
  revalidatePath(caminho(String(formData.get('estudio_slug'))))
  voltar(formData, { ok: 'horario-criado' })
}

// Tira um horário do calendário: deixa de gerar aulas e apaga as aulas
// futuras dele ainda sem ninguém inscrito (as que têm inscritos ficam,
// para se avisar as pessoas e cancelar à mão).
export async function terminarHorarioAula(formData: FormData) {
  if (!(await soGestao())) voltar(formData, { error: 'Só a gestão pode mudar o horário das aulas.' })
  const id = texto(formData, 'id')
  if (!id) voltar(formData, {})
  const supabase = await createClient()
  const hoje = hojeEmLisboa()
  const { error } = await supabase.from('aulas_horario').update({ ativo: false, ate: hoje }).eq('id', id!)
  if (error) voltar(formData, { error: error.message })
  const { data: futuras } = await supabase.from('aulas').select('id, aulas_inscricoes(estado)').eq('horario_id', id!).gt('data', hoje)
  const semNinguem = (futuras ?? [])
    .filter((a) => !((a.aulas_inscricoes as { estado: string }[] | null) ?? []).some((i) => i.estado !== 'Cancelada'))
    .map((a) => a.id as string)
  if (semNinguem.length > 0) await supabase.from('aulas').delete().in('id', semNinguem)
  const ficaram = (futuras?.length ?? 0) - semNinguem.length
  revalidatePath(caminho(String(formData.get('estudio_slug'))))
  voltar(formData, ficaram > 0 ? { ok: 'horario-terminado', ficaram: String(ficaram) } : { ok: 'horario-terminado' })
}
