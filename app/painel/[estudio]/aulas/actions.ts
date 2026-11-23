'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { ehContaFixa } from '@/lib/data/acessos'
import { hojeEmLisboa } from '@/lib/data/hoje'
import { gerarAulas, type EscopoAula, type EstadoInscricao } from '@/lib/data/aulas'

export type ResultadoAula = { ok: true } | { error: string }

const caminho = (slug: string) => `/painel/${slug}/aulas`

// Mesma regra da Agenda: as contas pessoais só podem ver, a não ser que
// a Administração lhes tenha dado escrita na Agenda.
async function podeEscrever(): Promise<boolean> {
  const sessao = await getSessaoAtual()
  return ehContaFixa(sessao.email) || !!sessao.agendaEscrita
}

// Inscreve um cliente numa aula. A vaga é garantida pela base de dados
// (inscrever_em_aula) — é a mesma função que a app dos clientes vai usar.
export async function inscreverNaAula(input: { estudioSlug: string; aulaId: string; clienteId: string }): Promise<ResultadoAula> {
  if (!(await podeEscrever())) return { error: 'A tua conta só pode ver as aulas.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('inscrever_em_aula', { p_aula: input.aulaId, p_cliente: input.clienteId, p_origem: 'equipa' })
  if (error) return { error: error.message }
  revalidatePath(`/painel/${input.estudioSlug}`, 'layout')
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
      revalidatePath(`/painel/${input.estudioSlug}`, 'layout')
      return { ok: true }
    }
  }
  const { error } = await supabase
    .from('aulas_inscricoes')
    .update({ estado: input.estado, atualizado_em: new Date().toISOString() })
    .eq('id', input.inscricaoId)
  if (error) return { error: error.message }
  revalidatePath(`/painel/${input.estudioSlug}`, 'layout')
  return { ok: true }
}

// Remover uma inscrição feita por engano: apaga-a de vez (não fica como
// "Cancelada" no histórico da pessoa nem conta como desistência).
export async function removerInscricao(input: { estudioSlug: string; inscricaoId: string }): Promise<ResultadoAula> {
  if (!(await podeEscrever())) return { error: 'A tua conta só pode ver as aulas.' }
  const supabase = await createClient()
  const { error, count } = await supabase.from('aulas_inscricoes').delete({ count: 'exact' }).eq('id', input.inscricaoId)
  if (error) return { error: error.message }
  if (!count) return { error: 'Não foi possível remover esta inscrição.' }
  revalidatePath(`/painel/${input.estudioSlug}`, 'layout')
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
  revalidatePath(`/painel/${input.estudioSlug}`, 'layout')
  return { ok: true }
}

export async function reabrirAula(input: { estudioSlug: string; aulaId: string }): Promise<ResultadoAula> {
  if (!(await podeEscrever())) return { error: 'A tua conta só pode ver as aulas.' }
  const supabase = await createClient()
  const { error } = await supabase.from('aulas').update({ estado: 'Aberta', motivo_cancelamento: null }).eq('id', input.aulaId)
  if (error) return { error: error.message }
  revalidatePath(`/painel/${input.estudioSlug}`, 'layout')
  return { ok: true }
}

// ── Mexer numa aula como num treino da Agenda ─────────────────────────

const ESCOPOS: EscopoAula[] = ['um', 'seguintes', 'serie']
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/
const HORA = /^\d{2}:\d{2}/

// A função ainda não existe na base de dados (migração por aplicar).
const semFuncao = (e: { code?: string }) => e.code === 'PGRST202'
const SEM_PERMISSAO_HORARIO =
  'A base de dados ainda não deixa esta conta mexer no horário semanal das aulas — falta aplicar a atualização (aulas_series).'
const FALTA_ATUALIZACAO =
  'Esta mudança precisa de uma atualização da base de dados (aulas_series) que ainda não foi aplicada.'

