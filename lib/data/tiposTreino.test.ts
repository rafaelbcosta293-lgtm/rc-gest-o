import { describe, expect, it } from 'vitest'
import { categoriasDoTipo, ehTipoTreino, exerciciosDoTipo, LINHAS_DE_UM_PLANO_NOVO, primeiroOsDoTipo, TIPOS_TREINO } from './tiposTreino'
import type { Categoria } from '@/lib/supabase/database.types'

const cat = (id: string, nome: string, parte: 'A' | 'B' = 'A') => ({ id, nome, parte, nota: null, ordem: 1, ativo: true }) as unknown as Categoria

// Os nomes das categorias tal como estão no catálogo.
const categorias = [
  cat('inf', 'Membros Inferiores (Geral)'),
  cat('quad', 'Parte Anterior das Pernas (Quadríceps)'),
  cat('glu', 'Glúteos (Máximo, Médio e Mínimo)'),
  cat('gem', 'Gémeos / Flexores do Tornozelo'),
  cat('sup', 'Membros Superiores (Geral)'),
  cat('peito', 'Parte Anterior do Tronco (Peitoral)'),
  cat('ombro', 'Ombros / Deltoides'),
  cat('tri', 'Braços — Tríceps'),
  cat('abs', 'Abdominal (Parede Abdominal Direta)'),
  cat('core', 'Core (Estabilização Global)'),
  cat('fmax', 'Força Máxima / Carga Elevada', 'B'),
  cat('cardio', 'Condicionamento Cardiorrespiratório e HIIT', 'B'),
  cat('cali', 'Calistenia / Peso Corporal', 'B'),
  cat('reab', 'Reabilitação / Pré-Habilitação / Mobilidade', 'B'),
  cat('slid', 'Discos Deslizantes (Sliders)', 'B'),
]
const ex = (id: string, nome: string) => ({ id, nome })
const catalogo = {
  categorias,
  porCategoria: {
    inf: [ex('1', 'Agachamento'), ex('2', 'Leg Press')],
    quad: [ex('2', 'Leg Press'), ex('3', 'Extensão de pernas')],
    peito: [ex('4', 'Supino')],
    cardio: [ex('5', 'Remo ergómetro')],
    reab: [ex('6', 'Mobilidade da anca')],
  },
}

describe('tipos de treino', () => {
  it('cada tipo apanha as categorias certas do catálogo', () => {
    expect(categoriasDoTipo(catalogo, 'Membros inferiores')).toEqual(['inf', 'quad', 'glu', 'gem'])
    expect(categoriasDoTipo(catalogo, 'Membros superiores')).toEqual(['sup', 'peito', 'ombro', 'tri'])
    expect(categoriasDoTipo(catalogo, 'Cardio / HIIT')).toEqual(['cardio'])
    expect(categoriasDoTipo(catalogo, 'Recuperação / mobilidade')).toEqual(['reab'])
    expect(categoriasDoTipo(catalogo, 'Funcional')).toEqual(['core', 'cali', 'slid'])
    expect(categoriasDoTipo(catalogo, 'Corpo inteiro')).toEqual(['inf', 'sup', 'core', 'fmax'])
    expect(categoriasDoTipo(catalogo, 'Core / abdominal')).toEqual(['abs', 'core'])
  })
  it('todos os tipos encontram pelo menos uma categoria', () => {
    for (const t of TIPOS_TREINO) expect(categoriasDoTipo(catalogo, t.nome).length, t.nome).toBeGreaterThan(0)
  })
  it('exercícios do tipo: sem repetidos e por ordem alfabética', () => {
    expect(exerciciosDoTipo(catalogo, 'Membros inferiores').map((e) => e.nome)).toEqual(['Agachamento', 'Extensão de pernas', 'Leg Press'])
    expect(exerciciosDoTipo(catalogo, null)).toEqual([])
    expect(exerciciosDoTipo(catalogo, 'Não existe')).toEqual([])
  })
  it('numa pesquisa, os do tipo vêm primeiro', () => {
    const lista = [ex('4', 'Supino'), ex('1', 'Agachamento'), ex('5', 'Remo ergómetro'), ex('2', 'Leg Press')]
    expect(primeiroOsDoTipo(lista, exerciciosDoTipo(catalogo, 'Membros inferiores')).map((e) => e.id)).toEqual(['1', '2', '4', '5'])
    expect(primeiroOsDoTipo(lista, [])).toBe(lista)
  })
  it('ehTipoTreino', () => {
    expect(ehTipoTreino('Funcional')).toBe(true)
    expect(ehTipoTreino('funcional')).toBe(false)
    expect(ehTipoTreino(null)).toBe(false)
  })
  it('plano novo: 1 linha de aquecimento e 5 de principal', () => {
    expect(LINHAS_DE_UM_PLANO_NOVO.filter((b) => b === 'Aquecimento')).toHaveLength(1)
    expect(LINHAS_DE_UM_PLANO_NOVO.filter((b) => b === 'Principal')).toHaveLength(5)
  })
})
