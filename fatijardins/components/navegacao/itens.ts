import type { Perfil } from "@/lib/perfis"

export type IconeNavegacao = "inicio" | "clientes" | "equipa" | "perfil"

export type ItemNavegacao = {
  href: string
  rotulo: string
  icone: IconeNavegacao
  perfis: Perfil[]
}

/** Entradas do menu. Cada fase acrescenta as suas (agenda, orçamentos…). */
const ITENS: ItemNavegacao[] = [
  { href: "/", rotulo: "Início", icone: "inicio", perfis: ["gerente", "chefe_equipa", "colaborador"] },
  { href: "/clientes", rotulo: "Clientes", icone: "clientes", perfis: ["gerente", "chefe_equipa"] },
  { href: "/equipa", rotulo: "Equipa", icone: "equipa", perfis: ["gerente", "chefe_equipa", "colaborador"] },
  { href: "/perfil", rotulo: "Perfil", icone: "perfil", perfis: ["gerente", "chefe_equipa", "colaborador"] },
]

export function itensParaPerfil(perfil: Perfil): ItemNavegacao[] {
  return ITENS.filter((item) => item.perfis.includes(perfil))
}
