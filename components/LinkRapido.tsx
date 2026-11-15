'use client'

import NextLink, { useLinkStatus } from 'next/link'
import { useEffect, useRef, useState, type ComponentProps, type RefObject } from 'react'

// O <Link> da app. Faz o mesmo que o do Next, mais duas coisas para a
// navegação se sentir imediata:
//
// 1. Começa a carregar a página de destino (dados incluídos) mal há
//    intenção de lá ir — o rato pousa no link, o dedo toca-lhe, ou o
//    teclado chega a ele. Entre esse momento e o clique passam
//    décimas de segundo que o servidor aproveita: muitas vezes a
//    página já está pronta quando o clique acontece.
//    (Só por intenção, e não para todos os links à vista: carregar
//    todas as páginas de um menu de cada vez que ele aparece eram
//    dezenas de pedidos ao servidor para páginas que ninguém abre.)
//
// 2. Enquanto a página não chega, o link clicado fica marcado
//    (data-pendente) e aparece uma barra fina no topo — ver
//    app/globals.css. Dá resposta ao clique na hora, sem esconder a
//    página atual atrás de um ecrã de carregamento (o React segura
//    esses ecrãs no mínimo 300 ms, mesmo que a página chegue antes).

// Passar o rato por cima de um menu a caminho de outro botão não deve
// contar como intenção.
const DEMORA_DO_RATO_MS = 60

let navegacoesEmCurso = 0

function IndicadorDeNavegacao({ ancora }: { ancora: RefObject<HTMLAnchorElement | null> }) {
  const { pending } = useLinkStatus()
  useEffect(() => {
    if (!pending) return
    const link = ancora.current
    link?.setAttribute('data-pendente', '')
    navegacoesEmCurso++
    document.documentElement.setAttribute('data-a-navegar', '')
    return () => {
      link?.removeAttribute('data-pendente')
      navegacoesEmCurso = Math.max(0, navegacoesEmCurso - 1)
      if (navegacoesEmCurso === 0) document.documentElement.removeAttribute('data-a-navegar')
    }
  }, [pending, ancora])
  return null
}

type Props = ComponentProps<typeof NextLink>

export default function LinkRapido({
  prefetch,
  onMouseEnter,
  onMouseLeave,
  onTouchStart,
  onFocus,
  ref,
  children,
  ...resto
}: Props) {
  const [intencao, setIntencao] = useState(false)
  const ancora = useRef<HTMLAnchorElement | null>(null)
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (espera.current) clearTimeout(espera.current)
    },
    []
  )

  // Guarda o <a> para o indicador e entrega-o também a quem pediu a ref
  // de fora (os menus usam-na para posicionar os submenus).
  function guardarAncora(no: HTMLAnchorElement | null) {
    ancora.current = no
    if (typeof ref === 'function') return ref(no)
    if (ref) ref.current = no
  }

  return (
    <NextLink
      {...resto}
      ref={guardarAncora}
      // Quem indicar "prefetch" à mão mantém o que pediu.
      prefetch={prefetch !== undefined ? prefetch : intencao ? true : null}
      onMouseEnter={(e) => {
        onMouseEnter?.(e)
        if (intencao || espera.current) return
        espera.current = setTimeout(() => {
          espera.current = null
          setIntencao(true)
        }, DEMORA_DO_RATO_MS)
      }}
      onMouseLeave={(e) => {
        onMouseLeave?.(e)
        if (espera.current) {
          clearTimeout(espera.current)
          espera.current = null
        }
      }}
      onTouchStart={(e) => {
        onTouchStart?.(e)
        setIntencao(true)
      }}
      onFocus={(e) => {
        onFocus?.(e)
        setIntencao(true)
      }}
    >
      {children}
      <IndicadorDeNavegacao ancora={ancora} />
    </NextLink>
  )
}
