import { procurarLocalidades } from '@/lib/data/localidades'

// Sugestões de localidade (cidade, vila ou aldeia) para a morada dos
// clientes: ?q=o que se escreveu&cp=código postal (opcional, ajuda a
// escolher entre terras com o mesmo nome). Só para quem tem sessão (o
// proxy trata disso, como no resto da app).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').slice(0, 80)
  const cp = searchParams.get('cp')
  return Response.json(procurarLocalidades(q, { cp, limite: 8 }), { headers: { 'Cache-Control': 'private, max-age=3600' } })
}
