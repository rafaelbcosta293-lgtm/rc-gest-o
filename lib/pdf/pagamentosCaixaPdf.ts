import { PDFDocument, StandardFonts } from 'pdf-lib'
import { nomeDoMes } from '@/lib/data/assiduidade'
import type { EstudioDoMes, PagamentoDoMes, PagamentosCaixaDoMes } from '@/lib/data/pagamentosCaixaMes'
import { CINZA, DOURADO, LARGURA, MARGEM, Folha, type Coluna } from './folha'

// O documento mensal dos pagamentos e do caixa (A4, ao alto):
//   1.ª página — resumo por estúdio: quanto entrou, por que método,
//   mensalidades, descontos e diferenças de caixa;
//   depois, por estúdio: todos os pagamentos, as vendas, os pagamentos
//   anulados e o fecho de caixa de cada dia.
// Para guardar fora da aplicação (arquivo, contabilista, back office).

const eur = (v: number) => `${v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
const eurComSinal = (v: number) => (v === 0 ? '0,00 €' : `${v > 0 ? '+' : '-'}${eur(Math.abs(v))}`)
const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

const COLUNAS_RESUMO: Coluna[] = [
  { titulo: 'Estúdio', largura: 70 },
  { titulo: 'Total recebido', largura: 74, direita: true },
  { titulo: 'Numerário', largura: 64, direita: true },
  { titulo: 'MB Way', largura: 60, direita: true },
  { titulo: 'TPA / Transf.', largura: 68, direita: true },
  { titulo: 'Mensalid.', largura: 50, direita: true },
  { titulo: 'Descontos', largura: 60, direita: true },
  { titulo: 'Dif. de caixa', largura: 69.28, direita: true },
]

const COLUNAS_PAGAMENTOS: Coluna[] = [
  { titulo: 'Dia', largura: 36 },
  { titulo: 'Cliente', largura: 128 },
  { titulo: 'O que pagou', largura: 118 },
  { titulo: 'Método', largura: 68 },
  { titulo: 'Valor', largura: 54, direita: true },
  { titulo: 'Desconto', largura: 44, direita: true },
  { titulo: 'Recebido por', largura: 67.28 },
]

const COLUNAS_VENDAS: Coluna[] = [
  { titulo: 'Dia', largura: 36 },
  { titulo: 'Venda', largura: 200 },
  { titulo: 'Cliente', largura: 140 },
  { titulo: 'Método', largura: 79.28 },
  { titulo: 'Valor', largura: 60, direita: true },
]

const COLUNAS_FECHOS: Coluna[] = [
  { titulo: 'Dia', largura: 36 },
  { titulo: 'Saldo anterior', largura: 62, direita: true },
  { titulo: 'Entradas', largura: 54, direita: true },
  { titulo: 'Saídas', largura: 50, direita: true },
  { titulo: 'Outros', largura: 50, direita: true },
  { titulo: 'Esperado', largura: 58, direita: true },
  { titulo: 'Contado', largura: 58, direita: true },
  { titulo: 'Diferença', largura: 54, direita: true },
  { titulo: 'Quem fez', largura: 93.28 },
]

function subtitulo(f: Folha, texto: string) {
  f.espaco(60)
  f.y -= 16
  f.texto(texto, MARGEM, f.y - 10, { tamanho: 10, negrito: true })
  f.y -= 16
}

function tabelaPagamentos(f: Folha, linhas: PagamentoDoMes[], comMotivo = false) {
  f.cabecalhoTabela(COLUNAS_PAGAMENTOS)
  for (const p of linhas) {
    if (f.y < MARGEM + 40) {
      f.novaPagina()
      f.cabecalhoTabela(COLUNAS_PAGAMENTOS)
    }
    f.linhaTabela(COLUNAS_PAGAMENTOS, [
      diaMes(p.data),
      p.cliente,
      comMotivo && p.motivoAnulacao ? `${p.descricao} — ${p.motivoAnulacao}` : p.descricao,
      p.metodo ?? '—',
      eur(p.valor),
      p.desconto > 0 ? eur(p.desconto) : '',
      p.quem ?? '—',
    ])
  }
}

function paginasDoEstudio(f: Folha, e: EstudioDoMes, dados: PagamentosCaixaDoMes) {
  f.novaPagina()
  f.texto(e.nome, MARGEM, f.y - 16, { tamanho: 16, negrito: true })
  f.texto(`${nomeDoMes(dados.mes)} de ${dados.ano}`, LARGURA - MARGEM, f.y - 14, { tamanho: 10, cor: CINZA, direita: true })
  f.y -= 24
  f.texto(
    [
      `Recebido: ${eur(e.totalPagamentos + e.totalVendas)}`,
      `${e.pagamentos.length} pagamento${e.pagamentos.length === 1 ? '' : 's'} (${e.mensalidades} mensalidade${e.mensalidades === 1 ? '' : 's'})`,
      `${e.vendas.length} venda${e.vendas.length === 1 ? '' : 's'}`,
    ].join('  ·  '),
    MARGEM,
    f.y - 9,
    { tamanho: 9, cor: CINZA }
  )
  f.y -= 18
  f.risco(DOURADO, 1.2)

  subtitulo(f, `Pagamentos (${e.pagamentos.length})`)
  if (e.pagamentos.length === 0) f.paragrafo('Sem pagamentos neste mês.', { tamanho: 8.5, cor: CINZA })
  else {
    tabelaPagamentos(f, e.pagamentos)
    f.linhaTabela(COLUNAS_PAGAMENTOS, ['Total', '', '', '', eur(e.totalPagamentos), e.descontos > 0 ? eur(e.descontos) : '', ''], { negrito: true, altura: 15 })
  }

  if (e.vendas.length > 0) {
    subtitulo(f, `Vendas de produtos e outras receitas (${e.vendas.length})`)
    f.cabecalhoTabela(COLUNAS_VENDAS)
    for (const v of e.vendas) {
      if (f.y < MARGEM + 40) {
        f.novaPagina()
        f.cabecalhoTabela(COLUNAS_VENDAS)
      }
      f.linhaTabela(COLUNAS_VENDAS, [diaMes(v.data), v.descricao, v.cliente ?? '—', v.metodo ?? '—', eur(v.valor)])
    }
    f.linhaTabela(COLUNAS_VENDAS, ['Total', '', '', '', eur(e.totalVendas)], { negrito: true, altura: 15 })
  }

  if (e.anulados.length > 0) {
    subtitulo(f, `Pagamentos anulados (${e.anulados.length}) — não contam nos totais`)
    tabelaPagamentos(f, e.anulados, true)
  }

  subtitulo(f, `Fecho de caixa (${e.fechos.length} dia${e.fechos.length === 1 ? '' : 's'})`)
  if (e.fechos.length === 0) f.paragrafo('Sem fechos de caixa registados neste mês.', { tamanho: 8.5, cor: CINZA })
  else {
    f.cabecalhoTabela(COLUNAS_FECHOS)
    for (const x of e.fechos) {
      if (f.y < MARGEM + 40) {
        f.novaPagina()
        f.cabecalhoTabela(COLUNAS_FECHOS)
      }
      f.linhaTabela(COLUNAS_FECHOS, [
        diaMes(x.data),
        eur(x.saldoAnterior),
        eur(x.entradas),
        x.saidas ? eur(x.saidas) : '',
        x.outros ? eurComSinal(x.outros) : '',
        eur(x.esperado),
        eur(x.contado),
        eurComSinal(x.diferenca),
        x.quem ?? '—',
      ])
    }
    f.linhaTabela(COLUNAS_FECHOS, ['Soma', '', '', '', '', '', '', eurComSinal(e.somaDiferencas), ''], { negrito: true, altura: 15 })
    const comNota = e.fechos.filter((x) => x.nota)
    if (comNota.length > 0) {
      f.y -= 8
      for (const x of comNota) f.paragrafo(`Nota de ${diaMes(x.data)}: ${x.nota}`, { tamanho: 8, cor: CINZA })
    }
  }
}

export async function gerarPdfPagamentosCaixa(dados: PagamentosCaixaDoMes, geradoEm: Date = new Date()): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const titulo = `Pagamentos e caixa — ${nomeDoMes(dados.mes)} de ${dados.ano}`
  doc.setTitle(titulo)
  doc.setAuthor('RC Private Fitness Studio')
  doc.setCreator('RC Gestão')
  doc.setCreationDate(geradoEm)
  const normal = await doc.embedFont(StandardFonts.Helvetica)
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold)
  const f = new Folha(doc, normal, negrito)

  f.texto('RC PRIVATE FITNESS STUDIO', MARGEM, f.y - 8, { tamanho: 8, negrito: true, cor: DOURADO })
  f.y -= 22
  f.texto('Pagamentos e caixa', MARGEM, f.y - 20, { tamanho: 20, negrito: true })
  f.y -= 30
  f.texto(`${nomeDoMes(dados.mes)} de ${dados.ano}`, MARGEM, f.y - 13, { tamanho: 13 })
  f.y -= 22
  const quando = new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', dateStyle: 'short', timeStyle: 'short' }).format(geradoEm)
  f.texto(`Documento gerado em ${quando}.`, MARGEM, f.y - 8.5, { tamanho: 8.5, cor: CINZA })
  f.y -= 16
  f.risco(DOURADO, 1.2)
  f.y -= 16

  f.cabecalhoTabela(COLUNAS_RESUMO)
  const linha = (nome: string, e: Pick<EstudioDoMes, 'totalPagamentos' | 'totalVendas' | 'porMetodo' | 'mensalidades' | 'descontos' | 'somaDiferencas'>) => [
    nome,
    eur(e.totalPagamentos + e.totalVendas),
    eur(e.porMetodo['Numerário']),
    eur(e.porMetodo['MB Way']),
    eur(e.porMetodo['TPA / Transferências']),
    String(e.mensalidades),
    e.descontos > 0 ? eur(e.descontos) : '—',
    eurComSinal(e.somaDiferencas),
  ]
  for (const e of dados.estudios) f.linhaTabela(COLUNAS_RESUMO, linha(e.nome, e))
  if (dados.estudios.length > 1) {
    const soma = (ler: (e: EstudioDoMes) => number) => Math.round(dados.estudios.reduce((s, e) => s + ler(e), 0) * 100) / 100
    f.linhaTabela(
      COLUNAS_RESUMO,
      linha('Total', {
        totalPagamentos: soma((e) => e.totalPagamentos),
        totalVendas: soma((e) => e.totalVendas),
        porMetodo: {
          Numerário: soma((e) => e.porMetodo['Numerário']),
          'MB Way': soma((e) => e.porMetodo['MB Way']),
          'TPA / Transferências': soma((e) => e.porMetodo['TPA / Transferências']),
        },
        mensalidades: soma((e) => e.mensalidades),
        descontos: soma((e) => e.descontos),
        somaDiferencas: soma((e) => e.somaDiferencas),
      }),
      { negrito: true, altura: 15 }
    )
  }
  f.y -= 14
  for (const nota of [
    'Total recebido: pagamentos dos clientes (mensalidades, inscrições, seguros…) mais vendas de produtos, sem os pagamentos anulados.',
    'Mensalidades: número de pagamentos que contam como mensalidade. Descontos: soma dos descontos dados.',
    'Diferença de caixa: soma, nos dias com fecho, do valor contado menos o valor esperado (negativo = faltou dinheiro).',
  ]) {
    f.paragrafo(nota, { tamanho: 7.5, cor: CINZA })
  }

  for (const e of dados.estudios) paginasDoEstudio(f, e, dados)

  const paginas = doc.getPages()
  paginas.forEach((p, n) => {
    p.drawText(f.seguro(`${titulo}  ·  Página ${n + 1} de ${paginas.length}`), { x: MARGEM, y: 24, size: 7.5, font: normal, color: CINZA })
  })
  return doc.save()
}
