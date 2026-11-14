'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { diasUteisEm, motivoBloqueioFerias, type BloqueioFerias } from '@/lib/data/assiduidade'
import {
  CHAVE_LIMITE_FERIAS,
  configDoPerfil,
  limiteFeriasSimultaneo,
  podeUsarComoInstrutor,
} from '@/lib/data/equipaAssiduidade'

function voltar(slug: string, ano: string | number, params: Record<string, string> = {}): never {
  const qs = new URLSearchParams({ ano: String(ano), ...params })
  redirect(`/painel/${slug}/ferias?${qs.toString()}`)
}

async function exigirGestao() {
  const sessao = await getSessaoAtual()
  if (!papeisDaSessao(sessao).ehGestao) throw new Error('Só a gestão pode fazer isto.')
  return sessao
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

export async function pedirFerias(formData: FormData) {
  const slug = String(formData.get('estudio_slug') ?? '')
  const ano = Number(formData.get('ano'))
  let dias: string[] = []
  try {
    dias = JSON.parse(String(formData.get('dias') ?? '[]'))
  } catch {
    dias = []
  }
  dias = Array.from(new Set(dias.filter((d) => typeof d === 'string' && DATA_ISO.test(d)))).sort()

  const sessao = await getSessaoAtual()
  if (!podeUsarComoInstrutor(sessao) || !sessao.userId) {
    voltar(slug, ano, { error: 'Entra com a tua conta pessoal para pedir férias.' })
  }
  if (dias.length === 0) voltar(slug, ano, { error: 'Escolhe pelo menos um dia.' })
  if (dias.some((d) => Number(d.slice(0, 4)) !== ano)) voltar(slug, ano, { error: 'Os dias têm de ser todos do mesmo ano.' })

  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) voltar(slug, ano, { error: 'Estúdio não encontrado.' })
  const config = await configDoPerfil(supabase, sessao.userId!, estudio!.id)
  const { data: estudioConfig } = await supabase.from('estudios').select('slug').eq('id', config.estudio_id).maybeSingle()
  const slugConfig = estudioConfig?.slug ?? slug

  const [{ data: bloqueios }, { data: pedidos }, limite] = await Promise.all([
    supabase.from('ferias_bloqueios').select('inicio, fim, estudio_id, motivo'),
    supabase.from('pedidos_ferias').select('perfil_id, estudio_id, dias, estado').eq('ano', ano).neq('estado', 'Recusado'),
    limiteFeriasSimultaneo(supabase),
  ])
  const outrosDeFerias = new Map<string, number>()
  const jaMeus = new Set<string>()
  for (const p of pedidos ?? []) {
    for (const d of p.dias as string[]) {
      if (p.perfil_id === sessao.userId) jaMeus.add(d)
      else if (p.estudio_id === config.estudio_id) outrosDeFerias.set(d, (outrosDeFerias.get(d) ?? 0) + 1)
    }
  }
  for (const d of dias) {
    if (jaMeus.has(d)) voltar(slug, ano, { error: `O dia ${d.split('-').reverse().join('/')} já está num pedido teu.` })
    const motivo = motivoBloqueioFerias(d, {
      slug: slugConfig,
      estudioId: config.estudio_id,
      bloqueios: (bloqueios ?? []) as BloqueioFerias[],
      outrosDeFerias,
      limiteSimultaneo: limite,
    })
    if (motivo) voltar(slug, ano, { error: `${d.split('-').reverse().join('/')}: ${motivo}` })
  }

  const { error } = await supabase.from('pedidos_ferias').insert({
    perfil_id: sessao.userId,
    estudio_id: config.estudio_id,
    ano,
    dias,
    dias_uteis: diasUteisEm(dias, slugConfig),
    estado: 'Pendente',
  })
  if (error) voltar(slug, ano, { error: error.message })
  revalidatePath(`/painel/${slug}`, 'layout')
  voltar(slug, ano, { ok: 'pedido' })
}

