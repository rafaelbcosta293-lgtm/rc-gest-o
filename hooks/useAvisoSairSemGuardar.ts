'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const MENSAGEM_AVISO = 'Tens alterações por guardar. Se saíres agora, vais perdê-las.'

// Protege contra sair sem guardar — pedida para a app toda, para nunca
// se perder uma edição por esquecimento. Cobre as duas formas de "sair":
//   1. Fechar a aba, recarregar ou escrever outro URL — o "beforeunload"
//      do próprio browser trata disto (a mensagem é sempre a do browser,
//      não esta — os browsers modernos já não deixam personalizar).
//   2. Clicar num link desta app para outra página — o Next.js (App
//      Router) não tem um "bloqueador" de navegação nativo como outras
//      bibliotecas, por isso interceta-se o clique em qualquer <a> da
//      página, em fase de captura, e pergunta antes de deixar navegar.
//
// Uso: um formulário já "use client" chama o hook, marca "sujo" no
// onChange do <form> (um só handler, o evento sobe de qualquer campo
// lá dentro) e limpa depois de guardar com sucesso.
//
//   const { marcarSujo, limparSujo } = useAvisoSairSemGuardar()
//   <form onChange={marcarSujo} action={...}>
//
// Nunca passar uma função normal a um Componente Cliente vindo de um
// Componente de Servidor (foi exatamente isso que já quebrou a app duas
// vezes nesta sessão) — este hook só é chamado DENTRO de componentes já
// marcados "use client", nunca recebido como prop, por isso não tem
// esse risco.
export function useAvisoSairSemGuardar() {
  const [sujo, setSujo] = useState(false)
  const sujoRef = useRef(false)

  useEffect(() => {
    sujoRef.current = sujo
  }, [sujo])

  useEffect(() => {
    function aoFechar(e: BeforeUnloadEvent) {
      if (!sujoRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }

    function aoClicar(e: MouseEvent) {
      if (!sujoRef.current) return
      const alvo = (e.target as HTMLElement | null)?.closest('a[href]') as HTMLAnchorElement | null
      if (!alvo) return
      // Não interceta: nova aba, download, âncora só de página (#secção)
      // ou um link explicitamente marcado para ignorar este aviso.
      if (
        alvo.target === '_blank' ||
        alvo.hasAttribute('download') ||
        alvo.dataset.semAvisoSair !== undefined ||
        alvo.getAttribute('href')?.startsWith('#')
      ) {
        return
      }
      if (!window.confirm(MENSAGEM_AVISO)) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }

    window.addEventListener('beforeunload', aoFechar)
    document.addEventListener('click', aoClicar, true)
    return () => {
      window.removeEventListener('beforeunload', aoFechar)
      document.removeEventListener('click', aoClicar, true)
    }
  }, [])

  const marcarSujo = useCallback(() => setSujo(true), [])
  const limparSujo = useCallback(() => setSujo(false), [])

  return { sujo, marcarSujo, limparSujo }
}
