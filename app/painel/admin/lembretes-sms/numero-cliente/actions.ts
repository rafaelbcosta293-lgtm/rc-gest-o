'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { areaBloqueada } from '@/lib/data/gate'
import { getEstudios } from '@/lib/data/estudios'
import { enviarNumerosCliente } from '@/lib/data/smsNumeroCliente'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'

const ROTA = '/painel/admin/lembretes-sms/numero-cliente'

export async function enviarNumeroClienteEstudio(formData: FormData) {
  const slug = String(formData.get('estudio_slug'))
  const supabase = await createClient()
  // Mesma porta da Administração (as ações não passam pela página).
  if (await areaBloqueada(supabase, 'admin')) redirect(ROTA)
  if (!papeisDaSessao(await getSessaoAtual()).ehAdmin) redirect(`${ROTA}?error=${encodeURIComponent('Só a administração pode enviar.')}`)
  const estudio = (await getEstudios(supabase)).find((e) => e.slug === slug)
  if (!estudio) redirect(`${ROTA}?error=${encodeURIComponent('Estúdio não encontrado.')}`)

  const r = await enviarNumerosCliente(createAdminClient(), estudio)
  revalidatePath(ROTA)
  const qs = new URLSearchParams({
    estudio: slug,
    enviados: String(r.enviados),
    falhas: r.falhas.join(', '),
    porEnviar: String(r.porEnviar),
    ...(r.offline ? { offline: r.offline } : {}),
  })
  redirect(`${ROTA}?${qs}`)
}