// Muda o dia, a hora e a duração de uma aula (e, se vierem, a lotação e
// o instrutor) — só desta, desta e das seguintes, ou de todas as do
// horário semanal. O trabalho todo é feito pela base de dados
// (mudar_aula), numa só transação.
export async function mudarAulaRapido(input: {
  estudioSlug: string
  aulaId: string
  escopo: EscopoAula
  data: string
  horaInicio: string
  duracaoMin: number
  lotacao?: number | null
  // undefined = não mexe no instrutor; null = fica sem instrutor.
  instrutorId?: string | null
}): Promise<{ ok: true; retiradas: number } | { error: string }> {
  if (!(await podeEscrever())) return { error: 'A tua conta só pode ver as aulas.' }
  if (!ESCOPOS.includes(input.escopo)) return { error: 'Opção inválida.' }
  if (!DATA_ISO.test(input.data)) return { error: 'Dia inválido.' }
  if (!HORA.test(input.horaInicio)) return { error: 'Hora inválida.' }
  if (!Number.isInteger(input.duracaoMin) || input.duracaoMin < 10 || input.duracaoMin > 240) {
    return { error: 'A duração tem de ficar entre 10 e 240 minutos.' }
  }
  if (input.lotacao != null && (!Number.isInteger(input.lotacao) || input.lotacao < 1 || input.lotacao > 50)) {
    return { error: 'Lotação inválida.' }
  }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('mudar_aula', {
    p_aula: input.aulaId,
    p_escopo: input.escopo,
    p_data: input.data,
    p_hora: input.horaInicio.slice(0, 5),
    p_duracao: input.duracaoMin,
    p_lotacao: input.lotacao ?? null,
    p_instrutor: input.instrutorId || null,
    p_muda_instrutor: input.instrutorId !== undefined,
  })
  if (error) return { error: semFuncao(error) ? FALTA_ATUALIZACAO : error.message }
  const r = (data ?? {}) as { estudio_id?: number; retiradas?: number }
  // Um horário novo (ou mudado) abre logo as aulas das semanas seguintes.
  if (input.escopo !== 'um' && r.estudio_id) await gerarAulas(supabase, r.estudio_id, hojeEmLisboa())
  revalidatePath(`/painel/${input.estudioSlug}`, 'layout')
  return { ok: true, retiradas: r.retiradas ?? 0 }
}

