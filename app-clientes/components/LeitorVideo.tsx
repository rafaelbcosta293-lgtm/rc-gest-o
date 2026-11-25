'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from 'lucide-react'
import { enderecoDoLeitor, relogioDoVideo } from '@/lib/videos'

// O leitor das aulas virtuais. O vídeo está no YouTube (não listado), mas
// aqui toca por baixo de uma camada nossa, com os nossos botões: o cliente
// nunca chega ao título, ao logótipo nem ao menu do YouTube — que é por
// onde se copia a ligação para ver (ou passar a outros) fora da app.
// Não é um cofre: quem souber inspecionar a página encontra o vídeo. Serve
// para que deixar de pagar signifique, na prática, deixar de ver.

// O que usamos da API de leitores embutidos do YouTube.
type Leitor = {
  playVideo(): void
  pauseVideo(): void
  seekTo(segundos: number, permitirSaltar: boolean): void
  getCurrentTime(): number
  getDuration(): number
  getVideoLoadedFraction(): number
  mute(): void
  unMute(): void
  isMuted(): boolean
  destroy(): void
}
type ApiYoutube = {
  Player: new (
    iframe: HTMLIFrameElement,
    opcoes: { events: { onReady?: () => void; onStateChange?: (e: { data: number }) => void; onError?: (e: { data: number }) => void } },
  ) => Leitor
}
declare global {
  interface Window {
    YT?: Partial<ApiYoutube>
    onYouTubeIframeAPIReady?: () => void
  }
}

// Estados que o YouTube comunica.
const TERMINOU = 0
const A_TOCAR = 1
const EM_PAUSA = 2
const A_CARREGAR = 3

// Quanto se espera pelo YouTube antes de desistir dos nossos botões.
const ESPERA_API_MS = 10_000
const ESPERA_ARRANQUE_MS = 4_000
const ESCONDER_BOTOES_MS = 3_000
const SALTO_S = 10

let apiPedida: Promise<ApiYoutube> | null = null
function carregarApi(): Promise<ApiYoutube> {
  if (apiPedida) return apiPedida
  apiPedida = new Promise<ApiYoutube>((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT as ApiYoutube)
    const anterior = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      anterior?.()
      resolve(window.YT as ApiYoutube)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => {
      apiPedida = null
      reject(new Error('Não foi possível carregar o leitor do YouTube'))
    }
    document.head.appendChild(script)
  })
  return apiPedida
}

type Fase = 'capa' | 'a-abrir' | 'a-tocar' | 'pausa' | 'fim' | 'erro'

