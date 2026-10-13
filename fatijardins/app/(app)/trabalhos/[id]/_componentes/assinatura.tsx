"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { EraserIcon, LoaderCircleIcon, PenLineIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import type { ResultadoAcao } from "@/lib/acoes"
import { createClient } from "@/lib/supabase/client"
import { BUCKET_FOTOS, caminhoFicheiroTrabalho } from "@/lib/trabalhos"
import { esquemaAssinatura, type CamposAssinatura, type DadosAssinatura } from "@/lib/validacao/registos"
import { apagarAssinatura, guardarAssinatura } from "../acoes"
import { Confirmar } from "./confirmar"
import { mensagemErroEnvio, novoUuid, SEM_REDE, semRede } from "./envio-storage"

export type AssinaturaGuardada = {
  /** URL assinado (válido 1 hora); null se não foi possível. */
  url: string | null
  nome: string | null
  /** Data e hora já formatadas. */
  quando: string
}

type Props = {
  trabalhoId: string
  assinatura: AssinaturaGuardada | null
  /** Gerente ou chefe de equipa: pode apagar a assinatura. */
  podeApagar: boolean
}

/** Assinatura do cliente (opcional): desenhada no ecrã e guardada como imagem. */
export function Assinatura({ trabalhoId, assinatura, podeApagar }: Props) {
  if (assinatura) {
    return (
      <div className="grid gap-3">
        <div className="flex h-40 items-center justify-center overflow-hidden rounded-lg border bg-white">
          {assinatura.url ? (
            // URL assinado do Storage (privado e temporário): sem otimização do next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={assinatura.url}
              alt={assinatura.nome ? `Assinatura de ${assinatura.nome}` : "Assinatura do cliente"}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <p className="text-sm text-neutral-600">Não foi possível carregar a imagem da assinatura.</p>
          )}
        </div>
        <p className="text-sm">
          Assinado por <span className="font-medium">{assinatura.nome ?? "—"}</span>
          <span className="text-muted-foreground"> em {assinatura.quando}</span>
        </p>
        {podeApagar && (
          <Confirmar
            gatilho={
              <Button variant="outline" size="lg" className="text-destructive hover:text-destructive sm:w-fit">
                <Trash2Icon />
                Apagar assinatura
              </Button>
            }
            titulo="Apagar a assinatura?"
            descricao="A assinatura do cliente é apagada definitivamente. Pode pedir uma nova."
            confirmar="Apagar"
            acao={() => apagarAssinatura(trabalhoId)}
          />
        )}
      </div>
    )
  }

  return <QuadroAssinatura trabalhoId={trabalhoId} />
}

type Ponto = { x: number; y: number }

const COR_TRACO = "#111827"
const ESPESSURA_TRACO = 2.5

function prepararPincel(contexto: CanvasRenderingContext2D) {
  contexto.strokeStyle = COR_TRACO
  contexto.fillStyle = COR_TRACO
  contexto.lineWidth = ESPESSURA_TRACO
  contexto.lineCap = "round"
  contexto.lineJoin = "round"
}

function desenharSegmento(contexto: CanvasRenderingContext2D, de: Ponto, ate: Ponto) {
  contexto.beginPath()
  contexto.moveTo(de.x, de.y)
  contexto.lineTo(ate.x, ate.y)
  contexto.stroke()
}

function desenharPonto(contexto: CanvasRenderingContext2D, ponto: Ponto) {
  contexto.beginPath()
  contexto.arc(ponto.x, ponto.y, ESPESSURA_TRACO / 2, 0, Math.PI * 2)
  contexto.fill()
}

