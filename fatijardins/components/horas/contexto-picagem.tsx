"use client"

import { createContext, use, useLayoutEffect, useState, useSyncExternalStore, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { picarEntrada, picarSaida, type ResultadoPicagem } from "@/app/(app)/horas/acoes"
import type { DadosLocalizacao } from "@/lib/validacao/horas"

// ---------------------------------------------------------------------
// Preferência "Guardar a localização" (lembrada neste telemóvel)
// ---------------------------------------------------------------------

const CHAVE_LOCALIZACAO = "fatijardins:picagem:localizacao"
const ouvintes = new Set<() => void>()
/** Valor escolhido nesta visita (se o browser não deixar gravar no localStorage). */
let escolhaNestaVisita: boolean | null = null

function lerPreferencia(): boolean {
  if (escolhaNestaVisita !== null) return escolhaNestaVisita
  try {
    return window.localStorage.getItem(CHAVE_LOCALIZACAO) === "1"
  } catch {
    return false
  }
}

function gravarPreferencia(valor: boolean) {
  escolhaNestaVisita = valor
  try {
    window.localStorage.setItem(CHAVE_LOCALIZACAO, valor ? "1" : "0")
  } catch {
    // Modo privado ou armazenamento bloqueado: fica só para esta visita.
  }
  ouvintes.forEach((ouvinte) => ouvinte())
}

function subscreverPreferencia(aoMudar: () => void) {
  ouvintes.add(aoMudar)
  window.addEventListener("storage", aoMudar)
  return () => {
    ouvintes.delete(aoMudar)
    window.removeEventListener("storage", aoMudar)
  }
}

// ---------------------------------------------------------------------
// Localização do telemóvel
// ---------------------------------------------------------------------

type ResultadoPosicao =
  | { ok: true; posicao: { latitude: number; longitude: number } }
  | { ok: false; recusada: boolean }

/** 6 casas decimais (cerca de 10 cm), como a base de dados guarda. */
function arredondar(valor: number) {
  return Math.round(valor * 1e6) / 1e6
}

function obterPosicao(): Promise<ResultadoPosicao> {
  return new Promise((resolver) => {
    if (!("geolocation" in navigator)) {
      resolver({ ok: false, recusada: false })
      return
    }
    // Alguns browsers nunca respondem se a pessoa ignorar o pedido de autorização.
    const limite = window.setTimeout(() => resolver({ ok: false, recusada: false }), 10_000)
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        window.clearTimeout(limite)
        resolver({
          ok: true,
          posicao: { latitude: arredondar(posicao.coords.latitude), longitude: arredondar(posicao.coords.longitude) },
        })
      },
      (erro) => {
        window.clearTimeout(limite)
        resolver({ ok: false, recusada: erro.code === erro.PERMISSION_DENIED })
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
    )
  })
}

// ---------------------------------------------------------------------
// Contexto: o widget e os botões "Picar aqui" partilham o mesmo estado
// ---------------------------------------------------------------------

export type EtapaPicagem = "localizacao" | "gravar" | null

type ValorContexto = {
  aCorrer: boolean
  etapa: EtapaPicagem
  /** Aviso de uma saída esquecida fechada automaticamente. */
  aviso: string | null
  fecharAviso: () => void
  guardarLocalizacao: boolean
  mudarGuardarLocalizacao: (valor: boolean) => void
  /** Pica a entrada (ou muda de trabalho). null = sem trabalho. */
  entrar: (trabalhoId: string | null, aoConcluir?: () => void) => void
  sair: (aoConcluir?: () => void) => void
}

const ContextoPicagem = createContext<ValorContexto | null>(null)

export function usePicagem(): ValorContexto {
  const valor = use(ContextoPicagem)
  if (!valor) throw new Error("usePicagem tem de estar dentro de <ProvedorPicagem>.")
  return valor
}

export function ProvedorPicagem({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [aCorrer, iniciar] = useTransition()
  const [etapa, setEtapa] = useState<EtapaPicagem>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const guardarLocalizacao = useSyncExternalStore(subscreverPreferencia, lerPreferencia, () => false)

  // O Next.js guarda a página escondida ao navegar: ao voltar, sem avisos antigos.
  useLayoutEffect(() => {
    return () => setAviso(null)
  }, [])

  function executar(acao: (localizacao: DadosLocalizacao) => Promise<ResultadoPicagem>, aoConcluir?: () => void) {
    iniciar(async () => {
      let localizacao: DadosLocalizacao = { latitude: null, longitude: null }
      let semLocalizacao: string | null = null
      if (guardarLocalizacao) {
        setEtapa("localizacao")
        const resultado = await obterPosicao()
        if (resultado.ok) localizacao = resultado.posicao
        else
          semLocalizacao = resultado.recusada
            ? "A localização não foi autorizada: picou sem localização."
            : "Não foi possível obter a localização: picou sem localização."
      }

      setEtapa("gravar")
      let resultado: ResultadoPicagem
      try {
        resultado = await acao(localizacao)
      } catch {
        setEtapa(null)
        toast.error("Não foi possível comunicar com o servidor. Verifique a ligação à internet.")
        return
      }
      setEtapa(null)

      if (!resultado.ok) {
        toast.error(resultado.erro)
        // O estado pode ter mudado noutro telemóvel: mostrar o atual.
        router.refresh()
        return
      }
      toast.success(resultado.mensagem ?? "Picagem registada.")
      if (semLocalizacao) toast.warning(semLocalizacao)
      if (resultado.dados?.aviso) {
        setAviso(resultado.dados.aviso)
        toast.warning(resultado.dados.aviso, { duration: 15_000 })
      }
      aoConcluir?.()
    })
  }

  const valor: ValorContexto = {
    aCorrer,
    etapa,
    aviso,
    fecharAviso: () => setAviso(null),
    guardarLocalizacao,
    mudarGuardarLocalizacao: gravarPreferencia,
    entrar: (trabalhoId, aoConcluir) =>
      executar((localizacao) => picarEntrada({ trabalhoId, ...localizacao }), aoConcluir),
    sair: (aoConcluir) => executar((localizacao) => picarSaida(localizacao), aoConcluir),
  }

  return <ContextoPicagem value={valor}>{children}</ContextoPicagem>
}
