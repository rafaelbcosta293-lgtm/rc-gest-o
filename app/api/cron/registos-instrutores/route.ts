import { hojeEmLisboa } from '@/lib/data/hoje'
import { mesAnterior } from '@/lib/data/registosInstrutores'
import { arquivarRegistosDoMes } from '@/lib/data/arquivoRegistos'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Arquivo mensal dos registos dos instrutores: guarda (ou refaz) o PDF
// do mês anterior — horas, férias, ausências e escalas de cada um.
// Corre nos dias 1, 6 e 12 de cada mês (ver vercel.json): no dia 1 fica
// logo uma primeira versão; as seguintes apanham o que os instrutores
// ainda submeteram e o que a administração corrigiu ou aprovou nos
// primeiros dias. Com ?mes=AAAA-MM refaz-se um mês à escolha.
export async function GET(request: Request) {
  const esperado = process.env.CRON_SECRET
  const recebido = request.headers.get('authorization')
  if (!esperado || recebido !== `Bearer ${esperado}`) {
    return new Response('unauthorized', { status: 401 })
  }

  const hoje = hojeEmLisboa()
  const pedido = new URL(request.url).searchParams.get('mes') ?? ''
  const { ano, mes } = /^\d{4}-(0[1-9]|1[0-2])$/.test(pedido)
    ? { ano: Number(pedido.slice(0, 4)), mes: Number(pedido.slice(5, 7)) }
    : mesAnterior(hoje)

  try {
    return Response.json({ ok: true, ...(await arquivarRegistosDoMes(ano, mes, hoje)) })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}
