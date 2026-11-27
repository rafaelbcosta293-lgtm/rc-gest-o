// Tipo de treino de um plano (membros inferiores, cardio, …). Serve para
// o seletor de exercícios mostrar primeiro os exercícios desse tipo.
import { normalizarTexto } from '@/lib/texto'
import type { CatalogoExercicios, ItemCatalogo } from '@/lib/data/catalogo'

// Cada tipo liga-se às categorias do catálogo pelas palavras do nome da
// categoria (sem acentos, minúsculas) — assim continua a funcionar se
// alguém acrescentar ou ajustar categorias.
export const TIPOS_TREINO: { nome: string; palavras: string[] }[] = [
  { nome: 'Membros inferiores', palavras: ['membros inferiores', 'pernas', 'gluteo', 'adutor', 'gemeo'] },
  { nome: 'Membros superiores', palavras: ['membros superiores', 'tronco', 'ombro', 'braco'] },
  { nome: 'Corpo inteiro', palavras: ['(geral)', 'forca maxima', 'core'] },
  { nome: 'Core / abdominal', palavras: ['abdominal', 'core', 'estabilidade'] },
  { nome: 'Força', palavras: ['forca maxima', 'forca explosiva'] },
  { nome: 'Funcional', palavras: ['calistenia', 'unilatera', 'estabilidade', 'desliza', 'circuito', 'explosiva', 'core'] },
  { nome: 'Cardio / HIIT', palavras: ['cardio', 'hiit', 'pliometric'] },
  { nome: 'Recuperação / mobilidade', palavras: ['reabilitacao', 'mobilidade', 'habilitacao'] },
]

export const ehTipoTreino = (v: string | null | undefined): v is string => !!v && TIPOS_TREINO.some((t) => t.nome === v)

// As categorias do catálogo que pertencem a um tipo de treino.
export function categoriasDoTipo(catalogo: Pick<CatalogoExercicios, 'categorias'>, tipo: string | null | undefined): string[] {
  const def = TIPOS_TREINO.find((t) => t.nome === tipo)
  if (!def) return []
  return catalogo.categorias
    .filter((c) => {
      const nome = normalizarTexto(c.nome)
      return def.palavras.some((p) => nome.includes(p))
    })
    .map((c) => c.id)
}

// Os exercícios de um tipo de treino, sem repetidos, por ordem alfabética.
export function exerciciosDoTipo(catalogo: Pick<CatalogoExercicios, 'categorias' | 'porCategoria'>, tipo: string | null | undefined): ItemCatalogo[] {
  const vistos = new Map<string, ItemCatalogo>()
  for (const catId of categoriasDoTipo(catalogo, tipo)) {
    for (const e of catalogo.porCategoria[catId] ?? []) if (!vistos.has(e.id)) vistos.set(e.id, e)
  }
  return [...vistos.values()].sort((a, b) => a.nome.localeCompare(b.nome))
}

// Põe à frente os exercícios do tipo de treino, mantendo a ordem dentro
// de cada grupo (para os resultados de uma pesquisa, por exemplo).
export function primeiroOsDoTipo(lista: ItemCatalogo[], doTipo: ItemCatalogo[]): ItemCatalogo[] {
  if (doTipo.length === 0) return lista
  const ids = new Set(doTipo.map((e) => e.id))
  return [...lista.filter((e) => ids.has(e.id)), ...lista.filter((e) => !ids.has(e.id))]
}

// Um plano novo abre já com estas linhas em branco: aquecimento e a
// parte principal (acrescentam-se ou tiram-se à vontade).
export const LINHAS_DE_UM_PLANO_NOVO = [
  'Aquecimento',
  'Principal',
  'Principal',
  'Principal',
  'Principal',
  'Principal',
] as const
