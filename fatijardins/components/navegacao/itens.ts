import type { Perfil } from "@/lib/perfis"

export type IconeNavegacao = "inicio" | "agenda" | "orcamentos" | "clientes" | "equipa" | "horas" | "perfil"

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
  { href: "/orcamentos", rotulo: "Orçamentos", icone: "orcamentos", perfis: ["gerente", "chefe_equipa"] },
  { href: "/clientes", rotulo: "Clientes", icone: "clientes", perfis: ["gerente", "chefe_equipa"] },
  { href: "/horas", rotulo: "Horas", icone: "horas", perfis: ["gerente", "chefe_equipa", "colaborador"] },
  { href: "/equipa", rotulo: "Equipa", icone: "equipa", perfis: ["gerente", "chefe_equipa", "colaborador"] },
  { href: "/perfil", rotulo: "Perfil", icone: "perfil", perfis: ["gerente", "chefe_equipa", "colaborador"] },
]

/** A barra inferior do telemóvel só tem espaço para 5 botões. */
export const MAXIMO_BARRA_INFERIOR = 5

export function itensParaPerfil(perfil: Perfil): ItemNavegacao[] {
  return ITENS.filter((item) => item.perfis.includes(perfil))
}

/**
 * Entradas da barra inferior (telemóvel). Se não couberem todas, o Perfil
 * sai da barra (fica acessível pelo ícone no topo do ecrã) e, se ainda não
 * couberem, as últimas vão para o botão "Mais".
 */
export function itensBarraInferior(itens: ItemNavegacao[]): { principais: ItemNavegacao[]; mais: ItemNavegacao[] } {
  if (itens.length <= MAXIMO_BARRA_INFERIOR) return { principais: itens, mais: [] }
  const semPerfil = itens.filter((item) => item.icone !== "perfil")
  if (semPerfil.length <= MAXIMO_BARRA_INFERIOR) return { principais: semPerfil, mais: [] }
  return {
    principais: semPerfil.slice(0, MAXIMO_BARRA_INFERIOR - 1),
    mais: semPerfil.slice(MAXIMO_BARRA_INFERIOR - 1),
  }
}
