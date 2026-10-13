"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { LoaderCircleIcon, SearchIcon } from "lucide-react"

import { Input } from "@/components/ui/input"

/**
 * Caixa de pesquisa que atualiza o parâmetro ?q= do endereço enquanto se
 * escreve (com um pequeno atraso). A página filtra no servidor.
 * Tem de estar dentro de <Suspense> (usa useSearchParams).
 */
export function CampoPesquisa({ placeholder = "Pesquisar…" }: { placeholder?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [valor, setValor] = useState(searchParams.get("q") ?? "")
  const [aPesquisar, iniciar] = useTransition()
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current)
  }, [])

  function alterar(novo: string) {
    setValor(novo)
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => {
      const parametros = new URLSearchParams(searchParams.toString())
      if (novo.trim()) parametros.set("q", novo.trim())
      else parametros.delete("q")
      const consulta = parametros.toString()
      iniciar(() => router.replace(consulta ? `${pathname}?${consulta}` : pathname, { scroll: false }))
    }, 300)
  }

  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={valor}
        onChange={(e) => alterar(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-9"
      />
      {aPesquisar && (
        <LoaderCircleIcon className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}
