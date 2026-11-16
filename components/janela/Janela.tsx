'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import type { ResultadoSemSair } from '@/lib/acoes/semSair'

// Janela de edição no sítio, para qualquer formulário já existente.
//
// Abre uma caixa por cima da página (botão direito numa linha, ou um
// botão "Novo…"), vai buscar os dados do que se quer editar e mostra o
// formulário de sempre lá dentro. Ao guardar, o envio é apanhado aqui:
// em vez de mudar de página, chama-se a ação pela via "sem sair" — com
// erro, a mensagem aparece na janela e o que foi escrito mantém-se; sem
// erro, a janela fecha-se e a página por baixo atualiza-se.
//
// Cada módulo tem um ficheiro pequeno que junta isto ao seu formulário
// (ver, por exemplo, app/painel/[estudio]/leads/JanelaLeads.tsx).

type Abertura = { alvo: string | null; extra?: Record<string, string> }

const Contexto = createContext<{ abrir: (alvo: string | null, extra?: Record<string, string>) => void } | null>(null)

export function useJanela() {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('Falta o ProvedorJanela à volta deste componente.')
  return ctx
}

// Para componentes que também são usados em páginas sem janela: devolve
// null quando não há ProvedorJanela à volta.
export function useJanelaOpcional() {
  return useContext(Contexto)
}

