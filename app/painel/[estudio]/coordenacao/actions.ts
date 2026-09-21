'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function campoOuNull(formData: FormData, nome: string) {
  const v = formData.get(nome)
  if (typeof v !== 'string' || v.trim() === '') return null
  return v.trim()
}

// Guarda um bloco da escala (dia + hora + minuto) de uma só vez: apaga
// quem lá estava e volta a inserir só os PTs escolhidos agora (até 3).
// Mais simples e mais seguro do que tentar calcular o que mudou.
export async function guardarSlot(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const semana = formData.get('semana') as string
  const data = formData.get('data') as string
  const hora = Number(formData.get('hora'))
  const minuto = Number(formData.get('minuto'))
  const supabase = await createClient()

  const ptIds = [
    formData.get('pt_id_1') as string,
    formData.get('pt_id_2') as string,
    formData.get('pt_id_3') as string,
  ].filter((v, i, arr) => v && arr.indexOf(v) === i)

  const { error: erroApagar } = await supabase
    .from('escalas')
    .delete()
    .match({ estudio_id: estudioId, data, hora, minuto })

  if (erroApagar) {
    redirect(
      `/painel/${estudioSlug}/coordenacao?semana=${semana}&error=${encodeURIComponent(erroApagar.message)}`
    )
  }

  if (ptIds.length > 0) {
    const { error: erroInserir } = await supabase.from('escalas').insert(
      ptIds.map((pt_id) => ({ estudio_id: estudioId, data, hora, minuto, pt_id }))
    )
    if (erroInserir) {
      redirect(
        `/painel/${estudioSlug}/coordenacao?semana=${semana}&error=${encodeURIComponent(erroInserir.message)}`
      )
    }
  }

  revalidatePath(`/painel/${estudioSlug}/coordenacao`)
  revalidatePath(`/painel/${estudioSlug}/horarios`)
  redirect(`/painel/${estudioSlug}/coordenacao?semana=${semana}`)
}

// Cria a conta e a ficha do instrutor de uma vez (sem ele ter de se
// registar sozinho) e já lhe dá acesso a este estúdio. Usa a chave de
// administrador porque criar contas não é algo que uma conta normal
// tenha permissão para fazer. Fica com uma password aleatória que
// ninguém fica a saber — se um dia quiser entrar na app, usa
// "Esqueci-me da password" com o email que aqui ficou registado.
export async function criarInstrutor(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const nome = formData.get('nome') as string
  const email = formData.get('email') as string
  const telefone = campoOuNull(formData, 'telefone')

  let admin
  try {
    admin = createAdminClient()
  } catch (e) {
    redirect(
      `/painel/${estudioSlug}/coordenacao?error=${encodeURIComponent((e as Error).message)}`
    )
  }

  const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { nome },
  })

  if (erroCriar || !criado.user) {
    redirect(
      `/painel/${estudioSlug}/coordenacao?error=${encodeURIComponent(erroCriar?.message ?? 'Não foi possível criar o instrutor.')}`
    )
  }

  if (telefone) {
    await admin.from('perfis').update({ telefone }).eq('id', criado.user.id)
  }

  const { error: erroAcesso } = await admin
    .from('perfis_estudios')
    .insert({ estudio_id: estudioId, perfil_id: criado.user.id })

  if (erroAcesso) {
    redirect(`/painel/${estudioSlug}/coordenacao?error=${encodeURIComponent(erroAcesso.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/coordenacao`)
  redirect(`/painel/${estudioSlug}/coordenacao`)
}

export async function registarHoras(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const estudioId = Number(formData.get('estudio_id'))
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase.from('registos_pt').insert({
    pt_id: userData.user?.id,
    estudio_id: estudioId,
    data: formData.get('data') as string,
    horas: Number(formData.get('horas')) || 0,
    treinos_40: Number(formData.get('treinos_40')) || 0,
    treinos_60: Number(formData.get('treinos_60')) || 0,
    nota: campoOuNull(formData, 'nota'),
  })

  if (error) {
    redirect(`/painel/${estudioSlug}/coordenacao?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/coordenacao`)
  redirect(`/painel/${estudioSlug}/coordenacao`)
}

export async function atualizarHoras(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase
    .from('registos_pt')
    .update({
      horas: Number(formData.get('horas')) || 0,
      treinos_40: Number(formData.get('treinos_40')) || 0,
      treinos_60: Number(formData.get('treinos_60')) || 0,
      nota: campoOuNull(formData, 'nota'),
    })
    .eq('id', id)

  if (error) {
    redirect(`/painel/${estudioSlug}/coordenacao?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/painel/${estudioSlug}/coordenacao`)
  redirect(`/painel/${estudioSlug}/coordenacao`)
}
