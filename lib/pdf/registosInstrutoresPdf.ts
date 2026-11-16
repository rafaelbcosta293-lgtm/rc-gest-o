import { PDFDocument, StandardFonts } from 'pdf-lib'
import { CINZA, DOURADO, FUNDO_FIM_DE_SEMANA, LARGURA, MARGEM, UTIL, Folha, type Coluna } from './folha'
import { diaDaSemana, diasDoMesISO, feriadoNoEstudio, formatarHoras, listarDiasDoMes, nomeDoMes } from '@/lib/data/assiduidade'
import type { RegistosDoMes, RegistosInstrutor } from '@/lib/data/registosInstrutores'

// O documento mensal dos registos dos instrutores (A4, ao alto):
//   1.ª página — resumo da equipa: escala, horas feitas, horas do mês,
//   saldo, férias, ausências e estado de cada um;
//   depois, uma página por instrutor com o mês dia a dia.
// Para guardar fora da aplicação (arquivo, contabilista, back office).

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const VINCULO = { contrato: 'Contrato', recibos_verdes: 'Recibos verdes' } as const
const ESTADO = { Rascunho: 'Por submeter', Submetido: 'Submetido', Aprovado: 'Aprovado' } as const
const SITUACAO = { ativo: '', inativo: 'Já não está na equipa (desativado)', eliminado: 'Já não está na equipa (eliminado)' } as const

const dataPt = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const horasOuTraco = (h: number) => (h > 0 ? formatarHoras(h) : '—')

const COLUNAS_RESUMO: Coluna[] = [
  { titulo: 'Instrutor', largura: 92 },
  { titulo: 'Estúdio', largura: 42 },
  { titulo: 'Vínculo', largura: 66 },
  { titulo: 'Escala', largura: 40, direita: true },
  { titulo: 'Horas feitas', largura: 50, direita: true },
  { titulo: 'Horas do mês', largura: 62, direita: true },
  { titulo: 'Saldo', largura: 42, direita: true },
  { titulo: 'Férias', largura: 30, direita: true },
  { titulo: 'Ausênc.', largura: 36, direita: true },
  { titulo: 'Estado', largura: 55.28 },
]

const COLUNAS_DIAS: Coluna[] = [
  { titulo: 'Dia', largura: 34 },
  { titulo: 'Sem.', largura: 30 },
  { titulo: 'Escala', largura: 42, direita: true },
  { titulo: 'Entrada', largura: 44, direita: true },
  { titulo: 'Saída', largura: 44, direita: true },
  { titulo: 'Entrada', largura: 44, direita: true },
  { titulo: 'Saída', largura: 44, direita: true },
  { titulo: 'Horas', largura: 44, direita: true },
  { titulo: 'Observações', largura: 189.28 },
]

