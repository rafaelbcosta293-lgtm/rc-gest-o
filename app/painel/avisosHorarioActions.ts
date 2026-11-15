'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual } from '@/lib/data/sessao'

// Fecha o aviso "o horário foi atualizado" da pessoa que carregou no
// botão. Com abrir=1 leva-a logo ao horário dessa semana; sem isso
// volta à página onde estava.
export async function fecharAvisoHorario(formData: FormData) {
  const estudioId = Number(formData.get('estudio_id'))
  const semana = String(formData.get('semana') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const abrir = formData.get('abrir') === '1'
  const voltarPara = String(formData.get('voltar_para') ?? '/painel')

  const sessao = await getSessaoAtual()
  if (sessao.userId && Number.isInteger(estudioId) && /^\d{4}-\d{2}-\d{2}$/.test(semana)) {
    const supabase = await createClient()
    await supabase
      .from('avisos_horario')
      .update({ visto_em: new Date().toISOString() })
      .eq('perfil_id', sessao.userId)
      .eq('estudio_id', estudioId)
      .eq('semana', semana)
  }

  revalidatePath('/painel', 'layout')
  if (abrir && /^[a-z0-9-]+$/.test(slug)) redirect(`/painel/${slug}/horarios?semana=${semana}`)
  redirect(voltarPara.startsWith('/painel') ? voltarPara : '/painel')
}
