"use client"

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import {
  CameraIcon,
  CircleCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  ClockIcon,
  ImageIcon,
  ImagesIcon,
  LoaderCircleIcon,
  RotateCwIcon,
  Trash2Icon,
  WifiOffIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ResultadoAcao } from "@/lib/acoes"
import { comprimirImagem, type ImagemComprimida } from "@/lib/fotos"
import { createClient } from "@/lib/supabase/client"
import { BUCKET_FOTOS, caminhoFicheiroTrabalho, NOMES_MOMENTO_FOTO, type MomentoFoto } from "@/lib/trabalhos"
import { cn } from "@/lib/utils"
import { apagarFoto, registarFoto } from "../acoes"
import { Confirmar } from "./confirmar"
import { mensagemErroEnvio, novoUuid, SEM_REDE, semRede } from "./envio-storage"

export type FotoGaleria = {
  id: string
  momento: MomentoFoto
  /** URL assinado (válido 1 hora), gerado no servidor; null se não foi possível. */
  url: string | null
  largura: number | null
  altura: number | null
  autor: string | null
  /** Data e hora já formatadas. */
  quando: string
  podeApagar: boolean
}

type EstadoEnvio = "em_espera" | "a_comprimir" | "a_enviar" | "feito" | "erro"

type Envio = {
  id: string
  ficheiro: File
  momento: MomentoFoto
  estado: EstadoEnvio
  erro?: string
  /** O ficheiro já está no Storage: ao tentar de novo só falta registá-lo. */
  enviado?: { caminho: string; largura: number; altura: number; tamanho: number }
}

const MAXIMO_POR_ENVIO = 20
const MOMENTOS: MomentoFoto[] = ["antes", "depois", "outra"]
const TITULOS_GRUPO: Record<MomentoFoto, string> = { antes: "Antes", depois: "Depois", outra: "Outras" }
const TEXTO_ESTADO: Record<Exclude<EstadoEnvio, "erro">, string> = {
  em_espera: "À espera…",
  a_comprimir: "A comprimir…",
  a_enviar: "A enviar…",
  feito: "Enviada.",
}

/** Os URLs valem 1 hora: o mesmo URL é reutilizado durante 30 minutos. */
const REUTILIZAR_URL_MS = 30 * 60 * 1000

type UrlGuardado = { url: string | null; geradoEm: number }

/**
 * Cada atualização da página (depois de qualquer ação) traz URLs assinados
 * novos para as mesmas fotos; mantendo o URL anterior enquanto é válido, o
 * browser usa a cópia em cache e não volta a descarregar as fotos.
 */
function juntarUrls(
  anteriores: Record<string, UrlGuardado>,
  fotos: FotoGaleria[],
  geradoEm: number
): Record<string, UrlGuardado> {
  const resultado: Record<string, UrlGuardado> = {}
  for (const foto of fotos) {
    const anterior = anteriores[foto.id]
    resultado[foto.id] =
      anterior?.url && geradoEm - anterior.geradoEm < REUTILIZAR_URL_MS ? anterior : { url: foto.url, geradoEm }
  }
  return resultado
}

/** Erro com mensagem já pronta a mostrar. */
class ErroEnvio extends Error {}

function subscreverRede(aviso: () => void) {
  window.addEventListener("online", aviso)
  window.addEventListener("offline", aviso)
  return () => {
    window.removeEventListener("online", aviso)
    window.removeEventListener("offline", aviso)
  }
}

/** true quando o browser está sem rede. */
function useSemRede() {
  return useSyncExternalStore(subscreverRede, () => !navigator.onLine, () => false)
}

/**
 * Fotos do trabalho: tirar/escolher, comprimir no telemóvel, enviar direto
 * para o Storage e registar; galeria Antes / Depois / Outras.
 */