function paginaDoInstrutor(f: Folha, i: RegistosInstrutor, dados: RegistosDoMes) {
  f.novaPagina()
  const titulo = `${nomeDoMes(dados.mes)} de ${dados.ano}`
  f.texto(i.nome, MARGEM, f.y - 16, { tamanho: 16, negrito: true })
  f.texto(titulo, LARGURA - MARGEM, f.y - 14, { tamanho: 10, cor: CINZA, direita: true })
  f.y -= 24
  const r = i.resumo
  f.texto(
    [i.estudioNome, VINCULO[i.tipoContrato], `${formatarHoras(r.horasDiarias)} por dia`, `Mês: ${ESTADO[i.estado].toLowerCase()}`].join('  ·  '),
    MARGEM,
    f.y - 9,
    { tamanho: 9, cor: CINZA }
  )
  f.y -= 14
  if (SITUACAO[i.situacao]) {
    f.texto(SITUACAO[i.situacao], MARGEM, f.y - 9, { tamanho: 9, negrito: true, cor: DOURADO })
    f.y -= 14
  }
  f.y -= 4
  f.risco(DOURADO, 1.2)
  f.y -= 14

  // Os números do mês, em duas linhas de quatro.
  const quadros: [string, string][] = [
    ['Horas feitas', formatarHoras(r.horasRealizadas)],
    ['Horas do mês', formatarHoras(r.horasEsperadas)],
    ['Saldo', formatarHoras(r.saldo, true)],
    ['Horas extra', formatarHoras(r.horasExtra)],
    ['Dias trabalhados', `${r.diasTrabalhados} de ${r.diasUteis} úteis`],
    ['Dias de férias', String(r.diasFerias.length)],
    [dados.ateDia ? 'Dias sem registo (até hoje)' : 'Dias úteis sem registo', String(r.diasSemRegisto.length)],
    ['Horas de escala', horasOuTraco(i.horasEscala)],
  ]
  const larguraQuadro = UTIL / 4
  quadros.forEach(([rotulo, valor], n) => {
    const x = MARGEM + (n % 4) * larguraQuadro
    const y = f.y - Math.floor(n / 4) * 30
    f.texto(rotulo, x, y - 7, { tamanho: 7.5, cor: CINZA })
    f.texto(valor, x, y - 20, { tamanho: 11, negrito: true })
  })
  f.y -= 68

  // O mês dia a dia.
  f.cabecalhoTabela(COLUNAS_DIAS)
  const registoPorDia = new Map(i.dias.map((d) => [d.data, d]))
  const feriasSet = new Set(r.diasFerias)
  for (const data of diasDoMesISO(dados.ano, dados.mes)) {
    const reg = registoPorDia.get(data)
    const sem = diaDaSemana(data)
    const feriado = feriadoNoEstudio(data, i.estudioSlug)
    const ausente = i.ausencias.find((a) => data >= a.inicio && data <= a.fim)
    const notas = [
      reg?.ferias || feriasSet.has(data) ? 'Férias' : null,
      feriado ? `Feriado: ${feriado.nome}` : null,
      ausente ? `Ausência (${ausente.tipo})` : null,
      reg?.nota ?? null,
    ].filter(Boolean)
    f.linhaTabela(
      COLUNAS_DIAS,
      [
        diaMes(data),
        DIAS_SEMANA[sem],
        i.escalaPorDia[data] ? formatarHoras(i.escalaPorDia[data]) : '',
        reg?.entrada1 ?? '',
        reg?.saida1 ?? '',
        reg?.entrada2 ?? '',
        reg?.saida2 ?? '',
        reg && reg.horas > 0 ? formatarHoras(reg.horas) : '',
        notas.join(' · '),
      ],
      { fundo: sem === 0 || sem === 6 || feriado ? FUNDO_FIM_DE_SEMANA : undefined }
    )
  }
  f.linhaTabela(COLUNAS_DIAS, ['Total', '', horasOuTraco(i.horasEscala), '', '', '', '', formatarHoras(r.horasRealizadas), ''], { negrito: true, altura: 15 })
  f.y -= 12

  f.paragrafo(r.diasFerias.length > 0 ? `Férias no mês (${r.diasFerias.length} dia${r.diasFerias.length === 1 ? '' : 's'} úteis): ${listarDiasDoMes(r.diasFerias)}.` : 'Férias no mês: nenhuma.', {
    tamanho: 8.5,
  })
  if (i.ausencias.length === 0) f.paragrafo('Ausências no mês: nenhuma.', { tamanho: 8.5 })
  else {
    f.paragrafo(`Ausências no mês (${i.diasDeAusencia} dia${i.diasDeAusencia === 1 ? '' : 's'}):`, { tamanho: 8.5 })
    for (const a of i.ausencias) {
      f.paragrafo(`•  ${a.inicio === a.fim ? dataPt(a.inicio) : `${dataPt(a.inicio)} a ${dataPt(a.fim)}`} — ${a.tipo}${a.nota ? ` — ${a.nota}` : ''}`, { tamanho: 8.5 })
    }
  }
  if (i.submetidoEm || i.aprovadoEm) {
    const partes = [i.submetidoEm ? `submetido em ${dataPt(i.submetidoEm.slice(0, 10))}` : null, i.aprovadoEm ? `aprovado em ${dataPt(i.aprovadoEm.slice(0, 10))}` : null]
    f.paragrafo(`Fecho do mês: ${partes.filter(Boolean).join(', ')}.`, { tamanho: 8.5, cor: CINZA })
  }
}

