'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processarLembretesSms } from '@/lib/data/lembretesSms'
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
  const telefone = (formData.get('telefone') as string)?.trim()
  const texto = (formData.get('texto') as string)?.trim()

  if (!telefone || !texto) {
    redirect(`${ROTA}?erroTeste=${encodeURIComponent('Indica o número e o texto da mensagem.')}`)
  }

  const resultado = await enviarSms(telefone, texto)

  if (!resultado.ok) {
    redirect(`${ROTA}?erroTeste=${encodeURIComponent(resultado.mensagem)}`)
  }

  redirect(`${ROTA}?testeEnviado=1`)
}

// "Tentar Reenvio de Lembretes Pendentes" — mesma lógica do cron
// diário, chamada manualmente (ex.: assim que o telemóvel volta a
// ficar online).
export async function reenviarLembretesPendentes() {
  const admin = createAdminClient()
  const resultado = await processarLembretesSms(admin)

  revalidatePath(ROTA)
  redirect(
    `${ROTA}?reenvioEnviados=${resultado.enviados}&reenvioFalhas=${resultado.falhasPorNumero}` +
      `&reenvioPendentes=${resultado.pendentesRestantes}&reenvioOffline=${resultado.gatewayOffline}`
  )
}
