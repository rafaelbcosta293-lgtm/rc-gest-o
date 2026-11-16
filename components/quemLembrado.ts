'use client'

import { useSyncExternalStore } from 'react'

// O último nome escolhido em "quem fez" neste aparelho — para o tablet
// do estúdio não obrigar a escolher o mesmo nome a cada tarefa. Fica só
// no browser (não é enviado para lado nenhum por si).
const CHAVE = 'rc-quem-fez'
const ouvintes = new Set<() => void>()

function ler(): string {
  try {
    return window.localStorage.getItem(CHAVE) ?? ''
  } catch {
    return ''
  }
}

export function lembrarQuemFez(id: string) {
  try {
    if (id) window.localStorage.setItem(CHAVE, id)
  } catch {
    // sem armazenamento (janela privada): só não fica lembrado
  }
  ouvintes.forEach((avisar) => avisar())
}

function subscrever(avisar: () => void) {
  ouvintes.add(avisar)
  window.addEventListener('storage', avisar)
  return () => {
    ouvintes.delete(avisar)
    window.removeEventListener('storage', avisar)
  }
}

// O id lembrado ('' se nenhum). No servidor é sempre ''.
export function useQuemLembrado(): string {
  return useSyncExternalStore(subscrever, ler, () => '')
}

// A equipa com a pessoa lembrada em primeiro lugar.
export function comLembradoPrimeiro<T extends { id: string }>(pessoas: T[], lembrado: string): T[] {
  const i = pessoas.findIndex((p) => p.id === lembrado)
  return i <= 0 ? pessoas : [pessoas[i], ...pessoas.slice(0, i), ...pessoas.slice(i + 1)]
}
