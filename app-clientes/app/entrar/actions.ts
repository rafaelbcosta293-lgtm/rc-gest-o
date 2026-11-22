'use server'

import { redirect } from 'next/navigation'
import { criarSupabase, emailDaConta, limparNumeroCliente } from '@/lib/supabase'

export type EstadoFormulario = { erro?: string } | undefined

export async function entrar(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const numero = limparNumeroCliente(String(formData.get('numero') ?? ''))
  const password = String(formData.get('password') ?? '')
  if (!numero || !password) return { erro: 'Escreva o nº de cliente e a password.' }
  const supabase = await criarSupabase()
  const { error } = await supabase.auth.signInWithPassword({ email: emailDaConta(numero), password })
  if (error) {
    // Sempre a mesma mensagem: não se revela se o número existe.
    return {
      erro: /rate|too many/i.test(error.message)
        ? 'Demasiadas tentativas. Aguarde uns minutos e tente de novo.'
        : 'Nº de cliente ou password errados.',
    }
  }
  redirect('/')
}

export async function sair() {
  const supabase = await criarSupabase()
  await supabase.auth.signOut()
  redirect('/entrar')
}

export async function ativar(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const numero = limparNumeroCliente(String(formData.get('numero') ?? ''))
  const codigo = String(formData.get('codigo') ?? '').trim().toUpperCase()
  const password = String(formData.get('password') ?? '')
  const confirmar = String(formData.get('confirmar') ?? '')
  if (!numero || !codigo) return { erro: 'Link de ativação incompleto. Peça um novo à equipa do estúdio.' }
  if (password.length < 8) return { erro: 'A password tem de ter pelo menos 8 caracteres.' }
  if (password !== confirmar) return { erro: 'As duas passwords não são iguais.' }

  const supabase = await criarSupabase()
  const { data, error } = await supabase.rpc('ativar_conta', { p_numero: numero, p_codigo: codigo, p_password: password })
  if (error) return { erro: 'Não foi possível ativar agora. Tente de novo daqui a pouco.' }
  if (data === 'expirado') return { erro: 'Este link já expirou. Peça um novo à equipa do estúdio.' }
  if (data === 'password_curta') return { erro: 'A password tem de ter entre 8 e 72 caracteres.' }
  if (data !== 'ok') return { erro: 'Este link não é válido. Peça um novo à equipa do estúdio.' }

  const { error: erroEntrar } = await supabase.auth.signInWithPassword({ email: emailDaConta(numero), password })
  if (erroEntrar) redirect('/entrar?ativada=1')
  redirect('/')
}
