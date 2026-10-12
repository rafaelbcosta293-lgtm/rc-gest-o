import { createAdminClient } from '@/lib/supabase/admin'
import { getEstudios } from '@/lib/data/estudios'
import type { Estudio } from '@/lib/supabase/database.types'

// Cada estúdio tem o seu próprio token fixo, guardado em "config"
// (qr_token_<slug>) — o código QR afixado no ginásio aponta para
// /cliente/checkin/<token>. Não é um segredo de autenticação (está
// impresso num cartaz), só identifica qual estúdio é.
const CONFIG_KEY_POR_ESTUDIO: Record<string, string> = {
  fatima: 'qr_token_fatima',
  leiria: 'qr_token_leiria',
}

export async function estudioDoTokenCheckin(token: string): Promise<Estudio | null> {
  const admin = createAdminClient()
  const estudios = await getEstudios(admin)

  const { data } = await admin
    .from('config')
    .select('chave, valor')
    .in('chave', Object.values(CONFIG_KEY_POR_ESTUDIO))

  const tokenPorChave = new Map((data ?? []).map((c) => [c.chave, c.valor]))

  for (const estudio of estudios) {
    const chave = CONFIG_KEY_POR_ESTUDIO[estudio.slug]
    if (chave && tokenPorChave.get(chave) === token) {
      return estudio
    }
  }
  return null
}

// Marca presença de hoje para este cliente — idempotente de propósito
// (digitalizar o código duas vezes no mesmo dia não deve duplicar nem
// dar erro; a tabela já tem um índice único em cliente_id+data, por
// isso um upsert chega). Usa o service-role porque a conta de cliente
// não tem (nem deve ter) uma policy de insert em presencas — tudo aqui
// é validado antes, no servidor.
export async function registarPresencaCheckin(clienteId: string, hoje: string): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from('presencas')
    .upsert(
      { cliente_id: clienteId, data: hoje, estado: 'Presente' },
      { onConflict: 'cliente_id,data' }
    )
}
