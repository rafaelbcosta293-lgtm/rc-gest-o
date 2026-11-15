'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { configPara, obterAcessoHoras, type AcessoHoras } from '@/lib/data/acessoHoras'
import {
  calcularResumoMes,
  diasDoMesISO,
  ehDiaUtil,
  erroTurnos,
  fechoDisponivel,
  feriadoNoEstudio,
  hojeLisboa,
  juntarDiasFerias,
  type TurnosDia,
} from '@/lib/data/assiduidade'

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/
const HORA = /^\d{2}:\d{2}$/

function voltar(formData: FormData, params: Record<string, string> = {}): never {
  const slug = String(formData.get('estudio_slug') ?? '')
  const qs = new URLSearchParams()
  const mes = String(formData.get('mes') ?? '')
  const pessoa = String(formData.get('perfil_id') ?? '')
  if (mes) qs.set('mes', mes)
  if (pessoa) qs.set('pessoa', pessoa)
  for (const [k, v] of Object.entries(params)) qs.set(k, v)
  revalidatePath(`/painel/${slug}/assiduidade`)
  redirect(`/painel/${slug}/assiduidade?${qs.toString()}`)
}

// Acesso + pessoa alvo validados (a pessoa tem de ser a própria, ou da
// equipa deste estúdio para a gestão e a conta partilhada).
async function exigir(formData: FormData): Promise<{ acesso: AcessoHoras; perfilId: string }> {
  const acesso = await obterAcessoHoras(String(formData.get('estudio_slug') ?? ''))
  if ('erro' in acesso) voltar(formData, { error: acesso.erro })
  const perfilId = String(formData.get('perfil_id') ?? '')
  if (!acesso.pessoasPermitidas.has(perfilId)) voltar(formData, { error: 'Escolhe primeiro o teu nome.' })
  return { acesso, perfilId }
}

const hora = (formData: FormData, nome: string) => {
  const v = String(formData.get(nome) ?? '').trim()
  return HORA.test(v) ? v : null
}

const mensagem = (texto: string) => (texto.includes('já foi submetido') ? 'Este mês já foi submetido — só a administração o pode reabrir.' : texto)

// Estúdio do contrato da pessoa — é ele que decide o feriado municipal.
async function slugDoContrato(acesso: AcessoHoras, perfilId: string): Promise<string> {
  const config = await configPara(acesso, perfilId)
  if (config.estudio_id === acesso.estudio.id) return acesso.estudio.slug
  const { data } = await acesso.db.from('estudios').select('slug').eq('id', config.estudio_id).maybeSingle()
  return data?.slug ?? acesso.estudio.slug
}

export async function guardarRegistoHoras(formData: FormData) {
  const { acesso, perfilId } = await exigir(formData)
  const data = String(formData.get('data') ?? '')
  if (!DATA_ISO.test(data)) voltar(formData, { error: 'Indica o dia.' })
  const nota = String(formData.get('nota') ?? '').trim() || null

  // Dia de férias: fica sem turnos e desconta à meta de horas do mês.
  // Pode marcar-se com antecedência, mas só dentro do mês que está aberto
  // no ecrã e só em dias úteis (um sábado ou um feriado não gasta férias).
  if (formData.get('ferias') === '1') {
    const mes = String(formData.get('mes') ?? '')
    if (mes && !data.startsWith(`${mes}-`)) voltar(formData, { error: 'Escolhe um dia deste mês.', dia: data })
    const slug = await slugDoContrato(acesso, perfilId)
    if (!ehDiaUtil(data, slug)) {
      const feriado = feriadoNoEstudio(data, slug)
      voltar(formData, {
        error: feriado ? `${feriado.nome} — um feriado não conta como dia de férias.` : 'Sábados e domingos não contam como dias de férias.',
        dia: data,
      })
    }
    const { error } = await acesso.db
      .from('registos_horario')
      .upsert(
        { perfil_id: perfilId, data, ferias: true, entrada_1: null, saida_1: null, entrada_2: null, saida_2: null, nota },
        { onConflict: 'perfil_id,data' }
      )
    if (error) voltar(formData, { error: mensagem(error.message), dia: data })
    voltar(formData, { ok: 'ferias' })
  }

  if (data > hojeLisboa()) voltar(formData, { error: 'Só se registam horas de dias que já aconteceram.', dia: data })
  const turnos: TurnosDia = {
    entrada_1: hora(formData, 'entrada_1'),
    saida_1: hora(formData, 'saida_1'),
    entrada_2: hora(formData, 'entrada_2'),
    saida_2: hora(formData, 'saida_2'),
  }
  // Só o 2.º turno preenchido: passa a ser o 1.º.
  if (!turnos.entrada_1 && !turnos.saida_1 && (turnos.entrada_2 || turnos.saida_2)) {
    turnos.entrada_1 = turnos.entrada_2
    turnos.saida_1 = turnos.saida_2
    turnos.entrada_2 = null
    turnos.saida_2 = null
  }
  const erro = erroTurnos(turnos)
  if (erro) voltar(formData, { error: erro, dia: data })

  const { error } = await acesso.db
    .from('registos_horario')
    .upsert({ perfil_id: perfilId, data, ...turnos, ferias: false, nota }, { onConflict: 'perfil_id,data' })
  if (error) voltar(formData, { error: mensagem(error.message), dia: data })
  voltar(formData, { ok: 'registado' })
}