// "geradoEm": o instante em que o documento é feito (fica escrito nele).
export async function gerarPdfRegistos(dados: RegistosDoMes, geradoEm: Date = new Date()): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const titulo = `Registos dos instrutores — ${nomeDoMes(dados.mes)} de ${dados.ano}`
  doc.setTitle(titulo)
  doc.setAuthor('RC Private Fitness Studio')
  doc.setCreator('RC Gestão')
  doc.setCreationDate(geradoEm)
  const normal = await doc.embedFont(StandardFonts.Helvetica)
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold)
  const f = new Folha(doc, normal, negrito)

  // ── 1.ª página: resumo da equipa ──
  f.texto('RC PRIVATE FITNESS STUDIO', MARGEM, f.y - 8, { tamanho: 8, negrito: true, cor: DOURADO })
  f.y -= 22
  f.texto('Registos dos instrutores', MARGEM, f.y - 20, { tamanho: 20, negrito: true })
  f.y -= 30
  f.texto(`${nomeDoMes(dados.mes)} de ${dados.ano}`, MARGEM, f.y - 13, { tamanho: 13 })
  f.y -= 22
  const quando = new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', dateStyle: 'short', timeStyle: 'short' }).format(geradoEm)
  f.texto(
    `Documento gerado em ${quando}.${dados.ateDia ? ` O mês ainda está a decorrer: as contas vão até ${dataPt(dados.ateDia)}.` : ''}`,
    MARGEM,
    f.y - 8.5,
    { tamanho: 8.5, cor: CINZA }
  )
  f.y -= 16
  f.risco(DOURADO, 1.2)
  f.y -= 16

  if (dados.instrutores.length === 0) {
    f.paragrafo('Não há registos de instrutores neste mês.', { tamanho: 10 })
  } else {
    f.cabecalhoTabela(COLUNAS_RESUMO)
    for (const i of dados.instrutores) {
      f.espaco(14)
      f.linhaTabela(COLUNAS_RESUMO, [
        i.situacao === 'ativo' ? i.nome : `${i.nome} *`,
        i.estudioNome,
        VINCULO[i.tipoContrato],
        horasOuTraco(i.horasEscala),
        formatarHoras(i.resumo.horasRealizadas),
        formatarHoras(i.resumo.horasEsperadas),
        formatarHoras(i.resumo.saldo, true),
        String(i.resumo.diasFerias.length),
        String(i.diasDeAusencia),
        ESTADO[i.estado],
      ])
    }
    const soma = (ler: (i: RegistosInstrutor) => number) => dados.instrutores.reduce((s, i) => s + ler(i), 0)
    f.linhaTabela(
      COLUNAS_RESUMO,
      [
        `Total (${dados.instrutores.length})`,
        '',
        '',
        horasOuTraco(soma((i) => i.horasEscala)),
        formatarHoras(soma((i) => i.resumo.horasRealizadas)),
        formatarHoras(soma((i) => i.resumo.horasEsperadas)),
        formatarHoras(soma((i) => i.resumo.saldo), true),
        String(soma((i) => i.resumo.diasFerias.length)),
        String(soma((i) => i.diasDeAusencia)),
        '',
      ],
      { negrito: true, altura: 15 }
    )
    f.y -= 14
    const notas = [
      'Escala: horas marcadas na escala do estúdio. Horas feitas: as que o instrutor registou no Registo de Horas.',
      'Horas do mês: dias úteis (sem feriados nem férias) × horas diárias de cada um. Saldo: horas feitas menos horas do mês.',
      'Férias e ausências: em dias. Estado: se o instrutor já submeteu o mês e se a administração já o aprovou.',
    ]
    if (dados.instrutores.some((i) => i.situacao !== 'ativo')) notas.push('* Já não está na equipa — os registos ficam guardados no histórico.')
    for (const nota of notas) f.paragrafo(nota, { tamanho: 7.5, cor: CINZA })
  }

  // ── Uma página por instrutor ──
  for (const i of dados.instrutores) paginaDoInstrutor(f, i, dados)

  // ── Rodapé com o número da página ──
  const paginas = doc.getPages()
  paginas.forEach((p, n) => {
    const rodape = f.seguro(`${titulo}  ·  Página ${n + 1} de ${paginas.length}`)
    p.drawText(rodape, { x: MARGEM, y: 24, size: 7.5, font: normal, color: CINZA })
  })

  return doc.save()
}
