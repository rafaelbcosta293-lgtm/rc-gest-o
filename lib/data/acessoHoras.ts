import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessaoAtual, papeisDaSessao } from './sessao'
import { ehContaFixa, podeAcederEstudio } from './acessos'
import { getEstudioPorSlug } from './estudios'
import { configDoPerfil, equipaAssiduidade, type ConfigAssiduidade, type MembroEquipa } from './equipaAssiduidade'
import type { Estudio } from '@/lib/supabase/database.types'

// Quem pode fazer o quê no Registo de Horas:
//  • gestão — vê e edita a equipa toda, aprova e reabre meses;
//  • conta partilhada do estúdio (tablet da receção) — cada instrutor
//    escolhe o seu nome e regista as suas horas, como na folha de ponto
//    em papel; não aprova nem reabre;
//  • conta pessoal — só as próprias horas.
export type ModoHoras = 'gestao' | 'partilhada' | 'pessoal'

export type AcessoHoras = {
  modo: ModoHoras
  estudio: Estudio
  equipa: MembroEquipa[]
  userId: string
  // Cliente com que se lê e grava. Na conta partilhada é o de serviço
  // (as regras da base de dados só deixam cada um mexer no que é seu, e
  // a conta partilhada não é de ninguém) — por isso é AQUI que se
  // confirma que a pessoa pertence à equipa deste estúdio. Os gatilhos
  // da base de dados continuam a valer: um mês submetido fica fechado.
  db: SupabaseClient
  pessoasPermitidas: Set<string>
}

export async function obterAcessoHoras(slug: string): Promise<AcessoHoras | { erro: string }> {
  const supabase = await createClient()
  const [sessao, estudio] = await Promise.all([getSessaoAtual(), getEstudioPorSlug(supabase, slug)])
  if (!estudio) return { erro: 'Estúdio não encontrado.' }
  if (!sessao.userId) return { erro: 'Sessão terminada — entra de novo.' }
  const { ehGestao } = papeisDaSessao(sessao)
  const modo: ModoHoras = ehGestao ? 'gestao' : ehContaFixa(sessao.email) ? 'partilhada' : 'pessoal'
  if (modo === 'partilhada' && !podeAcederEstudio(sessao.email, slug)) {
    return { erro: 'Esta conta não tem acesso a este estúdio.' }
  }
  const db = modo === 'partilhada' ? createAdminClient() : supabase
  // A equipa lê-se sempre com o cliente de serviço: a configuração de
  // cada um (horas por dia) só é visível ao próprio e à gestão.
  const equipa = await equipaAssiduidade(modo === 'pessoal' ? createAdminClient() : db, estudio.id)
  const pessoasPermitidas = new Set(modo === 'pessoal' ? [sessao.userId] : equipa.map((m) => m.id))
  return { modo, estudio, equipa, userId: sessao.userId, db, pessoasPermitidas }
}

// Contrato (horas por dia, estúdio) de uma pessoa — da equipa carregada,
// ou lido à parte quando a conta pessoal não está ligada a este estúdio.
export async function configPara(acesso: AcessoHoras, perfilId: string): Promise<ConfigAssiduidade> {
  return acesso.equipa.find((m) => m.id === perfilId)?.config ?? configDoPerfil(acesso.db, perfilId, acesso.estudio.id)
}
