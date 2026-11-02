'use client'

import { useLayoutEffect, useRef, useState } from 'react'

// Quando há espaço a mais, as pastas espalham-se ao longo da barra
// toda (justify-between, largura 100%) em vez de ficarem agrupadas no
// centro. Quando não há espaço suficiente nem para o espaçamento
// mínimo entre elas, encolhe tudo (ícones e texto juntos, na mesma
// proporção) só o necessário para caber — nunca esconde nada, nunca
// aumenta acima de 100%, e nunca encolhe abaixo de ESCALA_MINIMA
// (continua legível mesmo em janelas muito estreitas; a esse ponto
// passa a ser preciso fazer scroll, como antes).
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

    // Com justify-between e largura 100%, scrollWidth só ultrapassa
    // clientWidth quando mesmo o espaçamento mínimo (gap) não cabe —
    // exatamente o sinal certo para começar a encolher.
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
    <div ref={exteriorRef} className={`flex items-center overflow-hidden ${className}`}>
      <nav
        ref={navRef as React.RefObject<HTMLElement>}
        className={`w-full ${navClassName}`}
        style={
          escala < 1
            // Âncora à esquerda (não ao centro): com justify-between a
            // encolher, o que ultrapassa a caixa fica sempre à direita,
            // nunca dos dois lados — ancorar ao centro deixava sempre um
            // bocado por cortar do lado direito, mesmo com a escala certa.
            ? { transform: `scale(${escala})`, transformOrigin: 'left center' }
            : undefined
        }
      >
        {children}
      </nav>
    </div>
  )
}
