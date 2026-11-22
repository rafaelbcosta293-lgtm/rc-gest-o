'use client'

import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react'

// Os itens (NavLinkTopBar, PillNavLink, ...) perguntam aqui como se
// devem desenhar — decidido pelo BarraAjustavel, consoante o espaço:
//   'nomes'     ícone e nome lado a lado (quando tudo cabe);
//   'empilhado' ícone com o nome pequeno por baixo (cabe em muito menos
//               largura sem nunca deixar um ícone sem legenda);
//   'icones'    só o ícone (janelas mesmo estreitas).
export type ModoBarra = 'nomes' | 'empilhado' | 'icones'
const ModoBarraContext = createContext<ModoBarra>('nomes')
export function useModoBarra() {
  return useContext(ModoBarraContext)
}
export function useModoIcone() {
  return useContext(ModoBarraContext) === 'icones'
}

// Forma da pílula em cada modo — partilhada por todas as barras para
// ficarem iguais (estúdio, Administração e Coordenação).
export function formaPilula(modo: ModoBarra) {
  if (modo === 'icones') return 'items-center rounded-full p-2 text-[13px]'
  if (modo === 'empilhado') return 'flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[10.5px] leading-tight'
  return 'items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px]'
}

// Centrada enquanto tudo cabe. Quando a janela fica pequena a mais
// para os nomes caberem ao lado dos ícones, passa-os para baixo de
// cada ícone; só se nem assim couber é que os esconde, e só se mesmo
// só com ícones não couber é que encolhe tudo a partir daí. Nunca
// aumenta acima de 100%, e nunca encolhe abaixo de ESCALA_MINIMA (a
// esse ponto passa a ser preciso fazer scroll).
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
  // Três cópias escondidas (nunca visíveis, fora do fluxo normal da
  // página, dentro de uma caixa de tamanho zero para não alargarem a
  // página em ecrãs estreitos) só para medir a largura real em cada modo —
  // a visível reflete a decisão, sem nunca precisar de "tentar e
  // voltar atrás" (isso é que arriscava ciclos sem fim nalgumas
  // larguras, com a barra a ficar presa a meio da troca).
  const medirComNomesRef = useRef<HTMLElement>(null)
  const medirEmpilhadoRef = useRef<HTMLElement>(null)
  const medirSoIconesRef = useRef<HTMLElement>(null)
  const [modo, setModo] = useState<ModoBarra>('nomes')
  const [escala, setEscala] = useState(1)

  useLayoutEffect(() => {
    const exterior = exteriorRef.current
    const comNomes = medirComNomesRef.current
    const empilhado = medirEmpilhadoRef.current
    const soIcones = medirSoIconesRef.current
    if (!exterior || !comNomes || !empilhado || !soIcones) return

    function recalcular() {
      const disponivel = exterior!.clientWidth
      const larguraComNomes = comNomes!.scrollWidth
      const larguraEmpilhado = empilhado!.scrollWidth
      const larguraSoIcones = soIcones!.scrollWidth

      if (larguraComNomes <= disponivel) {
        setModo('nomes')
        setEscala(1)
      } else if (larguraEmpilhado <= disponivel) {
        setModo('empilhado')
        setEscala(1)
      } else if (larguraSoIcones <= disponivel) {
        setModo('icones')
        setEscala(1)
      } else {
        setModo('icones')
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
      {(
        [
          ['nomes', medirComNomesRef],
          ['empilhado', medirEmpilhadoRef],
          ['icones', medirSoIconesRef],
        ] as const
      ).map(([m, ref]) => (
        <div key={m} aria-hidden className="pointer-events-none fixed top-0 left-0 -z-10 h-0 w-0 overflow-hidden opacity-0">
          <nav ref={ref as React.RefObject<HTMLElement>} className={`w-max ${navClassName}`}>
            <ModoBarraContext.Provider value={m}>{children}</ModoBarraContext.Provider>
          </nav>
        </div>
      ))}

      <nav
        className={`w-max ${navClassName}`}
        style={escala < 1 ? { transform: `scale(${escala})`, transformOrigin: 'center' } : undefined}
      >
        <ModoBarraContext.Provider value={modo}>{children}</ModoBarraContext.Provider>
      </nav>
    </div>
  )
}
