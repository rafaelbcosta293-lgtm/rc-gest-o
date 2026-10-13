import { Suspense } from "react"

import { ListaSeparadores, SeparadoresEquipa } from "./separadores"

/** Sub-navegação da secção Equipa. Não lê dados: só mostra os separadores. */
export default function LayoutEquipa({ children }: LayoutProps<"/equipa">) {
  return (
    <>
      {/* usePathname suspende nas rotas com [id]: mostra os separadores sem destaque entretanto. */}
      <Suspense fallback={<ListaSeparadores ativo={null} />}>
        <SeparadoresEquipa />
      </Suspense>
      {children}
    </>
  )
}
