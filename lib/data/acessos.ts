import type { SupabaseClient } from '@supabase/supabase-js'

// Contas fixas do negócio: cada uma tem um alcance fixo na app, decidido
// pelo email de login — independente do "papel" da ficha em "perfis"
// (que continua a decidir o que cada conta pode FAZER dentro do que já
// pode ver, ex.: gerir equipa, tarefas). Comparação sem distinguir
// maiúsculas/minúsculas, para não depender de como o email ficou
// guardado no Supabase Auth.
const EMAIL_DONO = 'rafaelbcosta293@gmail.com'
export const EMAIL_GERAL = 'rc.privatefitstudio@gmail.com'
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

// Além das contas fixas (podeAcederEstudio), uma conta pessoal
// registada em /registo também entra num estúdio depois de o dono a
// aprovar em Equipa ("Dar acesso") — isso grava uma linha em
// perfis_estudios. Sem essa aprovação, a conta fica "por aprovar": vê
// a app mas nenhum estúdio, mesmo com a ficha já criada.
export async function podeAcederEstudioAprovado(
  supabase: SupabaseClient,
  userId: string | null,
  estudioId: number
): Promise<boolean> {
  if (!userId) return false
  const { data } = await supabase
    .from('perfis_estudios')
    .select('estudio_id')
    .eq('perfil_id', userId)
    .eq('estudio_id', estudioId)
    .maybeSingle()
  return !!data
}

// true só para as 4 contas fixas do negócio (dono, geral, Fátima,
// Leiria) — qualquer outra conta é uma conta pessoal (registada por um
// instrutor em /registo), sempre restrita a Treinos (completo) +
// Agenda/Horários (só ver), nunca a mais nenhum módulo — ver MODULOS
// em lib/data/constantes.ts e app/painel/[estudio]/layout.tsx. Esta
// restrição é independente do "papel" da ficha em "perfis": o
// instrutor existe só para ficar associado a tarefas (ex.: o PT de um
// treino), não para gerir o estúdio.
export function ehContaFixa(email: string | null): boolean {
  const e = normalizado(email)
  if (!e) return false
  return e === EMAIL_DONO || e === EMAIL_GERAL || Object.values(EMAIL_POR_ESTUDIO).includes(e)
}

export function podeAcederCoordenacao(email: string | null): boolean {
  const e = normalizado(email)
  return e === EMAIL_DONO || e === EMAIL_GERAL
}

export function podeAcederAdmin(email: string | null): boolean {
  return normalizado(email) === EMAIL_DONO
}

// ── Permissões das contas pessoais ─────────────────────────────────
// Guardadas em app_metadata da própria conta (Supabase Auth) — só a
// Administração as altera (Administração → Contas). Sem nada definido,
// a conta fica com os módulos de omissão e a Agenda só para ver.
export const MODULOS_CONTA_PESSOAL_OMISSAO = ['treinos', 'agenda', 'horarios', 'assiduidade', 'ferias']

export type PermissoesConta = { modulos: string[]; agendaEscrita: boolean }

export function permissoesDaConta(appMetadata: Record<string, unknown> | null | undefined): PermissoesConta {
  const modulos = appMetadata?.modulos
  return {
    modulos: Array.isArray(modulos) ? modulos.filter((m): m is string => typeof m === 'string') : MODULOS_CONTA_PESSOAL_OMISSAO,
    agendaEscrita: appMetadata?.agenda_escrita === true,
  }
}

// Um instrutor pode existir só como perfil (para escalas, horas, ficar
// associado a treinos…) sem conseguir entrar na app. Como cada perfil
// vive pendurado numa conta do Supabase Auth, esses perfis ficam com um
// email interno (um "+alias" da conta geral do negócio, que nunca
// recebe nada) e com o login bloqueado.
const PREFIXO_SEM_CONTA = 'rc.privatefitstudio+perfil-'

export function emailPerfilSemConta(token: string): string {
  return `${PREFIXO_SEM_CONTA}${token.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`
}

export function ehEmailSemConta(email: string | null): boolean {
  const e = normalizado(email)
  return !!e && e.startsWith(PREFIXO_SEM_CONTA) && e.endsWith('@gmail.com')
}