// Apaga uma aula — só esta, esta e as seguintes, ou todas as do horário
// (que deixa de abrir aulas). As que têm inscritos nunca são apagadas:
// "ficaram" diz quantas sobraram, para se avisar as pessoas e cancelar.
export async function apagarAulaRapido(input: {
  estudioSlug: string
  aulaId: string
  escopo: EscopoAula
}): Promise<{ ok: true; apagadas: number; ficaram: number } | { error: string }> {
  if (!(await podeEscrever())) return { error: 'A tua conta só pode ver as aulas.' }
  if (!ESCOPOS.includes(input.escopo)) return { error: 'Opção inválida.' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('apagar_aula', { p_aula: input.aulaId, p_escopo: input.escopo })
  if (error) return { error: semFuncao(error) ? FALTA_ATUALIZACAO : error.message }
  const r = (data ?? {}) as { apagadas?: number; ficaram?: number }
  revalidatePath(`/painel/${input.estudioSlug}`, 'layout')
  return { ok: true, apagadas: r.apagadas ?? 0, ficaram: r.ficaram ?? 0 }
}

// Cria uma aula a partir do mapa: avulsa (só nesse dia) ou a repetir
// todas as semanas (entra no horário semanal).
export async function criarAulaRapida(input: {
  estudioSlug: string
  estudioId: number
  servicoId: number
  data: string
  horaInicio: string
  duracaoMin: number
  lotacao: number | null
  instrutorId: string | null
  repete: boolean
  // Último dia em que se repete (vazio = sem fim).
  ate: string | null
}): Promise<ResultadoAula> {
  if (!(await podeEscrever())) return { error: 'A tua conta só pode ver as aulas.' }
  if (!input.estudioId || !input.servicoId) return { error: 'Indica o serviço.' }
  if (!DATA_ISO.test(input.data)) return { error: 'Dia inválido.' }
  if (!HORA.test(input.horaInicio)) return { error: 'Hora inválida.' }
  if (!Number.isInteger(input.duracaoMin) || input.duracaoMin < 10 || input.duracaoMin > 240) {
    return { error: 'A duração tem de ficar entre 10 e 240 minutos.' }
  }
  if (input.repete && input.ate && (!DATA_ISO.test(input.ate) || input.ate < input.data)) {
    return { error: 'A data final tem de ser depois da primeira aula.' }
  }
  const supabase = await createClient()
  let lotacao = input.lotacao
  if (lotacao == null) {
    const { data: s } = await supabase.from('servicos').select('lotacao_omissao').eq('id', input.servicoId).maybeSingle()
    lotacao = (s?.lotacao_omissao as number | null) ?? null
  }
  if (!lotacao || !Number.isInteger(lotacao) || lotacao < 1 || lotacao > 50) return { error: 'Indica a lotação.' }

  const { data: fechado } = await supabase
    .from('dias_fechados')
    .select('motivo')
    .eq('estudio_id', input.estudioId)
    .eq('data', input.data)
    .maybeSingle()
  if (fechado) return { error: `O estúdio está fechado nesse dia (${fechado.motivo ?? 'dia fechado'}).` }

  const hoje = hojeEmLisboa()
  if (input.repete) {
    const diaSemana = ((new Date(`${input.data}T00:00:00Z`).getUTCDay() + 6) % 7) + 1
    const { data: horario, error } = await supabase
      .from('aulas_horario')
      .insert({
        estudio_id: input.estudioId,
        servico_id: input.servicoId,
        dia_semana: diaSemana,
        hora_inicio: input.horaInicio.slice(0, 5),
        duracao_min: input.duracaoMin,
        instrutor_id: input.instrutorId || null,
        lotacao,
        desde: input.data,
        ate: input.ate || null,
      })
      .select('id')
      .single()
    if (error || !horario) return { error: error?.code === '42501' ? SEM_PERMISSAO_HORARIO : (error?.message ?? 'Não foi possível criar o horário.') }
    // A primeira aula nasce já, mesmo que o dia escolhido já tenha
    // passado ou fique para lá das semanas que o horário abre sozinho.
    const { error: erroAula } = await supabase.from('aulas').upsert(
      {
        estudio_id: input.estudioId,
        servico_id: input.servicoId,
        horario_id: horario.id,
        data: input.data,
        hora_inicio: input.horaInicio.slice(0, 5),
        duracao_min: input.duracaoMin,
        instrutor_id: input.instrutorId || null,
        lotacao,
      },
      { onConflict: 'horario_id,data', ignoreDuplicates: true }
    )
    if (erroAula) return { error: erroAula.message }
    await gerarAulas(supabase, input.estudioId, hoje)
  } else {
    const { error } = await supabase.from('aulas').insert({
      estudio_id: input.estudioId,
      servico_id: input.servicoId,
      data: input.data,
      hora_inicio: input.horaInicio.slice(0, 5),
      duracao_min: input.duracaoMin,
      instrutor_id: input.instrutorId || null,
      lotacao,
    })
    if (error) return { error: error.message }
  }
  revalidatePath(`/painel/${input.estudioSlug}`, 'layout')
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
  revalidatePath(`/painel/${String(formData.get('estudio_slug'))}`, 'layout')
  voltar(formData, { ok: 'aula-criada' })
}

// Horário semanal: cria o modelo e abre logo as aulas das próximas
// semanas. (Como na Agenda dos treinos: quem pode escrever, pode.)
export async function guardarHorarioAula(formData: FormData) {
  if (!(await podeEscrever())) voltar(formData, { error: 'A tua conta só pode ver as aulas.' })
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
  if (error) voltar(formData, { error: error.code === '42501' ? SEM_PERMISSAO_HORARIO : error.message })
  await gerarAulas(supabase, estudioId, hojeEmLisboa())
  revalidatePath(`/painel/${String(formData.get('estudio_slug'))}`, 'layout')
  voltar(formData, { ok: 'horario-criado' })
}

// Tira um horário do calendário: deixa de gerar aulas e apaga as aulas
// futuras dele ainda sem ninguém inscrito (as que têm inscritos ficam,
// para se avisar as pessoas e cancelar à mão).
export async function terminarHorarioAula(formData: FormData) {
  if (!(await podeEscrever())) voltar(formData, { error: 'A tua conta só pode ver as aulas.' })
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
  revalidatePath(`/painel/${String(formData.get('estudio_slug'))}`, 'layout')
  voltar(formData, ficaram > 0 ? { ok: 'horario-terminado', ficaram: String(ficaram) } : { ok: 'horario-terminado' })
}

// Quantas horas antes da aula abrem as reservas pela app (por serviço).
// A equipa pode sempre inscrever pessoas, a qualquer momento.
export async function guardarJanelaReserva(formData: FormData) {
  if (!papeisDaSessao(await getSessaoAtual()).ehAdmin) voltar(formData, { error: 'Só a Administração pode mudar isto.' })
  const supabase = await createClient()
  for (const [chave, valor] of formData.entries()) {
    if (!chave.startsWith('abre_')) continue
    const servicoId = Number(chave.slice(5))
    const horas = Number(valor)
    if (!servicoId || !Number.isInteger(horas) || horas < 1 || horas > 336) continue
    const { error } = await supabase.from('servicos').update({ reserva_abre_horas: horas }).eq('id', servicoId)
    if (error) voltar(formData, { error: error.message })
  }
  revalidatePath(`/painel/${String(formData.get('estudio_slug'))}`, 'layout')
  voltar(formData, { ok: 'reservas' })
}