export async function apagarRegistoHoras(formData: FormData) {
  const { acesso, perfilId } = await exigir(formData)
  const data = String(formData.get('data') ?? '')
  if (!DATA_ISO.test(data)) voltar(formData)
  const { error } = await acesso.db.from('registos_horario').delete().eq('perfil_id', perfilId).eq('data', data)
  if (error) voltar(formData, { error: mensagem(error.message) })
  voltar(formData, { ok: 'apagado' })
}

// Submeter o mês: fica a fotografia das contas (dias, horas, férias,
// horas extra) comunicada à administração, e o mês fecha-se aos registos
// até a administração o aprovar ou reabrir.
export async function submeterFechoHoras(formData: FormData) {
  const { acesso, perfilId } = await exigir(formData)
  const [ano, mes] = String(formData.get('mes') ?? '').split('-').map(Number)
  if (!ano || !mes) voltar(formData, { error: 'Mês inválido.' })
  const hoje = hojeLisboa()
  if (!fechoDisponivel(hoje, ano, mes)) voltar(formData, { error: 'O fecho deste mês só abre a partir do dia 25.' })

  const config = await configPara(acesso, perfilId)
  const horasDiarias = config.horas_diarias
  // Primeiro e último dia reais do mês ("2026-11-31" não existe — a
  // base de dados recusava a consulta nos meses de 30 dias e em fevereiro).
  const diasDoMes = diasDoMesISO(ano, mes)
  const primeiroDia = diasDoMes[0]
  const ultimoDia = diasDoMes[diasDoMes.length - 1]
  const [{ data: registos, error: erroRegistos }, { data: ferias }, { data: estudioConfig }] = await Promise.all([
    acesso.db.from('registos_horario').select('data, horas, ferias').eq('perfil_id', perfilId).gte('data', primeiroDia).lte('data', ultimoDia),
    acesso.db.from('pedidos_ferias').select('dias').eq('perfil_id', perfilId).eq('estado', 'Aprovado').eq('ano', ano),
    acesso.db.from('estudios').select('slug').eq('id', config.estudio_id).maybeSingle(),
  ])
  if (erroRegistos) voltar(formData, { error: erroRegistos.message })
  const resumo = calcularResumoMes({
    ano,
    mes,
    slug: estudioConfig?.slug ?? acesso.estudio.slug,
    horasDiarias,
    registos: (registos ?? []).map((r) => ({ data: r.data, horas: Number(r.horas) })),
    diasFerias: juntarDiasFerias(ferias, registos),
  })

  const { error } = await acesso.db.from('fechos_horario').upsert(
    {
      perfil_id: perfilId,
      ano,
      mes,
      dias_uteis: resumo.diasUteis,
      dias_trabalhados: resumo.diasTrabalhados,
      dias_ferias: resumo.diasFerias.length,
      datas_ferias: resumo.diasFerias,
      faltas: resumo.faltas,
      horas_diarias: resumo.horasDiarias,
      horas_esperadas: resumo.horasEsperadas,
      horas_realizadas: resumo.horasRealizadas,
      horas_extra: resumo.horasExtra,
      saldo: resumo.saldo,
      estado: 'Submetido',
      submetido_em: new Date().toISOString(),
    },
    { onConflict: 'perfil_id,ano,mes' }
  )
  if (error) voltar(formData, { error: mensagem(error.message) })
  // O número de meses por aprovar aparece no menu da Administração.
  revalidatePath('/painel/admin', 'layout')
  voltar(formData, { ok: 'submetido' })
}

// Só a gestão: aprovar um mês submetido ou reabri-lo para correções.
export async function reverFechoHoras(formData: FormData) {
  const { acesso, perfilId } = await exigir(formData)
  if (acesso.modo !== 'gestao') voltar(formData, { error: 'Só a administração pode aprovar ou reabrir um mês.' })
  const [ano, mes] = String(formData.get('mes') ?? '').split('-').map(Number)
  const aprovar = formData.get('decisao') === 'aprovar'
  const { error } = await acesso.db
    .from('fechos_horario')
    .update(
      aprovar
        ? { estado: 'Aprovado', aprovado_por: acesso.userId, aprovado_em: new Date().toISOString() }
        : { estado: 'Rascunho', aprovado_por: null, aprovado_em: null, submetido_em: null }
    )
    .eq('perfil_id', perfilId)
    .eq('ano', ano)
    .eq('mes', mes)
  if (error) voltar(formData, { error: error.message })
  revalidatePath('/painel/admin', 'layout')
  voltar(formData, { ok: aprovar ? 'aprovado' : 'reaberto' })
}

export async function guardarConfigHoras(formData: FormData) {
  const { acesso, perfilId } = await exigir(formData)
  if (acesso.modo !== 'gestao') voltar(formData, { error: 'Só a administração pode alterar o contrato.' })
  const horas = Number(String(formData.get('horas_diarias') ?? '').replace(',', '.'))
  const tipo = String(formData.get('tipo_contrato') ?? 'contrato')
  const estudioId = Number(formData.get('estudio_id')) || acesso.estudio.id
  if (!(horas > 0 && horas <= 24)) voltar(formData, { error: 'As horas por dia têm de ser entre 0 e 24.' })
  if (tipo !== 'contrato' && tipo !== 'recibos_verdes') voltar(formData, { error: 'Tipo de contrato inválido.' })
  const { error } = await acesso.db
    .from('config_assiduidade')
    .upsert(
      { perfil_id: perfilId, estudio_id: estudioId, horas_diarias: horas, tipo_contrato: tipo, atualizado_em: new Date().toISOString() },
      { onConflict: 'perfil_id' }
    )
  if (error) voltar(formData, { error: error.message })
  voltar(formData, { ok: 'contrato' })
}