export default function LeitorVideo({ youtubeId, titulo, capa }: { youtubeId: string; titulo: string; capa: string }) {
  const caixaRef = useRef<HTMLDivElement>(null)
  const molduraRef = useRef<HTMLDivElement>(null)
  const barraRef = useRef<HTMLDivElement>(null)
  const leitorRef = useRef<Leitor | null>(null)
  const prontoRef = useRef(false)
  const comecouRef = useRef(false)
  const querTocarRef = useRef(false)
  const estadoRef = useRef(-1)
  const arranqueRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const esconderRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [fase, setFase] = useState<Fase>('capa')
  const [aEspera, setAEspera] = useState(false)
  // "Direto": os nossos botões não conseguiram pôr o vídeo a tocar (há
  // telemóveis que só deixam começar com um toque no próprio vídeo). Abre-
  // -se uma janela ao centro para esse toque; o resto continua tapado.
  const [direto, setDireto] = useState(false)
  const [tempo, setTempo] = useState(0)
  const [duracao, setDuracao] = useState(0)
  const [carregado, setCarregado] = useState(0)
  const [arrasto, setArrasto] = useState<number | null>(null)
  const [botoes, setBotoes] = useState(true)
  const [mudo, setMudo] = useState(false)
  const [inteiro, setInteiro] = useState(false)
  // Ecrã inteiro "à mão", para o iPhone (que não deixa pôr uma página em
  // ecrã inteiro): o leitor cobre a app e, com o telemóvel ao alto, deita-se.
  const [cobrir, setCobrir] = useState(false)
  const [aoAlto, setAoAlto] = useState(false)
  const deitado = cobrir && aoAlto
  const emGrande = inteiro || cobrir

  const agendarEsconder = useCallback(() => {
    if (esconderRef.current) clearTimeout(esconderRef.current)
    esconderRef.current = setTimeout(() => setBotoes(false), ESCONDER_BOTOES_MS)
  }, [])
  const acordar = useCallback(() => {
    setBotoes(true)
    agendarEsconder()
  }, [agendarEsconder])

  // Se, depois de pedir para tocar, o YouTube não arrancar, é porque quer
  // o toque no próprio vídeo.
  const vigiarArranque = useCallback(() => {
    if (arranqueRef.current) clearTimeout(arranqueRef.current)
    arranqueRef.current = setTimeout(() => {
      if (!comecouRef.current && estadoRef.current !== A_TOCAR && estadoRef.current !== A_CARREGAR) setDireto(true)
    }, ESPERA_ARRANQUE_MS)
  }, [])

  // O vídeo e a ligação ao YouTube. O iframe é criado aqui (e não no
  // HTML) para levar o endereço desta app, que o YouTube exige.
  useEffect(() => {
    const moldura = molduraRef.current
    if (!moldura) return
    let vivo = true
    let leitor: Leitor | null = null

    const iframe = document.createElement('iframe')
    iframe.src = enderecoDoLeitor(youtubeId, window.location.origin)
    iframe.title = titulo
    // O YouTube recusa tocar vídeos embutidos sem saber de que site vêm.
    iframe.referrerPolicy = 'strict-origin-when-cross-origin'
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture'
    iframe.tabIndex = -1
    iframe.style.cssText = 'width:100%;height:100%;border:0;display:block'
    moldura.appendChild(iframe)

    carregarApi()
      .then((YT) => {
        if (!vivo) return
        leitor = new YT.Player(iframe, {
          events: {
            onReady: () => {
              if (!vivo || !leitor) return
              leitorRef.current = leitor
              prontoRef.current = true
              setDuracao(leitor.getDuration() || 0)
              if (querTocarRef.current) {
                querTocarRef.current = false
                leitor.playVideo()
                vigiarArranque()
              }
            },
            onStateChange: ({ data }) => {
              if (!vivo) return
              estadoRef.current = data
              if (data === A_TOCAR) {
                comecouRef.current = true
                setDireto(false)
                setAEspera(false)
                setFase('a-tocar')
                agendarEsconder()
              } else if (data === EM_PAUSA) {
                if (comecouRef.current) {
                  setAEspera(false)
                  setFase('pausa')
                  setBotoes(true)
                }
              } else if (data === A_CARREGAR) {
                if (comecouRef.current) setAEspera(true)
              } else if (data === TERMINOU) {
                setAEspera(false)
                setFase('fim')
              }
            },
            onError: () => {
              if (vivo) setFase('erro')
            },
          },
        })
      })
      .catch(() => {
        if (vivo) setDireto(true)
      })

    const limite = setTimeout(() => {
      if (vivo && !prontoRef.current) setDireto(true)
    }, ESPERA_API_MS)

    return () => {
      vivo = false
      clearTimeout(limite)
      if (arranqueRef.current) clearTimeout(arranqueRef.current)
      if (esconderRef.current) clearTimeout(esconderRef.current)
      try {
        leitor?.destroy()
      } catch {
        // o iframe já não existe
      }
      moldura.replaceChildren()
      leitorRef.current = null
      prontoRef.current = false
      comecouRef.current = false
      estadoRef.current = -1
    }
  }, [youtubeId, titulo, agendarEsconder, vigiarArranque])

  // O relógio e a barra, enquanto o vídeo está aberto.
  const aberto = fase === 'a-tocar' || fase === 'pausa'
  useEffect(() => {
    if (!aberto) return
    const ler = () => {
      const l = leitorRef.current
      if (!l) return
      setTempo(l.getCurrentTime() || 0)
      setDuracao(l.getDuration() || 0)
      setCarregado(l.getVideoLoadedFraction() || 0)
    }
    ler()
    const relogio = setInterval(ler, 250)
    return () => clearInterval(relogio)
  }, [aberto])

  // Ecrã inteiro (o verdadeiro) e a posição do telemóvel.
  useEffect(() => {
    const mudou = () => {
      const el = document.fullscreenElement
      setInteiro(!!el && el === caixaRef.current)
      if (!el) screen.orientation?.unlock?.()
    }
    document.addEventListener('fullscreenchange', mudou)
    const alto = window.matchMedia('(orientation: portrait)')
    const virou = () => setAoAlto(alto.matches)
    virou()
    alto.addEventListener('change', virou)
    return () => {
      document.removeEventListener('fullscreenchange', mudou)
      alto.removeEventListener('change', virou)
    }
  }, [])

  // Com o leitor a cobrir a app, a página por baixo não se mexe.
  useEffect(() => {
    if (!cobrir) return
    const antes = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = antes
    }
  }, [cobrir])

  function tocar() {
    const l = leitorRef.current
    if (fase === 'capa' || fase === 'fim') setFase('a-abrir')
    if (!l || !prontoRef.current) {
      querTocarRef.current = true
      return
    }
    if (fase === 'fim') {
      comecouRef.current = false
      l.seekTo(0, true)
    }
    l.playVideo()
    if (!comecouRef.current) vigiarArranque()
  }

  function pausar() {
    leitorRef.current?.pauseVideo()
  }

  function alternar() {
    if (fase === 'a-tocar') pausar()
    else tocar()
  }

  function irPara(segundos: number) {
    const l = leitorRef.current
    if (!l || duracao <= 0) return
    const t = Math.min(Math.max(segundos, 0), Math.max(duracao - 0.5, 0))
    l.seekTo(t, true)
    setTempo(t)
    acordar()
  }

  function alternarSom() {
    const l = leitorRef.current
    if (!l) return
    if (mudo) l.unMute()
    else l.mute()
    setMudo(!mudo)
    acordar()
  }

  async function alternarEcra() {
    acordar()
    const caixa = caixaRef.current
    if (!caixa) return
    if (cobrir) return setCobrir(false)
    if (document.fullscreenElement) return void document.exitFullscreen()
    if (typeof caixa.requestFullscreen === 'function') {
      try {
        await caixa.requestFullscreen()
        // No telemóvel, o vídeo deita-se sozinho (onde o aparelho deixa).
        const orientacao = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
        orientacao?.lock?.('landscape').catch(() => {})
        return
      } catch {
        // sem ecrã inteiro a sério: cobre-se a app
      }
    }
    setCobrir(true)
  }

  // Em que ponto da barra está o dedo (com o leitor deitado, a barra
  // corre de cima para baixo no ecrã).
  function pontoDaBarra(e: React.PointerEvent): number {
    const r = barraRef.current!.getBoundingClientRect()
    const f = deitado ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width
    return Math.min(Math.max(f, 0), 1)
  }

  function teclas(e: React.KeyboardEvent) {
    if (fase === 'erro' || direto) return
    if (e.key === ' ' || e.key === 'k') alternar()
    else if (e.key === 'ArrowLeft') irPara(tempo - SALTO_S)
    else if (e.key === 'ArrowRight') irPara(tempo + SALTO_S)
    else if (e.key === 'f') void alternarEcra()
    else if (e.key === 'm') alternarSom()
    else if (e.key === 'Escape' && cobrir) setCobrir(false)
    else return
    e.preventDefault()
  }

  function toqueNoVideo(e: React.MouseEvent) {
    // Com rato, clicar no vídeo pára/continua; com o dedo, mostra ou
    // esconde os botões.
    const rato = (e.nativeEvent as PointerEvent).pointerType === 'mouse'
    if (rato || fase === 'pausa') return alternar()
    if (botoes) {
      setBotoes(false)
      if (esconderRef.current) clearTimeout(esconderRef.current)
    } else acordar()
  }

  const posicao = arrasto ?? (duracao > 0 ? tempo / duracao : 0)
  const mostrarBotoes = aberto && (botoes || fase === 'pausa' || arrasto !== null)
  const redondo =
    'flex items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition active:scale-95 focus-visible:outline-2 focus-visible:outline-white'

  return (
    <div className="relative aspect-video bg-black">
      <div
        ref={caixaRef}
        tabIndex={0}
        role="group"
        aria-label={`Vídeo: ${titulo}`}
        onKeyDown={teclas}
        onContextMenu={(e) => e.preventDefault()}
        onMouseMove={fase === 'a-tocar' ? acordar : undefined}
        className={`overflow-hidden bg-black outline-none select-none ${cobrir ? 'fixed z-[100] touch-none' : 'absolute inset-0'}`}
        style={
          cobrir
            ? deitado
              ? { top: '50%', left: '50%', width: '100dvh', height: '100dvw', transform: 'translate(-50%, -50%) rotate(90deg)' }
              : { inset: 0 }
            : undefined
        }
      >
        {/* O vídeo do YouTube: por baixo de tudo, e sem receber toques. */}
        <div ref={molduraRef} className={`absolute inset-0 ${direto ? '' : 'pointer-events-none'}`} />

        {direto ? (
          // Só o centro do vídeo recebe o toque; o título e o logótipo do
          // YouTube (em cima e em baixo) continuam fora de alcance.
          <>
            <div className="absolute inset-x-0 top-0 h-[30%]" />
            <div className="absolute inset-x-0 bottom-0 flex h-[30%] items-end justify-center pb-3">
              <span className="rounded-full bg-black/75 px-3.5 py-1.5 text-sm font-semibold text-white">Toque no centro do vídeo para começar</span>
            </div>
            <div className="absolute top-[30%] bottom-[30%] left-0 w-[22%]" />
            <div className="absolute top-[30%] right-0 bottom-[30%] w-[22%]" />
          </>
        ) : fase === 'erro' ? (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 px-6 text-center">
            <p className="text-sm leading-snug text-zinc-200">
              Não foi possível abrir este vídeo.
              <br />
              Tente daqui a pouco ou fale connosco no estúdio.
            </p>
          </div>
        ) : fase === 'capa' || fase === 'a-abrir' || fase === 'fim' ? (
          // Antes de começar e no fim: a nossa capa (tapa o ecrã inicial e
          // as sugestões do YouTube).
          <button type="button" onClick={tocar} disabled={fase === 'a-abrir'} aria-label={fase === 'fim' ? 'Ver de novo' : 'Ver a aula'} className="absolute inset-0 block bg-zinc-900">
            {/* eslint-disable-next-line @next/next/no-img-element -- capa servida pela app */}
            <img src={capa} alt="" draggable={false} className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-black shadow-lg">
                {fase === 'a-abrir' ? (
                  <Loader2 className="h-7 w-7 animate-spin" />
                ) : fase === 'fim' ? (
                  <RotateCcw className="h-7 w-7" />
                ) : (
                  <Play className="h-7 w-7 translate-x-0.5 fill-current" />
                )}
              </span>
              {fase === 'fim' && <span className="text-sm font-semibold text-white">Ver de novo</span>}
            </span>
          </button>
        ) : (
          <div
            onClick={toqueNoVideo}
            className={`absolute inset-0 transition-colors duration-200 ${mostrarBotoes ? 'bg-black/35' : 'bg-transparent'} ${mostrarBotoes || aEspera ? '' : 'cursor-none'}`}
          >
            {aEspera && !mostrarBotoes && (
              <span className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-9 w-9 animate-spin text-white" />
              </span>
            )}

            {mostrarBotoes && (
              <>
                {/* A fila do meio não tapa o vídeo: só os três botões recebem toques. */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-7 *:pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => irPara(tempo - SALTO_S)} aria-label={`Recuar ${SALTO_S} segundos`} className={`${redondo} relative h-11 w-11`}>
                    <RotateCcw className="h-6 w-6" />
                    <span className="absolute text-[0.5rem] font-bold">{SALTO_S}</span>
                  </button>
                  <button type="button" onClick={alternar} aria-label={fase === 'a-tocar' ? 'Pausa' : 'Continuar'} className={`${redondo} h-16 w-16`}>
                    {aEspera ? (
                      <Loader2 className="h-7 w-7 animate-spin" />
                    ) : fase === 'a-tocar' ? (
                      <Pause className="h-7 w-7 fill-current" />
                    ) : (
                      <Play className="h-7 w-7 translate-x-0.5 fill-current" />
                    )}
                  </button>
                  <button type="button" onClick={() => irPara(tempo + SALTO_S)} aria-label={`Avançar ${SALTO_S} segundos`} className={`${redondo} relative h-11 w-11`}>
                    <RotateCw className="h-6 w-6" />
                    <span className="absolute text-[0.5rem] font-bold">{SALTO_S}</span>
                  </button>
                </div>

                <div
                  // Deitado no iPhone, as pontas da barra ficam junto ao entalhe e à
                  // barra de início: afastam-se para dentro.
                  className={`absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent pt-6 ${deitado ? 'px-14 pb-4' : emGrande ? 'px-6 pb-4' : 'px-3 pb-1'}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="w-10 shrink-0 text-center text-xs font-semibold text-white tabular-nums">{relogioDoVideo(arrasto !== null ? arrasto * duracao : tempo)}</span>
                  <div
                    ref={barraRef}
                    role="slider"
                    tabIndex={0}
                    aria-label="Posição no vídeo"
                    aria-valuemin={0}
                    aria-valuemax={Math.round(duracao)}
                    aria-valuenow={Math.round(tempo)}
                    aria-valuetext={`${relogioDoVideo(tempo)} de ${relogioDoVideo(duracao)}`}
                    onPointerDown={(e) => {
                      if (duracao <= 0) return
                      e.currentTarget.setPointerCapture(e.pointerId)
                      setArrasto(pontoDaBarra(e))
                    }}
                    onPointerMove={(e) => {
                      if (arrasto !== null) setArrasto(pontoDaBarra(e))
                    }}
                    onPointerUp={() => {
                      if (arrasto === null) return
                      irPara(arrasto * duracao)
                      setArrasto(null)
                    }}
                    onPointerCancel={() => setArrasto(null)}
                    className="relative h-9 min-w-0 flex-1 cursor-pointer touch-none focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/30">
                      <span className="absolute inset-y-0 left-0 bg-white/40" style={{ width: `${carregado * 100}%` }} />
                      <span className="absolute inset-y-0 left-0 bg-brand" style={{ width: `${posicao * 100}%` }} />
                    </span>
                    <span
                      className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand shadow transition-[width,height] ${arrasto !== null ? 'h-5 w-5' : 'h-3.5 w-3.5'}`}
                      style={{ left: `${posicao * 100}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-center text-xs font-semibold text-white tabular-nums">{relogioDoVideo(duracao)}</span>
                  <button type="button" onClick={alternarSom} aria-label={mudo ? 'Ligar o som' : 'Tirar o som'} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white active:bg-white/15">
                    {mudo ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </button>
                  <button type="button" onClick={() => void alternarEcra()} aria-label={emGrande ? 'Sair do ecrã inteiro' : 'Ecrã inteiro'} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white active:bg-white/15">
                    {emGrande ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
