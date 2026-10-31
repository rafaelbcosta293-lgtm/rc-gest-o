import { createClient } from '@/lib/supabase/server'
import { obterEstadoBanner } from '@/lib/data/lembretesSms'

// Endpoint autenticado (não está em PUBLIC_API_PATHS — exige sessão,
// como qualquer página de /painel) usado pela faixa vermelha para se
// atualizar sozinha, sem precisar de recarregar a página.
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const estado = await obterEstadoBanner(supabase)
  return Response.json(estado)
}
