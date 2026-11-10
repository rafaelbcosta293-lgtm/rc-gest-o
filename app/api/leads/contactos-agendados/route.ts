import { createClient } from '@/lib/supabase/server'
import { listarContactosAgendados } from '@/lib/data/contactosAgendados'

// Autenticado, tal como /api/estado-sms-gateway — usado pelo alerta
// global de "contacto agendado pela lead" para se atualizar sozinho,
// sem recarregar a página, em qualquer sítio da app.
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const contactos = await listarContactosAgendados(supabase)
  return Response.json(contactos)
}
