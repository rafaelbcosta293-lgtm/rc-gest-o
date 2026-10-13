import { redirect } from "next/navigation"

// Só redireciona: não há interface para validar como navegação instantânea.
export const instant = false

/** A lista de trabalhos é a agenda. */
export default function PaginaTrabalhos() {
  redirect("/agenda")
}
