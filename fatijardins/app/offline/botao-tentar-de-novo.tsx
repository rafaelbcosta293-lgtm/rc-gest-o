"use client"

import { useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { RotateCwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export function BotaoTentarDeNovo() {
  const router = useRouter()

  // Volta a pedir a página que falhou (o service worker mostra esta página
  // no endereço pedido). Se /offline foi aberta diretamente, vai para o início.
  const tentarDeNovo = useCallback(() => {
    if (window.location.pathname === "/offline") router.push("/")
    else window.location.reload()
  }, [router])

  // Quando a ligação volta, tenta sozinho.
  useEffect(() => {
    window.addEventListener("online", tentarDeNovo)
    return () => window.removeEventListener("online", tentarDeNovo)
  }, [tentarDeNovo])

  return (
    <Button size="lg" className="w-full" onClick={tentarDeNovo}>
      <RotateCwIcon />
      Tentar de novo
    </Button>
  )
}
