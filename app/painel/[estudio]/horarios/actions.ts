'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function campoOuNull(formData: FormData, nome: string) {
  const v = formData.get(nome)
  if (typeof v !== 'string' || v.trim() === '') return null
  return v.trim()
}

// Guarda um bloco (dia + hora + minuto) de uma só vez: apaga quem lá
// estava e volta a inserir só os PTs escolhidos agora (até 3). Mais simples
// e mais seguro do que tentar calcular o que mudou.
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
      `/painel/${estudioSlug}/horarios?semana=${semana}&error=${encodeURIComponent(erroApagar.message)}`
    )
  }

  if (ptIds.length > 0) {
    const { error: erroInserir } = await supabase.from('escalas').insert(
      ptIds.map((pt_id) => ({ estudio_id: estudioId, data, hora, minuto, pt_id }))
    )
    if (erroInserir) {
      redirect(
        `/painel/${estudioSlug}/horarios?semana=${semana}&error=${encodeURIComponent(erroInserir.message)}`
      )
    }
  }

  revalidatePath(`/painel/${estudioSlug}/horarios`)
  redirect(`/painel/${estudioSlug}/horarios?semana=${semana}`)
}

export async function criarAusencia(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const semana = formData.get('semana') as string
  const supabase = await createClient()

  const { error } = await supabase.from('ausencias').insert({
    pt_id: formData.get('pt_id') as string,
    inicio: formData.get('inicio') as string,
    fim: formData.get('fim') as string,
    tipo: formData.get('tipo') as string,
    nota: campoOuNull(formData, 'nota'),
  })

  if (error) {
    redirect(
      `/painel/${estudioSlug}/horarios?semana=${semana}&error=${encodeURIComponent(error.message)}`
    )
  }

  revalidatePath(`/painel/${estudioSlug}/horarios`)
  redirect(`/painel/${estudioSlug}/horarios?semana=${semana}`)
}

export async function apagarAusencia(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const semana = formData.get('semana') as string
  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase.from('ausencias').delete().eq('id', id)

  if (error) {
    redirect(
      `/painel/${estudioSlug}/horarios?semana=${semana}&error=${encodeURIComponent(error.message)}`
    )
  }

  revalidatePath(`/painel/${estudioSlug}/horarios`)
  redirect(`/painel/${estudioSlug}/horarios?semana=${semana}`)
}
