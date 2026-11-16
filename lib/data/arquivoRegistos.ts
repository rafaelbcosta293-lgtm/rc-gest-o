import { get, list, put } from '@vercel/blob'
import { createAdminClient } from '@/lib/supabase/admin'
import { gerarPdfRegistos } from '@/lib/pdf/registosInstrutoresPdf'
import { caminhoNoArquivo, carregarRegistosDoMes, PASTA_ARQUIVO } from './registosInstrutores'

// O arquivo mensal dos registos dos instrutores: um PDF por mês,
// guardado no Vercel Blob (o mesmo armazenamento privado das cópias de
// segurança — fora da base de dados). É refeito automaticamente nos
// primeiros dias de cada mês (ver app/api/cron/registos-instrutores) e
// pode ser refeito à mão em Administração → Horas da equipa.

// Gera o PDF de um mês com os dados como estão agora.
export async function gerarPdfDoMes(ano: number, mes: number, hoje: string) {
  const dados = await carregarRegistosDoMes(createAdminClient(), ano, mes, hoje)
  return { pdf: await gerarPdfRegistos(dados), instrutores: dados.instrutores.length }
}

// Gera e guarda no arquivo (substitui o que lá estiver desse mês).
export async function arquivarRegistosDoMes(ano: number, mes: number, hoje: string) {
  const { pdf, instrutores } = await gerarPdfDoMes(ano, mes, hoje)
  const resultado = await put(caminhoNoArquivo(ano, mes), Buffer.from(pdf), {
    // Tem nomes e horas de trabalho: nunca num endereço público.
    access: 'private',
    contentType: 'application/pdf',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  return { ficheiro: resultado.pathname, instrutores, bytes: pdf.length }
}

export type MesArquivado = { mes: string; guardadoEm: string; bytes: number }

// Os meses que já têm PDF guardado, do mais recente para o mais antigo.
// Nunca parte a página (sem armazenamento configurado, lista vazia).
export async function listarArquivo(): Promise<MesArquivado[]> {
  try {
    const { blobs } = await list({ prefix: PASTA_ARQUIVO, limit: 1000 })
    return blobs
      .map((b) => ({ mes: /(\d{4}-\d{2})\.pdf$/.exec(b.pathname)?.[1] ?? '', guardadoEm: new Date(b.uploadedAt).toISOString(), bytes: b.size }))
      .filter((b) => b.mes)
      .sort((a, b) => b.mes.localeCompare(a.mes))
  } catch {
    return []
  }
}

// O PDF guardado de um mês (ou null se ainda não há).
export async function lerDoArquivo(ano: number, mes: number): Promise<ReadableStream<Uint8Array> | null> {
  const resultado = await get(caminhoNoArquivo(ano, mes), { access: 'private', useCache: false })
  return resultado && resultado.statusCode === 200 ? resultado.stream : null
}
