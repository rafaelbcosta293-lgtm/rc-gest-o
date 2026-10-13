import type { Perfil } from "@/lib/perfis"

export type IconeNavegacao = "inicio" | "agenda" | "clientes" | "equipa" | "horas" | "perfil"

export type ItemNavegacao = {
  href: string
  rotulo: string
  icone: IconeNavegacao
  perfis: Perfil[]
}

/** Entradas do menu. Cada fase acrescenta as suas (orçamentos, stock…). */
const ITENS: ItemNavegacao[] = [
  { href: "/", rotulo: "Início", icone: "inicio", perfis: ["gerente", "chefe_equipa", "colaborador"] },
  { href: "/agenda", rotulo: "Agenda", icone: "agenda", perfis: ["gerente", "chefe_equipa"] },
  { href: "/clientes", rotulo: "Clientes", icone: "clientes", perfis: ["gerente", "chefe_equipa"] },
  { href: "/equipa", rotulo: "Equipa", icone: "equipa", perfis: ["gerente", "chefe_equipa", "colaborador"] },
  { href: "/horas", rotulo: "Horas", icone: "horas", perfis: ["gerente", "chefe_equipa", "colaborador"] },
  { href: "/perfil", rotulo: "Perfil", icone: "perfil", perfis: ["gerente", "chefe_equipa", "colaborador"] },
]

/** A barra inferior do telemóvel só tem espaço para 5 botões. */
export const MAXIMO_BARRA_INFERIOR = 5

export function itensParaPerfil(perfil: Perfil): ItemNavegacao[] {
  return ITENS.filter((item) => item.perfis.includes(perfil))
}

/**
 * Entradas da barra inferior (telemóvel). Se não couberem todas, o Perfil
 * sai da barra (fica acessível pelo ícone no topo do ecrã).
 */
export function itensBarraInferior(itens: ItemNavegacao[]): ItemNavegacao[] {
  if (itens.length <= MAXIMO_BARRA_INFERIOR) return itens
  return itens.filter((item) => item.icone !== "perfil").slice(0, MAXIMO_BARRA_INFERIOR)
}
