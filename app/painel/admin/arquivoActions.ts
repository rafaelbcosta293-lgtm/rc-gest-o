'use server'

import { redirect } from 'next/navigation'
import { getSessaoAtual } from '@/lib/data/sessao'
import { podeAcederAdmin } from '@/lib/data/acessos'
import { hojeEmLisboa } from '@/lib/data/hoje'
import { arquivarDoMes, TIPOS_DE_ARQUIVO, type TipoDeArquivo } from '@/lib/data/arquivoRegistos'

// Guarda (ou refaz) no arquivo o PDF mensal de um tipo — o mesmo que a
// tarefa automática faz nos primeiros dias de cada mês. Volta para a
// página de onde foi pedido.
export async function arquivarPdfDoMes(formData: FormData) {
  const sessao = await getSessaoAtual()
  if (!podeAcederAdmin(sessao.email)) redirect('/painel?erro=sem-acesso')
  const pedido = String(formData.get('voltar') ?? '')
  const voltar = new URL(/^\/painel\/admin\/[a-z-]+(\?|$)/.test(pedido) ? pedido : '/painel/admin', 'http://x')
  const ir = (extra: Record<string, string>): never => {
    for (const chave of ['arquivo', 'erroArquivo']) voltar.searchParams.delete(chave)
    for (const [k, v] of Object.entries(extra)) voltar.searchParams.set(k, v)
    redirect(`${voltar.pathname}${voltar.search}#arquivo`)
  }
  const tipo = String(formData.get('tipo') ?? '') as TipoDeArquivo
  const mesISO = String(formData.get('mes') ?? '')
  if (!TIPOS_DE_ARQUIVO.includes(tipo) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mesISO)) ir({ erroArquivo: 'Pedido inválido.' })
  const [ano, mes] = mesISO.split('-').map(Number)
  try {
    await arquivarDoMes(tipo, ano, mes, hojeEmLisboa())
  } catch (e) {
    ir({ erroArquivo: `Não foi possível guardar o PDF no arquivo: ${(e as Error).message}` })
  }
  ir({ arquivo: 'guardado' })
}
