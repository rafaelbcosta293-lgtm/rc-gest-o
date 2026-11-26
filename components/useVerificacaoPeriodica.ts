'use client'

import { useEffect, useRef } from 'react'

// Repete uma verificação ao servidor de X em X tempo — mas só enquanto
// o separador está à vista. Um ecrã minimizado, noutro separador ou num
// tablet com o ecrã apagado não pede nada; quando volta a ser visto,
// verifica logo (se a última verificação já for antiga) e retoma o ritmo.
//
// Porquê: cada verificação é um pedido ao servidor da Vercel, e com
// vários computadores e tablets abertos o dia todo eram dezenas de
// milhares de pedidos por dia só para "ver se há novidades" — foi parte
// do que esgotou o processamento da conta em novembro de 2026.
export function useVerificacaoPeriodica(verificar: () => void | Promise<void>, intervaloMs: number) {
  const funcao = useRef(verificar)
  useEffect(() => {
    funcao.current = verificar
  })

  useEffect(() => {
    let ultima = Date.now()
    let relogio: ReturnType<typeof setInterval> | null = null
    const correr = () => {
      ultima = Date.now()
      void funcao.current()
    }
    const ligar = () => {
      if (relogio === null) relogio = setInterval(correr, intervaloMs)
    }
    const desligar = () => {
      if (relogio !== null) clearInterval(relogio)
      relogio = null
    }
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === 'visible') {
        if (Date.now() - ultima >= intervaloMs) correr()
        ligar()
      } else desligar()
    }
    if (document.visibilityState === 'visible') ligar()
    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    return () => {
      desligar()
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
    }
  }, [intervaloMs])
}
