'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual } from '@/lib/data/sessao'
import { podeAcederAdmin } from '@/lib/data/acessos'
import { REPETICOES, TIPOS_LEMBRETE, somarDiasISO } from '@/lib/data/lembretes'

const ROTA = '/painel/admin/calendario'
const DATA = /^\d{4}-\d{2}-\d{2}$/

function texto(formData: FormData, nome: string): string | null {
  const v = formData.get(nome)
  if (typeof v !== 'string' || v.trim() === '') return null
  return v.trim()
}

function voltar(formData: FormData, extra: Record<string, string> = {}): never {
  const destino = texto(formData, 'voltar') ?? ROTA
  const url = new URL(destino.startsWith(ROTA) ? destino : ROTA, 'http://x')
  url.searchParams.delete('ok')
  url.searchParams.delete('error')
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v)
  // O número de lembretes por tratar aparece no menu da Administração.
  revalidatePath('/painel/admin', 'layout')
  redirect(`${url.pathname}${url.search}`)
}

// Só o dono entra na Administração (o RLS das tabelas confirma e_admin()).
async function clienteAdmin() {
  const sessao = await getSessaoAtual()
  if (!podeAcederAdmin(sessao.email)) redirect('/painel?erro=sem-acesso')
  return { supabase: await createClient(), userId: sessao.userId }
}

export async function criarLembrete(formData: FormData) {
  const { supabase, userId } = await clienteAdmin()
  const titulo = texto(formData, 'titulo')
  const data = texto(formData, 'data')
  const tipo = texto(formData, 'tipo') ?? 'tarefa'
  const periodicidade = texto(formData, 'periodicidade') ?? 'unica'
  const fim = texto(formData, 'fim')
  const valorTexto = texto(formData, 'valor')
  const valor = valorTexto == null ? null : Number(valorTexto.replace(/\s/g, '').replace(',', '.'))
  const estudioId = texto(formData, 'estudio_id')

  if (!titulo) voltar(formData, { error: 'Escreve o que é para lembrar.' })
  if (!data || !DATA.test(data)) voltar(formData, { error: 'Escolhe o dia do lembrete.' })
  if (!TIPOS_LEMBRETE.some((t) => t.valor === tipo)) voltar(formData, { error: 'Tipo de lembrete inválido.' })
  if (!REPETICOES.some((r) => r.valor === periodicidade)) voltar(formData, { error: 'Repetição inválida.' })
  if (valor != null && (!Number.isFinite(valor) || valor < 0)) voltar(formData, { error: 'O valor tem de ser um número.' })
  if (fim && (!DATA.test(fim) || fim < data!)) voltar(formData, { error: 'A data de fim tem de ser depois do primeiro dia.' })

  const { error } = await supabase.from('lembretes').insert({
    titulo,
    data,
    tipo,
    periodicidade,
    fim: periodicidade === 'unica' ? null : fim,
    valor,
    notas: texto(formData, 'notas'),
    estudio_id: estudioId ? Number(estudioId) : null,
    criado_por: userId,
  })
  if (error) voltar(formData, { error: error.message })
  voltar(formData, { ok: 'criado' })
}

// Dá uma ocorrência como feita (ou desfaz).
export async function alternarLembreteFeito(formData: FormData) {
  const { supabase, userId } = await clienteAdmin()
  const id = texto(formData, 'lembrete_id')
  const data = texto(formData, 'data')
  const feito = formData.get('feito') === 'true'
  if (!id || !data || !DATA.test(data)) voltar(formData)
  const { error } = feito
    ? await supabase
        .from('lembretes_feitos')
        .upsert({ lembrete_id: id, data, feito_por: userId }, { onConflict: 'lembrete_id,data', ignoreDuplicates: true })
    : await supabase.from('lembretes_feitos').delete().eq('lembrete_id', id).eq('data', data)
  if (error) voltar(formData, { error: error.message })
  voltar(formData)
}

export async function eliminarLembrete(formData: FormData) {
  const { supabase } = await clienteAdmin()
  const id = texto(formData, 'lembrete_id')
  if (!id) voltar(formData)
  const { error } = await supabase.from('lembretes').delete().eq('id', id)
  if (error) voltar(formData, { error: error.message })
  voltar(formData, { ok: 'eliminado' })
}

// Um lembrete que se repete deixa de aparecer a partir deste dia; o que
// ficou para trás (e o que já foi dado como feito) mantém-se.
export async function pararLembrete(formData: FormData) {
  const { supabase } = await clienteAdmin()
  const id = texto(formData, 'lembrete_id')
  const data = texto(formData, 'data')
  if (!id || !data || !DATA.test(data)) voltar(formData)
  const { error } = await supabase
    .from('lembretes')
    .update({ fim: somarDiasISO(data!, -1) })
    .eq('id', id)
  if (error) voltar(formData, { error: error.message })
  voltar(formData, { ok: 'parado' })
}