function QuadroAssinatura({ trabalhoId }: { trabalhoId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Traços em coordenadas do ecrã (px CSS), para redesenhar quando o quadro muda de tamanho.
  const tracos = useRef<Ponto[][]>([])
  const tracoAtual = useRef<Ponto[] | null>(null)
  const [temTracos, setTemTracos] = useState(false)
  const [semAssinatura, setSemAssinatura] = useState(false)
  const [aGuardar, setAGuardar] = useState(false)

  const form = useForm<CamposAssinatura, unknown, DadosAssinatura>({
    resolver: zodResolver(esquemaAssinatura),
    defaultValues: { nome: "" },
  })

  const contexto = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return null
    // Escala para a densidade do ecrã: desenha-se em px CSS e fica nítido.
    const escala = canvas.width / Math.max(1, canvas.getBoundingClientRect().width)
    ctx.setTransform(escala, 0, 0, escala, 0, 0)
    prepararPincel(ctx)
    return ctx
  }, [])

  const redesenhar = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = contexto()
    if (!canvas || !ctx) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    for (const traco of tracos.current) {
      if (traco.length === 1) desenharPonto(ctx, traco[0])
      for (let i = 1; i < traco.length; i++) desenharSegmento(ctx, traco[i - 1], traco[i])
    }
  }, [contexto])

  // Resolução do canvas = tamanho no ecrã × densidade de pixels (nítido no telemóvel).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ajustar = () => {
      const { width, height } = canvas.getBoundingClientRect()
      if (width === 0 || height === 0) return
      const densidade = window.devicePixelRatio || 1
      const largura = Math.round(width * densidade)
      const altura = Math.round(height * densidade)
      if (canvas.width !== largura || canvas.height !== altura) {
        canvas.width = largura
        canvas.height = altura
      }
      redesenhar()
    }
    ajustar()
    const observador = new ResizeObserver(ajustar)
    observador.observe(canvas)
    return () => observador.disconnect()
  }, [redesenhar])

  function pontoDoEvento(evento: { clientX: number; clientY: number }): Ponto {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: evento.clientX - rect.left, y: evento.clientY - rect.top }
  }

  function aoPousar(evento: React.PointerEvent<HTMLCanvasElement>) {
    if (evento.pointerType === "mouse" && evento.button !== 0) return
    evento.preventDefault()
    evento.currentTarget.setPointerCapture(evento.pointerId)
    const ponto = pontoDoEvento(evento)
    tracoAtual.current = [ponto]
    tracos.current.push(tracoAtual.current)
    const ctx = contexto()
    if (ctx) desenharPonto(ctx, ponto)
    setTemTracos(true)
    setSemAssinatura(false)
  }

  function aoMover(evento: React.PointerEvent<HTMLCanvasElement>) {
    const traco = tracoAtual.current
    if (!traco) return
    evento.preventDefault()
    const ctx = contexto()
    if (!ctx) return
    // Eventos intermédios (mais pontos = traço mais suave em telemóveis rápidos).
    const eventos = evento.nativeEvent.getCoalescedEvents?.() ?? []
    for (const e of eventos.length > 0 ? eventos : [evento.nativeEvent]) {
      const ponto = pontoDoEvento(e)
      desenharSegmento(ctx, traco[traco.length - 1], ponto)
      traco.push(ponto)
    }
  }

  function aoLevantar() {
    tracoAtual.current = null
  }

  function limpar() {
    tracos.current = []
    tracoAtual.current = null
    setTemTracos(false)
    redesenhar()
  }

  async function enviarAssinatura({ nome }: DadosAssinatura) {
    const canvas = canvasRef.current
    if (!temTracos || !canvas) {
      setSemAssinatura(true)
      return
    }
    if (semRede()) {
      toast.error(SEM_REDE)
      return
    }

    setAGuardar(true)
    try {
      const imagem = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
      if (!imagem) {
        toast.error("Não foi possível criar a imagem da assinatura.")
        return
      }
      const supabase = createClient()
      const caminho = caminhoFicheiroTrabalho(trabalhoId, `assinatura-${novoUuid()}.png`)
      const { error } = await supabase.storage
        .from(BUCKET_FOTOS)
        .upload(caminho, imagem, { contentType: "image/png", cacheControl: "3600", upsert: false })
      if (error) {
        toast.error(mensagemErroEnvio(error))
        return
      }

      let resultado: ResultadoAcao
      try {
        resultado = await guardarAssinatura(trabalhoId, caminho, nome)
      } catch {
        toast.error(SEM_REDE)
        return
      }
      if (!resultado.ok) {
        // Não ficou registada: apagar o ficheiro enviado.
        await supabase.storage.from(BUCKET_FOTOS).remove([caminho])
        for (const [campo, mensagens] of Object.entries(resultado.campos ?? {})) {
          if (campo === "nome" && mensagens?.[0]) form.setError("nome", { message: mensagens[0] })
        }
        toast.error(resultado.erro)
        return
      }

      toast.success(resultado.mensagem ?? "Assinatura guardada.")
      tracos.current = []
      setTemTracos(false)
      form.reset()
    } finally {
      setAGuardar(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={(evento) => form.handleSubmit(enviarAssinatura)(evento)} className="grid gap-4" noValidate>
        <div className="grid gap-2">
          <div className="flex items-end justify-between gap-2">
            <p id="instrucoes-assinatura" className="text-sm text-muted-foreground">
              Peça ao cliente para assinar com o dedo no quadro branco.
            </p>
            <Button
              type="button"
              size="lg"
              variant="ghost"
              className="shrink-0"
              onClick={limpar}
              disabled={aGuardar || !temTracos}
            >
              <EraserIcon />
              Limpar
            </Button>
          </div>
          <div className="relative">
            <canvas
              ref={canvasRef}
              role="img"
              aria-label="Quadro para a assinatura do cliente"
              aria-describedby="instrucoes-assinatura"
              className="block h-48 w-full cursor-crosshair touch-none rounded-lg border-2 border-dashed border-input bg-white select-none"
              onPointerDown={aoPousar}
              onPointerMove={aoMover}
              onPointerUp={aoLevantar}
              onPointerCancel={aoLevantar}
              onLostPointerCapture={aoLevantar}
            />
            {!temTracos && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-400">
                Assine aqui
              </span>
            )}
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-neutral-300" />
          </div>
          {semAssinatura && <p className="text-sm text-destructive">Peça ao cliente para assinar no quadro.</p>}
        </div>

        <FormField
          control={form.control}
          name="nome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome de quem assina *</FormLabel>
              <FormControl>
                <Input autoComplete="off" autoCapitalize="words" placeholder="Ex.: Maria Silva" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid sm:flex">
          <Button type="submit" size="lg" disabled={aGuardar}>
            {aGuardar ? <LoaderCircleIcon className="animate-spin" /> : <PenLineIcon />}
            {aGuardar ? "A guardar…" : "Guardar assinatura"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
