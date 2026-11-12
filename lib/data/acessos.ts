// Contas fixas do negócio: cada uma tem um alcance fixo na app, decidido
// pelo email de login — independente do "papel" da ficha em "perfis"
// (que continua a decidir o que cada conta pode FAZER dentro do que já
// pode ver, ex.: gerir equipa, tarefas). Comparação sem distinguir
// maiúsculas/minúsculas, para não depender de como o email ficou
// guardado no Supabase Auth.
const EMAIL_DONO = 'rafaelbcosta293@gmail.com'
const EMAIL_GERAL = 'rc.privatefitstudio@gmail.com'
export const EMAIL_POR_ESTUDIO: Record<string, string> = {
  fatima: 'rc.privatefitstudio.fatima@gmail.com',
  leiria: 'rc.privatefitstudio.leiria@gmail.com',
}

function normalizado(email: string | null): string | null {
  return email ? email.trim().toLowerCase() : null
}

export function podeAcederEstudio(email: string | null, slug: string): boolean {
  const e = normalizado(email)
  if (!e) return false
  if (e === EMAIL_DONO || e === EMAIL_GERAL) return true
  return e === EMAIL_POR_ESTUDIO[slug]
}

// Devolve o estúdio dono da conta partilhada com este email (ou null
// para a conta do dono/geral, ou qualquer outro email) — usado para
// restringir o login dessas contas a computadores autorizados (ver
// lib/data/dispositivo.ts). Nunca devolve um estúdio para EMAIL_DONO/
// EMAIL_GERAL: essas contas nunca ficam restritas a um computador.
export function slugEstudioDoEmailPartilhado(email: string | null): string | null {
  const e = normalizado(email)
  if (!e) return null
  for (const [slug, emailEstudio] of Object.entries(EMAIL_POR_ESTUDIO)) {
    if (e === emailEstudio) return slug
  }
  return null
}

export function podeAcederCoordenacao(email: string | null): boolean {
  const e = normalizado(email)
  return e === EMAIL_DONO || e === EMAIL_GERAL
}

export function podeAcederAdmin(email: string | null): boolean {
  return normalizado(email) === EMAIL_DONO
}