export function ProvedorJanela<D>({
  children,
  carregar,
  guardar,
  titulo,
  conteudo,
  largura = 'max-w-2xl',
}: {
  children: React.ReactNode
  // Vai buscar o que o formulário precisa (alvo null = criar de novo).
  carregar: (alvo: string | null, extra?: Record<string, string>) => Promise<D | { erro: string }>
  // Guarda pela via "sem sair" (ver lib/acoes/semSair.ts).
  guardar: (formData: FormData) => Promise<ResultadoSemSair>
  titulo: (alvo: string | null) => string
  // O formulário, com os dados carregados.
  conteudo: (dados: D, alvo: string | null) => React.ReactNode
  largura?: string
}) {
  const router = useRouter()
  const [aberta, setAberta] = useState<Abertura | null>(null)
  const [dados, setDados] = useState<D | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aCarregar, iniciarCarga] = useTransition()
  const [aGuardar, iniciarGuarda] = useTransition()

  const abrir = useCallback(
    (alvo: string | null, extra?: Record<string, string>) => {
      setAberta({ alvo, extra })
      setDados(null)
      setErro(null)
      iniciarCarga(async () => {
        const r = await carregar(alvo, extra)
        if (r && typeof r === 'object' && 'erro' in r) setErro((r as { erro: string }).erro)
        else setDados(r as D)
      })
    },
    [carregar]
  )
  const fechar = useCallback(() => setAberta(null), [])
  const valor = useMemo(() => ({ abrir }), [abrir])

  useEffect(() => {
    if (!aberta) return
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') fechar()
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [aberta, fechar])

  // Apanha o envio de qualquer formulário dentro da janela, antes de o
  // browser (ou o React) o mandar pelo caminho normal.
  function aoSubmeter(e: React.FormEvent<HTMLDivElement>) {
    const form = e.target as HTMLFormElement
    if (!(form instanceof HTMLFormElement)) return
    e.preventDefault()
    e.stopPropagation()
    const botao = (e.nativeEvent as SubmitEvent).submitter
    const formData = botao instanceof HTMLElement ? new FormData(form, botao) : new FormData(form)
    setErro(null)
    iniciarGuarda(async () => {
      const r = await guardar(formData)
      if (r.erro) setErro(r.erro)
      else {
        fechar()
        router.refresh()
      }
    })
  }

  return (
    <Contexto.Provider value={valor}>
      {children}
      {aberta && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:items-center sm:p-4" onClick={fechar}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={titulo(aberta.alvo)}
            className={`w-full ${largura} rounded-2xl border border-border-subtle bg-surface p-4 shadow-pop sm:max-h-[92vh] sm:overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
            onSubmitCapture={aoSubmeter}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-foreground">{titulo(aberta.alvo)}</h2>
              <button
                type="button"
                onClick={fechar}
                aria-label="Fechar"
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-foreground/[.08] hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {erro && <p className="mt-2 rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-700 dark:text-red-300">{erro}</p>}
            {aCarregar && !dados && <p className="mt-4 text-sm text-muted">A carregar…</p>}
            {dados && (
              <fieldset disabled={aGuardar} className={`min-w-0 ${aGuardar ? 'opacity-60' : ''}`}>
                {conteudo(dados, aberta.alvo)}
              </fieldset>
            )}
            {aGuardar && <p className="mt-2 text-xs text-muted">A guardar…</p>}
          </div>
        </div>
      )}
    </Contexto.Provider>
  )
}

// Envolve uma linha/cartão: botão direito do rato (ou tocar e manter, no
// telemóvel) abre a janela para editar esse registo.
export function AbrirComBotaoDireito({
  alvo,
  como: Elemento = 'div',
  className,
  title = 'Botão direito do rato: editar',
  children,
}: {
  alvo: string
  como?: 'div' | 'li' | 'span' | 'tr'
  className?: string
  title?: string
  children: React.ReactNode
}) {
  const { abrir } = useJanela()
  return (
    <Elemento
      className={className}
      title={title}
      onContextMenu={(e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        abrir(alvo)
      }}
    >
      {children}
    </Elemento>
  )
}

// Botão que abre a janela (para criar: sem alvo).
export function BotaoAbrirJanela({
  alvo = null,
  extra,
  className,
  title,
  children,
}: {
  alvo?: string | null
  extra?: Record<string, string>
  className?: string
  title?: string
  children: React.ReactNode
}) {
  const { abrir } = useJanela()
  return (
    <button type="button" onClick={() => abrir(alvo, extra)} className={className} title={title}>
      {children}
    </button>
  )
}

// ── Para formulários feitos no servidor ───────────────────────────────
// Quando o formulário de edição é montado pela própria página (com
// "?editar=<id>" no endereço), a página embrulha-o nesta janela: abre
// por cima da lista, e guardar/fechar tiram o "editar" do endereço sem
// mexer na posição da página.

export function JanelaServidor({
  titulo,
  fecharHref,
  guardar,
  largura = 'max-w-3xl',
  children,
}: {
  titulo: string
  // O endereço da página sem o "editar".
  fecharHref: string
  guardar: (formData: FormData) => Promise<ResultadoSemSair>
  largura?: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [aGuardar, iniciarGuarda] = useTransition()
  const fechar = useCallback(() => router.replace(fecharHref, { scroll: false }), [router, fecharHref])

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') fechar()
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [fechar])

  function aoSubmeter(e: React.FormEvent<HTMLDivElement>) {
    const form = e.target as HTMLFormElement
    if (!(form instanceof HTMLFormElement)) return
    e.preventDefault()
    e.stopPropagation()
    const botao = (e.nativeEvent as SubmitEvent).submitter
    const formData = botao instanceof HTMLElement ? new FormData(form, botao) : new FormData(form)
    setErro(null)
    iniciarGuarda(async () => {
      const r = await guardar(formData)
      if (r.erro) setErro(r.erro)
      else {
        router.replace(fecharHref, { scroll: false })
        router.refresh()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:items-center sm:p-4" onClick={fechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`w-full ${largura} rounded-2xl border border-border-subtle bg-surface p-4 shadow-pop sm:max-h-[92vh] sm:overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
        onSubmitCapture={aoSubmeter}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-foreground">{titulo}</h2>
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar"
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-foreground/[.08] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {erro && <p className="mt-2 rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-700 dark:text-red-300">{erro}</p>}
        <fieldset disabled={aGuardar} className={`min-w-0 ${aGuardar ? 'opacity-60' : ''}`}>
          {children}
        </fieldset>
        {aGuardar && <p className="mt-2 text-xs text-muted">A guardar…</p>}
      </div>
    </div>
  )
}

// Envolve uma linha: botão direito do rato (ou tocar e manter) vai para
// o endereço dado sem mexer na posição da página — para abrir a janela
// de edição de uma página que usa "?editar=<id>".
export function IrComBotaoDireito({
  href,
  como: Elemento = 'li',
  className,
  title = 'Botão direito do rato: editar',
  children,
}: {
  href: string
  como?: 'div' | 'li' | 'span' | 'tr'
  className?: string
  title?: string
  children: React.ReactNode
}) {
  const router = useRouter()
  return (
    <Elemento
      className={className}
      title={title}
      onContextMenu={(e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        router.push(href, { scroll: false })
      }}
    >
      {children}
    </Elemento>
  )
}
