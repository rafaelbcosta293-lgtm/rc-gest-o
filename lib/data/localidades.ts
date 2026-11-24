import { normalizarTexto } from '@/lib/texto'
import dados from './localidades.json'

// As cidades, vilas e aldeias de Portugal (continente e ilhas), cada uma
// com o concelho e o distrito — para a morada dos clientes ficar sempre
// escrita da mesma maneira (escolhe-se da lista em vez de se escrever à
// mão) e se poder fazer estatística por zona.
// Fonte: lista de localidades dos CTT (github.com/centraldedados/codigos_postais).
export type Localidade = { nome: string; concelho: string; distrito: string }

type Linha = { nome: string; concelho: string; distrito: string; chave: string; palavras: string[]; peso: number; cps: string[] }

const base = dados as unknown as { distritos: string[]; concelhos: [string, number][]; localidades: [string, number, number, string][] }

// O que não conta para comparar nomes: acentos, maiúsculas e pontuação
// ("Sta.ª Catarina" ≈ "sta catarina").
export function chaveDeLocalidade(texto: string): string {
  return normalizarTexto(texto)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Abreviaturas habituais, para "Sta. Catarina" encontrar "Santa Catarina".
const ABREVIATURAS: Record<string, string> = { sta: 'santa', sto: 'santo', s: 'sao', sr: 'senhor', sra: 'senhora', n: 'nossa', v: 'vila', vn: 'vila nova' }
function expandir(chave: string): string {
  return chave
    .split(' ')
    .map((p) => ABREVIATURAS[p] ?? p)
    .join(' ')
}

let indice: Linha[] | null = null
function linhas(): Linha[] {
  if (!indice) {
    indice = base.localidades.map(([nome, c, peso, cps]) => {
      const [concelho, d] = base.concelhos[c]
      const chave = chaveDeLocalidade(nome)
      return { nome, concelho, distrito: base.distritos[d], chave, palavras: chave.split(' '), peso, cps: cps.split(' ') }
    })
  }
  return indice
}

// Procura localidades pelo que a pessoa vai escrevendo. Primeiro as que
// começam assim, depois as que têm uma palavra a começar assim; dentro
// de cada grupo, primeiro as do código postal dado (se houver), depois
// as dos distritos da zona (os dos estúdios) e por fim as maiores. "cp"
// são os 4 primeiros dígitos do código postal.
export const DISTRITOS_DA_ZONA = ['Leiria', 'Santarém']

export function procurarLocalidades(
  texto: string,
  opcoes: { cp?: string | null; limite?: number; distritosPerto?: string[] } = {}
): Localidade[] {
  const limite = opcoes.limite ?? 8
  const escrita = chaveDeLocalidade(texto)
  if (escrita.length < 2) return []
  const alvos = [...new Set([escrita, expandir(escrita)])]
  const cp = opcoes.cp?.replace(/\D/g, '').slice(0, 4)
  const achadas: { l: Linha; nivel: number }[] = []
  for (const l of linhas()) {
    let nivel = 9
    for (const alvo of alvos) {
      if (l.chave === alvo) nivel = Math.min(nivel, 0)
      else if (l.chave.startsWith(alvo)) nivel = Math.min(nivel, 1)
      else if (l.palavras.some((p) => p.startsWith(alvo)) || l.chave.includes(` ${alvo}`)) nivel = Math.min(nivel, 2)
    }
    if (nivel < 9) achadas.push({ l, nivel })
  }
  const doCp = (l: Linha) => (cp && cp.length === 4 && l.cps.includes(cp) ? 0 : 1)
  const perto = opcoes.distritosPerto ?? DISTRITOS_DA_ZONA
  const daZona = (l: Linha) => (perto.includes(l.distrito) ? 0 : 1)
  achadas.sort(
    (a, b) =>
      a.nivel - b.nivel || doCp(a.l) - doCp(b.l) || daZona(a.l) - daZona(b.l) || b.l.peso - a.l.peso || a.l.nome.localeCompare(b.l.nome, 'pt')
  )
  return achadas.slice(0, limite).map(({ l }) => ({ nome: l.nome, concelho: l.concelho, distrito: l.distrito }))
}

// A localidade com exatamente este nome (sem contar acentos, maiúsculas
// nem abreviaturas). Havendo várias com o mesmo nome, escolhe a do
// código postal dado; sem isso, só responde se houver uma única.
export function localidadeExata(nome: string, cp?: string | null): Localidade | null {
  const alvos = new Set([chaveDeLocalidade(nome), expandir(chaveDeLocalidade(nome))])
  const iguais = linhas().filter((l) => alvos.has(l.chave))
  if (iguais.length === 0) return null
  const cp4 = cp?.replace(/\D/g, '').slice(0, 4)
  const escolhida = iguais.length === 1 ? iguais[0] : cp4 && cp4.length === 4 ? (iguais.filter((l) => l.cps.includes(cp4)).length === 1 ? iguais.find((l) => l.cps.includes(cp4))! : null) : null
  return escolhida ? { nome: escolhida.nome, concelho: escolhida.concelho, distrito: escolhida.distrito } : null
}
