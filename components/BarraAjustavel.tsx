'use client'

import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react'

// Os itens (NavLinkTopBar, PillNavLink, ...) perguntam aqui se devem
// esconder o nome e mostrar só o ícone — decidido pelo BarraAjustavel,
// consoante o espaço disponível.
const ModoIconeContext = createContext(false)
export function useModoIcone() {
  return useContext(ModoIconeContext)
}

// Centrada enquanto tudo cabe. Só quando a janela fica pequena a mais
// para os nomes caberem é que começa a ajustar — primeiro escondendo
// os nomes (só ícone), e só se mesmo assim não couber é que encolhe
// tudo (ícones incluídos) a partir daí. Nunca aumenta acima de 100%, e
// nunca encolhe abaixo de ESCALA_MINIMA (a esse ponto passa a ser
// preciso fazer scroll).
const ESCALA_MINIMA = 0.55

export default function BarraAjustavel({
  children,
  className = '',
  navClassName = '',
}: {
  children: React.ReactNode
  className?: string
  navClassName?: string
}) {
  const exteriorRef = useRef<HTMLDivElement>(null)
  // Duas cópias escondidas (nunca visíveis, fora do fluxo normal da
  // página) só para medir a largura real com nomes e só com ícones —
  // a visível reflete a decisão, sem nunca precisar de "tentar e
  // voltar atrás" (isso é que arriscava ciclos sem fim nalgumas
  // larguras, com a barra a ficar presa a meio da troca).
  const medirComNomesRef = useRef<HTMLElement>(null)
  const medirSoIconesRef = useRef<HTMLElement>(null)
  const [modoIcone, setModoIcone] = useState(false)
  const [escala, setEscala] = useState(1)

  useLayoutEffect(() => {
    const exterior = exteriorRef.current
    const comNomes = medirComNomesRef.current
    const soIcones = medirSoIconesRef.current
    if (!exterior || !comNomes || !soIcones) return

    function recalcular() {
      const disponivel = exterior!.clientWidth
      const larguraComNomes = comNomes!.scrollWidth
      const larguraSoIcones = soIcones!.scrollWidth

      if (larguraComNomes <= disponivel) {
        setModoIcone(false)
        setEscala(1)
      } else if (larguraSoIcones <= disponivel) {
        setModoIcone(true)
        setEscala(1)
      } else {
        setModoIcone(true)
        setEscala(larguraSoIcones > 0 ? Math.max(ESCALA_MINIMA, disponivel / larguraSoIcones) : 1)
      }
    }

    recalcular()
    const observador = new ResizeObserver(recalcular)
    observador.observe(exterior)
    return () => observador.disconnect()
  }, [])

  return (
    <div ref={exteriorRef} className={`flex items-center justify-center overflow-hidden ${className}`}>
      <div aria-hidden className="pointer-events-none fixed top-0 left-0 opacity-0 -z-10">
        <nav ref={medirComNomesRef as React.RefObject<HTMLElement>} className={`w-max ${navClassName}`}>
          <ModoIconeContext.Provider value={false}>{children}</ModoIconeContext.Provider>
        </nav>
      </div>
      <div aria-hidden className="pointer-events-none fixed top-0 left-0 opacity-0 -z-10">
        <nav ref={medirSoIconesRef as React.RefObject<HTMLElement>} className={`w-max ${navClassName}`}>
          <ModoIconeContext.Provider value={true}>{children}</ModoIconeContext.Provider>
        </nav>
      </div>

      <nav
        className={`w-max ${navClassName}`}
        style={escala < 1 ? { transform: `scale(${escala})`, transformOrigin: 'center' } : undefined}
      >
        <ModoIconeContext.Provider value={modoIcone}>{children}</ModoIconeContext.Provider>
      </nav>
    </div>
  )
}