export async function cancelarPedidoFerias(formData: FormData) {
  const slug = String(formData.get('estudio_slug') ?? '')
  const ano = String(formData.get('ano') ?? '')
  const id = String(formData.get('pedido_id') ?? '')
  const supabase = await createClient()
  const { error } = await supabase.from('pedidos_ferias').delete().eq('id', id).eq('estado', 'Pendente')
  if (error) voltar(slug, ano, { error: error.message })
  revalidatePath(`/painel/${slug}`, 'layout')
  voltar(slug, ano)
}

export async function reverPedidoFerias(formData: FormData) {
  const slug = String(formData.get('estudio_slug') ?? '')
  const ano = String(formData.get('ano') ?? '')
  const id = String(formData.get('pedido_id') ?? '')
  const decisao = String(formData.get('decisao') ?? '')
  const motivo = String(formData.get('motivo') ?? '').trim()
  const sessao = await exigirGestao()
  if (decisao !== 'Aprovado' && decisao !== 'Recusado') voltar(slug, ano, { error: 'Decisão inválida.' })

  const supabase = await createClient()
  const { error } = await supabase
    .from('pedidos_ferias')
    .update({
      estado: decisao,
      motivo_recusa: decisao === 'Recusado' ? motivo || null : null,
      revisto_por: sessao.userId,
      revisto_em: new Date().toISOString(),
      aviso_visto_em: null,
    })
    .eq('id', id)
  if (error) voltar(slug, ano, { error: error.message })
  revalidatePath(`/painel/${slug}`, 'layout')
  voltar(slug, ano)
}

export async function marcarAvisoFeriasVisto(formData: FormData) {
  const id = String(formData.get('pedido_id') ?? '')
  const voltarPara = String(formData.get('voltar_para') ?? '/painel')
  const supabase = await createClient()
  await supabase.from('pedidos_ferias').update({ aviso_visto_em: new Date().toISOString() }).eq('id', id)
  revalidatePath(voltarPara, 'layout')
  redirect(voltarPara.startsWith('/painel') ? voltarPara : '/painel')
}

export async function criarBloqueioFerias(formData: FormData) {
  const slug = String(formData.get('estudio_slug') ?? '')
  const ano = String(formData.get('ano') ?? '')
  await exigirGestao()
  const inicio = String(formData.get('inicio') ?? '')
  const fim = String(formData.get('fim') ?? '')
  const ambito = String(formData.get('ambito') ?? 'todos')
  const motivo = String(formData.get('motivo') ?? '').trim()
  if (!DATA_ISO.test(inicio) || !DATA_ISO.test(fim) || fim < inicio) voltar(slug, ano, { error: 'Datas inválidas.' })
  if (!motivo) voltar(slug, ano, { error: 'Indica o motivo do bloqueio.' })
  const supabase = await createClient()
  const { error } = await supabase.from('ferias_bloqueios').insert({
    inicio,
    fim,
    motivo,
    estudio_id: ambito === 'todos' ? null : Number(ambito),
  })
  if (error) voltar(slug, ano, { error: error.message })
  voltar(slug, ano)
}

export async function apagarBloqueioFerias(formData: FormData) {
  const slug = String(formData.get('estudio_slug') ?? '')
  const ano = String(formData.get('ano') ?? '')
  await exigirGestao()
  const supabase = await createClient()
  const { error } = await supabase.from('ferias_bloqueios').delete().eq('id', String(formData.get('bloqueio_id') ?? ''))
  if (error) voltar(slug, ano, { error: error.message })
  voltar(slug, ano)
}

export async function guardarLimiteFerias(formData: FormData) {
  const slug = String(formData.get('estudio_slug') ?? '')
  const ano = String(formData.get('ano') ?? '')
  await exigirGestao()
  const bruto = String(formData.get('limite') ?? '').trim()
  const n = Number(bruto)
  const supabase = await createClient()
  if (!bruto || n <= 0) {
    await supabase.from('config').delete().eq('chave', CHAVE_LIMITE_FERIAS)
  } else if (!Number.isInteger(n)) {
    voltar(slug, ano, { error: 'O limite tem de ser um número inteiro.' })
  } else {
    const { error } = await supabase.from('config').upsert({ chave: CHAVE_LIMITE_FERIAS, valor: String(n) })
    if (error) voltar(slug, ano, { error: error.message })
  }
  voltar(slug, ano)
}
