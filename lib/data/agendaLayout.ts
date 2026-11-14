// Disposição dos blocos de um dia na grelha da Agenda, ao estilo Google
// Calendar: eventos que se sobrepõem ficam lado a lado, cada um alarga
// para a direita enquanto houver espaço livre, e os desmarcados saem da
// disposição — ficam por trás, só com uma "aba" à mostra à direita.

export type BlocoAgenda = { id: string; inicio: number; fim: number; cancelado: boolean }

export type PosicaoBloco = {
  id: string
  // Colunas do conjunto de eventos sobrepostos, a coluna deste e quantas
  // ocupa (alarga para a direita enquanto não bater noutro).
  coluna: number
  colunas: number
  largura: number
  cancelado: boolean
  // Nº de abas (de desmarcados por trás) a deixar à vista à direita.
  recuo: number
  // Ordem de empilhamento dos desmarcados entre si (0 = mais atrás).
  nivel: number
  // Fração de coluna que o bloco se estende por baixo do vizinho da
  // direita, quando esse só começa mais tarde (o nome continua à vista
  // por cima dele) — é o "escadinha" do Google Calendar.
  extra: number
  // Desmarcado com algum evento ativo por cima (só a aba fica à vista).
  coberto: boolean
}

// O vizinho tem de começar pelo menos isto depois, para a linha do nome
// do bloco de trás não ficar tapada.
const DESFASAMENTO_MIN = 20
const EXTRA_ESCADINHA = 0.7

const sobrepoe = (a: { inicio: number; fim: number }, b: { inicio: number; fim: number }) => a.inicio < b.fim && a.fim > b.inicio

function empacotar<T extends { inicio: number; fim: number }>(blocos: T[]): (T & { coluna: number })[] {
  const fimPorColuna: number[] = []
  return [...blocos]
    .sort((a, b) => a.inicio - b.inicio || b.fim - a.fim)
    .map((b) => {
      let coluna = fimPorColuna.findIndex((f) => f <= b.inicio)
      if (coluna === -1) {
        coluna = fimPorColuna.length
        fimPorColuna.push(b.fim)
      } else {
        fimPorColuna[coluna] = b.fim
      }
      return { ...b, coluna }
    })
}

export function disporBlocos(blocos: BlocoAgenda[]): PosicaoBloco[] {
  const ativos = empacotar(blocos.filter((b) => !b.cancelado))
  const cancelados = empacotar(blocos.filter((b) => b.cancelado))

  // Conjuntos de eventos ligados por sobreposição (direta ou em cadeia):
  // todos partilham o mesmo nº de colunas, para as larguras baterem certo.
  const conjunto = new Map<string, number>()
  const colunasDoConjunto: number[] = []
  let fimConjunto = -1
  for (const b of ativos) {
    if (b.inicio >= fimConjunto) colunasDoConjunto.push(0)
    const i = colunasDoConjunto.length - 1
    conjunto.set(b.id, i)
    colunasDoConjunto[i] = Math.max(colunasDoConjunto[i], b.coluna + 1)
    fimConjunto = Math.max(fimConjunto, b.fim)
  }

  const posAtivos = ativos.map((b) => {
    const colunas = colunasDoConjunto[conjunto.get(b.id)!]
    let largura = 1
    while (b.coluna + largura < colunas && !ativos.some((o) => o.coluna === b.coluna + largura && sobrepoe(o, b))) largura++
    const recuo = cancelados.reduce((m, c) => (sobrepoe(c, b) ? Math.max(m, c.coluna + 1) : m), 0)
    const vizinhos = ativos.filter((o) => o.coluna === b.coluna + largura && sobrepoe(o, b))
    const extra =
      b.coluna + largura < colunas && vizinhos.every((o) => o.inicio - b.inicio >= DESFASAMENTO_MIN) ? EXTRA_ESCADINHA : 0
    return { id: b.id, coluna: b.coluna, colunas, largura, cancelado: false, recuo, nivel: 0, extra, coberto: false }
  })
  const posCancelados = cancelados.map((c) => ({
    id: c.id,
    coluna: 0,
    colunas: 1,
    largura: 1,
    cancelado: true,
    recuo: c.coluna,
    nivel: c.coluna,
    extra: 0,
    coberto: ativos.some((a) => sobrepoe(a, c)),
  }))
  return [...posCancelados, ...posAtivos]
}
