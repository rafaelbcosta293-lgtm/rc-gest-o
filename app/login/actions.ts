'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { traduzErroSupabase } from '@/lib/supabase/auth-errors'
import { getSessaoAtual } from '@/lib/data/sessao'
import { podeAcederAdmin, slugEstudioDoEmailPartilhado } from '@/lib/data/acessos'
import { loginBloqueadoPorDispositivo } from '@/lib/data/dispositivo'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(traduzErroSupabase(error.message))}`)
  }

  // Contas partilhadas dos estúdios (Fátima/Leiria): se o dono já
  // ativou a restrição por computador e este não está autorizado,
  // desfaz o login imediatamente — ver lib/data/dispositivo.ts.
  const slugPartilhado = slugEstudioDoEmailPartilhado(email)
  if (slugPartilhado && (await loginBloqueadoPorDispositivo(supabase, slugPartilhado))) {
    await supabase.auth.signOut()
    redirect(
      `/login?error=${encodeURIComponent(
        'Este computador não está autorizado para a conta deste estúdio. Pede ao dono para o autorizar em Administração → Serviços/Produtos.'
      )}`
    )
  }

  revalidatePath('/', 'layout')

  // Quem tem acesso à Administração não precisa de passar pela grelha de
  // módulos — vai direto para lá, já combinada para todos os estúdios.
  const sessao = await getSessaoAtual()
  if (podeAcederAdmin(sessao.email)) {
    redirect('/painel/admin')
  }

  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
