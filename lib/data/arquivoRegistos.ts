import { get, list, put } from '@vercel/blob'
import { createAdminClient } from '@/lib/supabase/admin'
import { gerarPdfRegistos } from '@/lib/pdf/registosInstrutoresPdf'
import { gerarPdfPagamentosCaixa } from '@/lib/pdf/pagamentosCaixaPdf'
import { carregarRegistosDoMes, chaveDoMes } from './registosInstrutores'
import { carregarPagamentosCaixaDoMes } from './pagamentosCaixaMes'

// O arquivo mensal em PDF: um documento por mês de cada tipo, guardado
// no Vercel Blob (o mesmo armazenamento privado das cópias de segurança
// — fora da base de dados). É refeito automaticamente nos primeiros
// dias de cada mês (ver app/api/cron/registos-instrutores) e pode ser
// refeito à mão na Administração.
//
//   registos-instrutores — horas, férias, ausências e escalas de cada
//                          instrutor (Administração → Horas da equipa);
//   pagamentos-caixa     — pagamentos, vendas e fecho de caixa de cada
//                          estúdio (Administração → Pagamentos).

export type TipoDeArquivo = 'registos-instrutores' | 'pagamentos-caixa'
export const TIPOS_DE_ARQUIVO: TipoDeArquivo[] = ['registos-instrutores', 'pagamentos-caixa']

const pasta = (tipo: TipoDeArquivo) => `${tipo}/`
export const caminhoNoArquivo = (tipo: TipoDeArquivo, ano: number, mes: number) => `${pasta(tipo)}${chaveDoMes(ano, mes)}.pdf`
export const nomeDoFicheiro = (tipo: TipoDeArquivo, ano: number, mes: number) => `${tipo}-${chaveDoMes(ano, mes)}.pdf`

// Gera o PDF de um mês com os dados como estão agora.
export async function gerarPdfDoMes(tipo: TipoDeArquivo, ano: number, mes: number, hoje: string): Promise<Uint8Array> {
  const admin = createAdminClient()
  return tipo === 'registos-instrutores'
    ? gerarPdfRegistos(await carregarRegistosDoMes(admin, ano, mes, hoje))
    : gerarPdfPagamentosCaixa(await carregarPagamentosCaixaDoMes(admin, ano, mes))
}

// Gera e guarda no arquivo (substitui o que lá estiver desse mês).
export async function arquivarDoMes(tipo: TipoDeArquivo, ano: number, mes: number, hoje: string) {
  const pdf = await gerarPdfDoMes(tipo, ano, mes, hoje)
  const resultado = await put(caminhoNoArquivo(tipo, ano, mes), Buffer.from(pdf), {
    // Tem nomes, horas de trabalho e pagamentos: nunca num endereço público.
    access: 'private',
    contentType: 'application/pdf',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  return { ficheiro: resultado.pathname, bytes: pdf.length }
}

export type MesArquivado = { mes: string; guardadoEm: string; bytes: number }

// Os meses que já têm PDF guardado, do mais recente para o mais antigo.
// Nunca parte a página (sem armazenamento configurado, lista vazia).
export async function listarArquivo(tipo: TipoDeArquivo): Promise<MesArquivado[]> {
  try {
    const { blobs } = await list({ prefix: pasta(tipo), limit: 1000 })
    return blobs
      .map((b) => ({ mes: /(\d{4}-\d{2})\.pdf$/.exec(b.pathname)?.[1] ?? '', guardadoEm: new Date(b.uploadedAt).toISOString(), bytes: b.size }))
      .filter((b) => b.mes)
      .sort((a, b) => b.mes.localeCompare(a.mes))
  } catch {
    return []
  }
}

// O PDF guardado de um mês (ou null se ainda não há).
export async function lerDoArquivo(tipo: TipoDeArquivo, ano: number, mes: number): Promise<ReadableStream<Uint8Array> | null> {
  const resultado = await get(caminhoNoArquivo(tipo, ano, mes), { access: 'private', useCache: false })
  return resultado && resultado.statusCode === 200 ? resultado.stream : null
}
