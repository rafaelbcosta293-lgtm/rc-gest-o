'use client'

import { useLayoutEffect, useRef, useState } from 'react'

// Encolhe o conteúdo todo (ícones e texto incluídos, na mesma
// proporção) só o suficiente para caber na largura disponível, em vez
// de deixar scroll horizontal quando a janela do computador está mais
// estreita (ex.: a meio ecrã) — nunca aumenta acima de 100%, e nunca
// encolhe abaixo de ESCALA_MINIMA (continua legível mesmo em janelas
// muito estreitas; a esse ponto passa a ser preciso fazer scroll, como
// antes).
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
  const navRef = useRef<HTMLElement>(null)
  const [escala, setEscala] = useState(1)

  useLayoutEffect(() => {
    const exterior = exteriorRef.current
    const nav = navRef.current
    if (!exterior || !nav) return

    // "nav" tem largura própria (w-max, nunca esticada ao contentor) —
    // por isso o scrollWidth mede sempre o conteúdo real todo. Centrar
    // um <nav> esticado (ex.: com justify-center) faria o conteúdo
    // ultrapassar os dois lados por igual, e scrollWidth só conta a
    // ultrapassagem à direita — o lado esquerdo ficava sempre cortado.
    function recalcular() {
      const disponivel = exterior!.clientWidth
      const necessaria = nav!.scrollWidth
      setEscala(necessaria > 0 && necessaria > disponivel ? Math.max(ESCALA_MINIMA, disponivel / necessaria) : 1)
    }

    recalcular()
    const observador = new ResizeObserver(recalcular)
    observador.observe(exterior)
    return () => observador.disconnect()
  }, [])

  return (
    <div ref={exteriorRef} className={`flex items-center justify-center overflow-hidden ${className}`}>
      <nav
        ref={navRef as React.RefObject<HTMLElement>}
        className={`w-max ${navClassName}`}
        style={escala < 1 ? { transform: `scale(${escala})`, transformOrigin: 'center' } : undefined}
      >
        {children}
      </nav>
    </div>
  )
}