export function Fotos({
  trabalhoId,
  fotos: fotosServidor,
  urlsGeradosEm,
}: {
  trabalhoId: string
  fotos: FotoGaleria[]
  /** Quando o servidor gerou os URLs (ms). */
  urlsGeradosEm: number
}) {
  const [urls, setUrls] = useState(() => juntarUrls({}, fotosServidor, urlsGeradosEm))
  const [fotosAnteriores, setFotosAnteriores] = useState(fotosServidor)
  if (fotosAnteriores !== fotosServidor) {
    setFotosAnteriores(fotosServidor)
    setUrls(juntarUrls(urls, fotosServidor, urlsGeradosEm))
  }
  const fotos = fotosServidor.map((foto) => ({ ...foto, url: urls[foto.id]?.url ?? foto.url }))

  const [envios, setEnvios] = useState<Envio[]>([])
  const [pendentes, setPendentes] = useState<File[] | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)
  const cadeia = useRef<Promise<void>>(Promise.resolve())
  const inputAntes = useRef<HTMLInputElement>(null)
  const inputDepois = useRef<HTMLInputElement>(null)
  const inputGaleria = useRef<HTMLInputElement>(null)
  const offline = useSemRede()

  // A página fica guardada escondida ao navegar: fechar as janelas abertas.
  useLayoutEffect(
    () => () => {
      setPendentes(null)
      setAberta(null)
    },
    []
  )

  // Avisar antes de fechar o separador com fotos a meio do envio.
  const aEnviar = envios.some((envio) => envio.estado !== "feito" && envio.estado !== "erro")
  useEffect(() => {
    if (!aEnviar) return
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault()
    window.addEventListener("beforeunload", avisar)
    return () => window.removeEventListener("beforeunload", avisar)
  }, [aEnviar])

  function atualizar(id: string, alteracoes: Partial<Envio>) {
    setEnvios((lista) => lista.map((envio) => (envio.id === id ? { ...envio, ...alteracoes } : envio)))
  }

  function remover(id: string) {
    setEnvios((lista) => lista.filter((envio) => envio.id !== id))
  }

  async function processar(envio: Envio) {
    const supabase = createClient()
    let enviado = envio.enviado
    try {
      if (!enviado) {
        if (semRede()) throw new ErroEnvio(SEM_REDE)
        if (envio.ficheiro.type && !envio.ficheiro.type.startsWith("image/")) {
          throw new ErroEnvio("Este ficheiro não é uma imagem.")
        }
        atualizar(envio.id, { estado: "a_comprimir", erro: undefined })
        let imagem: ImagemComprimida
        try {
          imagem = await comprimirImagem(envio.ficheiro)
        } catch {
          throw new ErroEnvio("Não foi possível abrir esta imagem. Experimente outra foto (JPEG ou PNG).")
        }

        atualizar(envio.id, { estado: "a_enviar" })
        const caminho = caminhoFicheiroTrabalho(trabalhoId, `${novoUuid()}.jpg`)
        const { error } = await supabase.storage
          .from(BUCKET_FOTOS)
          .upload(caminho, imagem.blob, { contentType: "image/jpeg", cacheControl: "3600", upsert: false })
        if (error) throw new ErroEnvio(mensagemErroEnvio(error))
        enviado = { caminho, largura: imagem.largura, altura: imagem.altura, tamanho: imagem.blob.size }
        atualizar(envio.id, { enviado })
      } else {
        atualizar(envio.id, { estado: "a_enviar", erro: undefined })
      }

      let resultado: ResultadoAcao
      try {
        resultado = await registarFoto(trabalhoId, { ...enviado, momento: envio.momento })
      } catch {
        // Sem resposta do servidor: o ficheiro fica no Storage e "Tentar de novo" só o regista.
        throw new ErroEnvio(SEM_REDE)
      }
      if (!resultado.ok) {
        // A foto não ficou registada: não deixar o ficheiro perdido no Storage.
        await supabase.storage.from(BUCKET_FOTOS).remove([enviado.caminho])
        atualizar(envio.id, { enviado: undefined })
        throw new ErroEnvio(resultado.erro)
      }

      atualizar(envio.id, { estado: "feito" })
      window.setTimeout(() => remover(envio.id), 3000)
    } catch (erro) {
      atualizar(envio.id, {
        estado: "erro",
        erro: erro instanceof ErroEnvio ? erro.message : "Ocorreu um erro inesperado. Tente de novo.",
      })
    }
  }

  /** Uma foto de cada vez (poupa memória no telemóvel e a rede). */
  function agendar(envio: Envio) {
    cadeia.current = cadeia.current.then(() => processar(envio))
  }

  function adicionar(ficheiros: File[], momento: MomentoFoto) {
    if (ficheiros.length > MAXIMO_POR_ENVIO) {
      toast.warning(`Pode enviar até ${MAXIMO_POR_ENVIO} fotos de cada vez. Vão ser enviadas as primeiras ${MAXIMO_POR_ENVIO}.`)
    }
    const novos: Envio[] = ficheiros
      .slice(0, MAXIMO_POR_ENVIO)
      .map((ficheiro) => ({ id: novoUuid(), ficheiro, momento, estado: "em_espera" }))
    setEnvios((lista) => [...lista, ...novos])
    novos.forEach(agendar)
  }

  function escolher(evento: React.ChangeEvent<HTMLInputElement>, momento: MomentoFoto | null) {
    const ficheiros = Array.from(evento.target.files ?? [])
    // Permite voltar a escolher o mesmo ficheiro.
    evento.target.value = ""
    if (ficheiros.length === 0) return
    if (momento) adicionar(ficheiros, momento)
    else setPendentes(ficheiros)
  }

  function tentarDeNovo(envio: Envio) {
    const novo: Envio = { ...envio, estado: "em_espera", erro: undefined }
    atualizar(envio.id, { estado: "em_espera", erro: undefined })
    agendar(novo)
  }

  const ordenadas = MOMENTOS.flatMap((momento) => fotos.filter((foto) => foto.momento === momento))
  const indiceAberta = ordenadas.findIndex((foto) => foto.id === aberta)
  const fotoAberta = indiceAberta >= 0 ? ordenadas[indiceAberta] : null

  return (
    <div className="grid gap-5">
      {offline && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <WifiOffIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Sem rede. Pode tirar as fotos, mas só são enviadas quando houver ligação (use “Tentar de novo”).
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Button type="button" size="lg" onClick={() => inputAntes.current?.click()}>
          <CameraIcon />
          Foto antes
        </Button>
        <Button type="button" size="lg" onClick={() => inputDepois.current?.click()}>
          <CameraIcon />
          Foto depois
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="col-span-2"
          onClick={() => inputGaleria.current?.click()}
        >
          <ImagesIcon />
          Escolher da galeria
        </Button>
      </div>
      <input
        ref={inputAntes}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-label="Tirar foto antes"
        data-momento="antes"
        onChange={(evento) => escolher(evento, "antes")}
      />
      <input
        ref={inputDepois}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-label="Tirar foto depois"
        data-momento="depois"
        onChange={(evento) => escolher(evento, "depois")}
      />
      <input
        ref={inputGaleria}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label="Escolher fotos da galeria"
        data-momento="galeria"
        onChange={(evento) => escolher(evento, null)}
      />

      {envios.length > 0 && (
        <ul className="grid gap-2" aria-label="Fotos a enviar" aria-live="polite">
          {envios.map((envio) => (
            <LinhaEnvio
              key={envio.id}
              envio={envio}
              aoTentarDeNovo={() => tentarDeNovo(envio)}
              aoDescartar={() => remover(envio.id)}
            />
          ))}
        </ul>
      )}

      {fotos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ainda não há fotos deste trabalho.</p>
      ) : (
        MOMENTOS.map((momento) => {
          const grupo = fotos.filter((foto) => foto.momento === momento)
          if (grupo.length === 0) return null
          return (
            <div key={momento} className="grid gap-2">
              <h3 className="text-sm font-semibold">
                {TITULOS_GRUPO[momento]} <span className="font-normal text-muted-foreground">({grupo.length})</span>
              </h3>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {grupo.map((foto, indice) => (
                  <li key={foto.id}>
                    <button
                      type="button"
                      onClick={() => setAberta(foto.id)}
                      className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      aria-label={`Ver em grande: ${TITULOS_GRUPO[momento].toLowerCase()} ${indice + 1}`}
                    >
                      {foto.url ? (
                        // URLs assinados do Storage (privados e temporários): sem otimização do next/image.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={foto.url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                      ) : (
                        <ImageIcon className="size-6 text-muted-foreground" aria-hidden="true" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })
      )}

      {/* Escolher da galeria: perguntar o momento. */}
      <Dialog open={pendentes !== null} onOpenChange={(abrir) => !abrir && setPendentes(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendentes?.length === 1 ? "Esta foto é de quando?" : `Estas ${pendentes?.length ?? 0} fotos são de quando?`}
            </DialogTitle>
            <DialogDescription>Escolha o momento para as arrumar na galeria.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {MOMENTOS.map((momento) => (
              <Button
                key={momento}
                type="button"
                size="lg"
                variant={momento === "outra" ? "outline" : "default"}
                onClick={() => {
                  if (pendentes) adicionar(pendentes, momento)
                  setPendentes(null)
                }}
              >
                {momento === "outra" ? "Outra" : `${NOMES_MOMENTO_FOTO[momento]} do trabalho`}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Ver em grande. */}
      <Dialog open={fotoAberta !== null} onOpenChange={(abrir) => !abrir && setAberta(null)}>
        <DialogContent className="max-w-[calc(100%-1rem)] gap-3 p-3 sm:max-w-3xl sm:p-4">
          {fotoAberta && (
            <>
              <DialogHeader className="pr-10 text-left">
                <DialogTitle>
                  {NOMES_MOMENTO_FOTO[fotoAberta.momento]} · {indiceAberta + 1} de {ordenadas.length}
                </DialogTitle>
                <DialogDescription>
                  {fotoAberta.autor ? `${fotoAberta.autor} · ` : ""}
                  {fotoAberta.quando}
                </DialogDescription>
              </DialogHeader>
              <div className="flex min-h-40 items-center justify-center overflow-hidden rounded-md bg-black">
                {fotoAberta.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fotoAberta.url}
                    alt={`Foto ${NOMES_MOMENTO_FOTO[fotoAberta.momento].toLowerCase()} do trabalho`}
                    width={fotoAberta.largura ?? undefined}
                    height={fotoAberta.altura ?? undefined}
                    className="h-auto max-h-[65dvh] w-auto max-w-full object-contain"
                  />
                ) : (
                  <p className="p-6 text-sm text-white/80">Não foi possível carregar a foto.</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  aria-label="Foto anterior"
                  disabled={indiceAberta <= 0}
                  onClick={() => setAberta(ordenadas[indiceAberta - 1]?.id ?? null)}
                >
                  <ChevronLeftIcon className="size-5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  aria-label="Foto seguinte"
                  disabled={indiceAberta >= ordenadas.length - 1}
                  onClick={() => setAberta(ordenadas[indiceAberta + 1]?.id ?? null)}
                >
                  <ChevronRightIcon className="size-5" />
                </Button>
                {fotoAberta.podeApagar && (
                  <Confirmar
                    gatilho={
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="ml-auto text-destructive hover:text-destructive"
                      >
                        <Trash2Icon />
                        Apagar foto
                      </Button>
                    }
                    titulo="Apagar esta foto?"
                    descricao="A foto é apagada definitivamente."
                    confirmar="Apagar"
                    acao={() => apagarFoto(trabalhoId, fotoAberta.id)}
                    aoConcluir={() => setAberta(null)}
                  />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LinhaEnvio({
  envio,
  aoTentarDeNovo,
  aoDescartar,
}: {
  envio: Envio
  aoTentarDeNovo: () => void
  aoDescartar: () => void
}) {
  const Icone =
    envio.estado === "feito"
      ? CircleCheckIcon
      : envio.estado === "erro"
        ? CircleAlertIcon
        : envio.estado === "em_espera"
          ? ClockIcon
          : LoaderCircleIcon

  return (
    <li className="grid gap-2 rounded-lg border p-3">
      <div className="flex items-start gap-3">
        <Icone
          aria-hidden="true"
          className={cn(
            "mt-0.5 size-5 shrink-0",
            envio.estado === "feito" && "text-primary",
            envio.estado === "erro" && "text-destructive",
            (envio.estado === "a_comprimir" || envio.estado === "a_enviar") && "animate-spin text-muted-foreground",
            envio.estado === "em_espera" && "text-muted-foreground"
          )}
        />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">
            Foto {NOMES_MOMENTO_FOTO[envio.momento].toLowerCase()}
            <span className="font-normal text-muted-foreground">
              {" "}
              · {(envio.ficheiro.size / (1024 * 1024)).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} MB
            </span>
          </p>
          <p className={envio.estado === "erro" ? "text-destructive" : "text-muted-foreground"}>
            {envio.estado === "erro" ? envio.erro : TEXTO_ESTADO[envio.estado]}
          </p>
        </div>
      </div>
      {envio.estado === "erro" && (
        <div className="flex gap-2">
          <Button type="button" size="lg" variant="outline" className="flex-1" onClick={aoTentarDeNovo}>
            <RotateCwIcon />
            Tentar de novo
          </Button>
          <Button type="button" size="icon-lg" variant="ghost" aria-label="Descartar esta foto" onClick={aoDescartar}>
            <XIcon className="size-5" />
          </Button>
        </div>
      )}
    </li>
  )
}
