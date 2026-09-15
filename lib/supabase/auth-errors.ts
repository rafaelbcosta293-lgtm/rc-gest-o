const TRADUCOES: Record<string, string> = {
  'Invalid login credentials': 'Email ou palavra-passe incorretos.',
  'Email not confirmed': 'Confirma o teu email antes de entrares.',
  'User already registered': 'Já existe uma conta com este email.',
  'Password should be at least 6 characters.':
    'A palavra-passe deve ter pelo menos 6 caracteres.',
}

export function traduzErroSupabase(mensagem: string) {
  return TRADUCOES[mensagem] ?? mensagem
}
