'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { traduzErroSupabase } from '@/lib/supabase/auth-errors'

// O email de convite leva o cliente a /cliente/ativar com o próprio id
// embutido — só para a página saber que ficha ligar. A ligação real só
// se confirma lá, comparando o email da sessão (que o Supabase já
// validou ao trocar o token do convite) com o email desta ficha.
export async function convidarClienteParaApp(formData: FormData) {
  const estudioSlug = formData.get('estudio_slug') as string
  const clienteId = formData.get('cliente_id') as string

  // A leitura usa a sessão normal — a RLS (tenho_estudio) já garante
  // que só vê a ficha quem tem acesso a este estúdio.
  const supabase = await createClient()
  const { data: cliente, error: erroCliente } = await supabase
    .from('clientes')
    .select('id, nome, email')
    .eq('id', clienteId)
    .maybeSingle()

  if (erroCliente || !cliente) {
    redirect(
      `/painel/${estudioSlug}/clientes/${clienteId}?error=${encodeURIComponent('Não foi possível encontrar este cliente.')}`
    )
  }
  if (!cliente.email) {
    redirect(
      `/painel/${estudioSlug}/clientes/${clienteId}?error=${encodeURIComponent('Este cliente ainda não tem email na ficha — adiciona um antes de convidar.')}`
    )
  }

  let admin
  try {
    admin = createAdminClient()
  } catch (e) {
    redirect(
      `/painel/${estudioSlug}/clientes/${clienteId}?error=${encodeURIComponent((e as Error).message)}`
    )
  }

  // O link do convite passa sempre por /auth/confirm primeiro — é lá
  // que o Supabase troca o token pela sessão real. Só depois disso é
  // que faz sentido chegar a /cliente/ativar já autenticado.
  const origin = (await headers()).get('origin')
  const next = encodeURIComponent(`/cliente/ativar?cliente_id=${cliente.id}`)
  const { error: erroConvite } = await admin.auth.admin.inviteUserByEmail(cliente.email, {
    redirectTo: `${origin}/auth/confirm?next=${next}`,
  })

  if (erroConvite) {
    redirect(
      `/painel/${estudioSlug}/clientes/${clienteId}?error=${encodeURIComponent(traduzErroSupabase(erroConvite.message))}`
    )
  }

  redirect(`/painel/${estudioSlug}/clientes/${clienteId}?convidado=1`)
}
