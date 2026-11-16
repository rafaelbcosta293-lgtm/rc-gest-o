import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { areaBloqueada } from '@/lib/data/gate'
import { hojeEmLisboa } from '@/lib/data/hoje'
import { nomeDoFicheiro } from '@/lib/data/registosInstrutores'
import { gerarPdfDoMes, lerDoArquivo } from '@/lib/data/arquivoRegistos'

export const dynamic = 'force-dynamic'

// Descarrega o PDF dos registos dos instrutores de um mês — só para a
// administração.
//   ?mes=AAAA-MM            feito agora, com os dados como estão;
//   ?mes=AAAA-MM&arquivo=1  a cópia guardada no arquivo mensal.
export async function GET(request: NextRequest) {
  const sessao = await getSessaoAtual()
  if (!papeisDaSessao(sessao).ehAdmin || (await areaBloqueada(await createClient(), 'admin'))) {
    return new Response('Sem permissão.', { status: 403 })
  }

  const hoje = hojeEmLisboa()
  const pedido = request.nextUrl.searchParams.get('mes') ?? ''
  const mesISO = /^\d{4}-(0[1-9]|1[0-2])$/.test(pedido) ? pedido : hoje.slice(0, 7)
  const [ano, mes] = mesISO.split('-').map(Number)
  const cabecalhos = {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${nomeDoFicheiro(ano, mes)}"`,
    'Cache-Control': 'private, no-store',
  }

  try {
    if (request.nextUrl.searchParams.get('arquivo') === '1') {
      const guardado = await lerDoArquivo(ano, mes)
      if (!guardado) return new Response('Ainda não há PDF guardado deste mês.', { status: 404 })
      return new Response(guardado, { headers: cabecalhos })
    }
    const { pdf } = await gerarPdfDoMes(ano, mes, hoje)
    return new Response(Buffer.from(pdf), { headers: cabecalhos })
  } catch (e) {
    return new Response(`Não foi possível fazer o PDF: ${(e as Error).message}`, { status: 500 })
  }
}
