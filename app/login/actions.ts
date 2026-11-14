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

  // O teclado do telemóvel (e o preenchimento automático) acrescenta
  // muitas vezes um espaço no fim do email, ou põe a primeira letra em
  // maiúscula — sem isto a conta "não existe" e o login falha.
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Mostra o email tal como chegou: a causa mais comum de "credenciais
    // inválidas" é um email diferente do que está registado na conta.
    const mensagem = traduzErroSupabase(error.message)
    const comEmail = error.message === 'Invalid login credentials' && email ? `${mensagem} Email usado: ${email}` : mensagem
    redirect(`/login?error=${encodeURIComponent(comEmail)}`)
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
