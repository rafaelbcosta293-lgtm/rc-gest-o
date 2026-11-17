import { createLucideIcon } from 'lucide-react'

// Ícones próprios, no mesmo estilo dos da lucide (24×24, traço 2,
// pontas redondas) — a biblioteca não tem estes desenhos.

// Pilates: figura no tapete na posição "teaser" (sentada em V, pernas
// esticadas no ar e braços paralelos às pernas).
export const IconePilates = createLucideIcon('Pilates', [
  ['path', { d: 'M2 21h20', key: 'tapete' }],
  ['circle', { cx: '5.5', cy: '6.5', r: '2', key: 'cabeca' }],
  ['path', { d: 'M6.5 10 10 19', key: 'tronco' }],
  ['path', { d: 'M10 19 20.5 10', key: 'pernas' }],
  ['path', { d: 'M7.5 12.5 15 9', key: 'bracos' }],
])

// Treino Acompanhado: um grupo (três pessoas, a do meio à frente).
export const IconeGrupo = createLucideIcon('Grupo', [
  ['circle', { cx: '12', cy: '8', r: '3', key: 'c1' }],
  ['path', { d: 'M6.5 20v-1a5.5 5.5 0 0 1 11 0v1', key: 'c1-corpo' }],
  ['circle', { cx: '4.5', cy: '10', r: '2', key: 'c2' }],
  ['path', { d: 'M1.5 18v-.5a3 3 0 0 1 4-2.8', key: 'c2-corpo' }],
  ['circle', { cx: '19.5', cy: '10', r: '2', key: 'c3' }],
  ['path', { d: 'M22.5 18v-.5a3 3 0 0 0-4-2.8', key: 'c3-corpo' }],
])
