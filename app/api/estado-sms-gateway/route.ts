import { createClient } from '@/lib/supabase/server'
import { obterEstadosBanner } from '@/lib/data/lembretesSms'

// Endpoint autenticado (não está em PUBLIC_API_PATHS — exige sessão,
// como qualquer página de /painel) usado pela faixa vermelha para se
// atualizar sozinha, sem precisar de recarregar a página. Devolve o
// estado dos dois estúdios — cada um tem o seu próprio telemóvel.
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const estados = await obterEstadosBanner(supabase)
  return Response.json(estados)
}
