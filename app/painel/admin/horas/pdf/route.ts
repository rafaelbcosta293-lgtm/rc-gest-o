import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { areaBloqueada } from '@/lib/data/gate'
import { hojeEmLisboa } from '@/lib/data/hoje'
import { gerarPdfDoMes, lerDoArquivo, nomeDoFicheiro, TIPOS_DE_ARQUIVO, type TipoDeArquivo } from '@/lib/data/arquivoRegistos'

export const dynamic = 'force-dynamic'

// Descarrega um dos documentos mensais em PDF — só para a administração.
//   ?mes=AAAA-MM            feito agora, com os dados como estão;
//   ?mes=AAAA-MM&arquivo=1  a cópia guardada no arquivo mensal;
//   &tipo=pagamentos-caixa  os pagamentos e o caixa (por omissão: os
//                           registos dos instrutores).
export async function GET(request: NextRequest) {
  const sessao = await getSessaoAtual()
  if (!papeisDaSessao(sessao).ehAdmin || (await areaBloqueada(await createClient(), 'admin'))) {
    return new Response('Sem permissão.', { status: 403 })
  }

  const hoje = hojeEmLisboa()
  const pedido = request.nextUrl.searchParams.get('mes') ?? ''
  const mesISO = /^\d{4}-(0[1-9]|1[0-2])$/.test(pedido) ? pedido : hoje.slice(0, 7)
  const [ano, mes] = mesISO.split('-').map(Number)
  const tipoPedido = request.nextUrl.searchParams.get('tipo') as TipoDeArquivo | null
  const tipo: TipoDeArquivo = tipoPedido && TIPOS_DE_ARQUIVO.includes(tipoPedido) ? tipoPedido : 'registos-instrutores'
  const cabecalhos = {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${nomeDoFicheiro(tipo, ano, mes)}"`,
    'Cache-Control': 'private, no-store',
  }

  try {
    if (request.nextUrl.searchParams.get('arquivo') === '1') {
      const guardado = await lerDoArquivo(tipo, ano, mes)
      if (!guardado) return new Response('Ainda não há PDF guardado deste mês.', { status: 404 })
      return new Response(guardado, { headers: cabecalhos })
    }
    const pdf = await gerarPdfDoMes(tipo, ano, mes, hoje)
    return new Response(Buffer.from(pdf), { headers: cabecalhos })
  } catch (e) {
    return new Response(`Não foi possível fazer o PDF: ${(e as Error).message}`, { status: 500 })
  }
}
