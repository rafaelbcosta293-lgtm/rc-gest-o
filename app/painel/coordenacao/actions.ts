'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { somarDias } from '@/lib/data/horarios'
import { tentarDesbloquear } from '@/lib/data/gate'
import { redirect } from 'next/navigation'

function campoOuNull(formData: FormData, nome: string) {
  const v = formData.get(nome)
  if (typeof v !== 'string' || v.trim() === '') return null
  return v.trim()
}

export async function desbloquearCoordenacao(formData: FormData) {
  const destino = (formData.get('destino') as string) || '/painel/coordenacao'
  const senha = formData.get('senha') as string
  const supabase = await createClient()

  const ok = await tentarDesbloquear(supabase, 'coordenacao', senha)
  if (!ok) {
    redirect(`${destino}?erroSenha=1`)
  }

  redirect(destino)
}

type AtribuicaoSlot = { data: string; hora: number; minuto: number; pt_ids: string[] }

// Chamado diretamente da grelha (sem <form>/redirect): substitui a
// escala inteira dessa semana pelo que foi montado no ecrã, de uma só
// vez — em vez de gravar bloco a bloco (o que obrigava a recarregar a
// página, perder a posição do scroll, a cada alteração).
export async function guardarSemana(input: {
  estudioSlug: string
  estudioId: number
  semana: string
  atribuicoes: AtribuicaoSlot[]
}): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const fimExclusivo = somarDias(input.semana, 7)

  const { error: erroApagar } = await supabase
    .from('escalas')
    .delete()
    .eq('estudio_id', input.estudioId)
    .gte('data', input.semana)
    .lt('data', fimExclusivo)

  if (erroApagar) return { error: erroApagar.message }

  const linhas = input.atribuicoes.flatMap((s) =>
    s.pt_ids.map((pt_id) => ({
      estudio_id: input.estudioId,
      data: s.data,
      hora: s.hora,
      minuto: s.minuto,
      pt_id,
    }))
  )

  if (linhas.length > 0) {
    const { error: erroInserir } = await supabase.from('escalas').insert(linhas)
    if (erroInserir) return { error: erroInserir.message }
  }

  revalidatePath('/painel/coordenacao/horarios')
  revalidatePath(`/painel/${input.estudioSlug}/horarios`)
  return { ok: true }
}

// Copia a escala da semana anterior para a semana aberta (substitui o
// que lá estiver), para depois só se fazerem os ajustes. Só copia quem
// ainda tem acesso a este estúdio.
export async function copiarSemanaAnterior(formData: FormData) {
  const estudioSlug = String(formData.get('estudio_slug') ?? '')
  const estudioId = Number(formData.get('estudio_id'))
  const semana = String(formData.get('semana') ?? '')
  const destino = new URL(String(formData.get('voltar') ?? '/painel/coordenacao/horarios'), 'http://x')
  const voltar = (resultado: string): never => {
    destino.searchParams.set(`${estudioSlug}_copia`, resultado)
    // Obriga a grelha a recarregar com a escala copiada.
    destino.searchParams.set(`${estudioSlug}_v`, String(Date.now()))
    redirect(`${destino.pathname}${destino.search}#planeamento-${estudioSlug}`)
  }
  if (!estudioId || !/^\d{4}-\d{2}-\d{2}$/.test(semana)) voltar('erro')

  const supabase = await createClient()
  const semanaAnterior = somarDias(semana, -7)
  const [{ data: anteriores, error }, { data: ligacoes }] = await Promise.all([
    supabase
      .from('escalas')
      .select('data, hora, minuto, pt_id')
      .eq('estudio_id', estudioId)
      .gte('data', semanaAnterior)
      .lt('data', semana),
    supabase.from('perfis_estudios').select('perfil_id').eq('estudio_id', estudioId),
  ])
  if (error) voltar('erro')
  const comAcesso = new Set((ligacoes ?? []).map((l) => l.perfil_id))
  const linhas = (anteriores ?? [])
    .filter((t) => comAcesso.has(t.pt_id))
    .map((t) => ({ estudio_id: estudioId, data: somarDias(t.data, 7), hora: t.hora, minuto: t.minuto, pt_id: t.pt_id }))
  if (linhas.length === 0) voltar('vazia')

  const { error: erroApagar } = await supabase
    .from('escalas')
    .delete()
    .eq('estudio_id', estudioId)
    .gte('data', semana)
    .lt('data', somarDias(semana, 7))
  if (erroApagar) voltar('erro')
  const { error: erroInserir } = await supabase.from('escalas').insert(linhas)
  if (erroInserir) voltar('erro')

  revalidatePath('/painel/coordenacao/horarios')
  revalidatePath(`/painel/${estudioSlug}/horarios`)
  voltar('ok')
}

// Cria a conta e a ficha do instrutor de uma vez (sem ele ter de se
// registar sozinho) e já lhe dá acesso a este estúdio. Usa a chave de
// administrador porque criar contas não é algo que uma conta normal
// tenha permissão para fazer. Fica com uma password aleatória que
// ninguém fica a saber — se um dia quiser entrar na app, usa
// "Esqueci-me da password" com o email que aqui ficou registado.
export async function criarInstrutor(formData: FormData) {
  const estudioId = Number(formData.get('estudio_id'))
  const nome = formData.get('nome') as string
  const email = formData.get('email') as string
  const telefone = campoOuNull(formData, 'telefone')

  let admin
  try {
    admin = createAdminClient()
  } catch (e) {
    redirect(`/painel/coordenacao/horarios?error=${encodeURIComponent((e as Error).message)}`)
  }

  const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { nome },
  })

  if (erroCriar || !criado.user) {
    redirect(
      `/painel/coordenacao/horarios?error=${encodeURIComponent(erroCriar?.message ?? 'Não foi possível criar o instrutor.')}`
    )
  }

  if (telefone) {
    await admin.from('perfis').update({ telefone }).eq('id', criado.user.id)
  }

  const { error: erroAcesso } = await admin
    .from('perfis_estudios')
    .insert({ estudio_id: estudioId, perfil_id: criado.user.id })

  if (erroAcesso) {
    redirect(`/painel/coordenacao/horarios?error=${encodeURIComponent(erroAcesso.message)}`)
  }

  revalidatePath('/painel/coordenacao/horarios')
  redirect('/painel/coordenacao/horarios')
}
