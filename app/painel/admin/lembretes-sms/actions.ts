'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processarLembretesSmsDoEstudio } from '@/lib/data/lembretesSms'
import { enviarSms } from '@/lib/sms/gateway'

const ROTA = '/painel/admin/lembretes-sms'

export async function guardarTemplateLembrete(formData: FormData) {
  const valor = (formData.get('valor') as string)?.trim() || null
  const supabase = await createClient()

  const { error } = await supabase
    .from('config')
    .update({ valor })
    .eq('chave', 'msg_lembrete_treino')

  if (error) {
    redirect(`${ROTA}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(ROTA)
  redirect(ROTA)
}

export async function enviarSmsTeste(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const telefone = (formData.get('telefone') as string)?.trim()
  const texto = (formData.get('texto') as string)?.trim()

  if (!telefone || !texto) {
    redirect(`${ROTA}?erroTeste=${encodeURIComponent('Indica o número e o texto da mensagem.')}`)
  }

  const resultado = await enviarSms(estudioSlug, telefone, texto)

  if (!resultado.ok) {
    redirect(`${ROTA}?erroTeste=${encodeURIComponent(resultado.mensagem)}`)
  }

  redirect(`${ROTA}?testeEnviado=${estudioSlug}`)
}

// "Tentar Reenvio de Lembretes Pendentes" — mesma lógica do cron
// diário, mas só para o estúdio escolhido (cada um tem o seu próprio
// telemóvel/gateway) — chamada manualmente, ex.: assim que esse
// telemóvel volta a ficar online.
export async function reenviarLembretesPendentes(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const admin = createAdminClient()
  const resultado = await processarLembretesSmsDoEstudio(admin, estudioSlug)

  revalidatePath(ROTA)
  redirect(
    `${ROTA}?reenvioEstudio=${estudioSlug}&reenvioEnviados=${resultado.enviados}` +
      `&reenvioFalhas=${resultado.falhasPorNumero}&reenvioPendentes=${resultado.pendentesRestantes}` +
      `&reenvioOffline=${resultado.gatewayOffline}`
  )
}
