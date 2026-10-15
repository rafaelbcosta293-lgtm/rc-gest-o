"use client"

import { useLayoutEffect, useRef, useState, useTransition } from "react"
import { CameraIcon, ImagesIcon, LoaderCircleIcon, SaveIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { Confirmar } from "@/app/(app)/trabalhos/[id]/_componentes/confirmar"
import { LinhaEnvio } from "@/components/fotos/linha-envio"
import { MiniaturaFoto } from "@/components/fotos/miniatura-foto"
import { AvisoSemRede } from "@/components/fotos/sem-rede"
import { useEnvioFotos } from "@/components/fotos/use-envio-fotos"
import { useUrlsFotos } from "@/components/fotos/use-urls-fotos"
import { VerFoto } from "@/components/fotos/ver-foto"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ResultadoAcao } from "@/lib/acoes"
import { caminhoFicheiroVisita } from "@/lib/visitas"
import { apagarFotoVisita, guardarLegendaFoto, registarFotoVisita } from "../../acoes"

export type FotoVisita = {
  id: string
  /** URL assinado (válido 1 hora), gerado no servidor; null se não foi possível. */
  url: string | null
  largura: number | null
  altura: number | null
  legenda: string | null
  autor: string | null
  /** Data e hora já formatadas. */
  quando: string
}

/**
 * Fotos da visita: tirar com a câmara ou escolher do PC/galeria, comprimir
 * no browser, enviar direto para o Storage e registar; legenda e apagar.
 */
export function FotosVisita({
  visitaId,
  fotos: fotosServidor,
  urlsGeradosEm,
}: {
  visitaId: string
  fotos: FotoVisita[]
  /** Quando o servidor gerou os URLs (ms). */
  urlsGeradosEm: number
}) {
  const fotos = useUrlsFotos(fotosServidor, urlsGeradosEm)
  const { envios, adicionar, tentarDeNovo, remover } = useEnvioFotos<null>({
    caminhoNovo: (ficheiro) => caminhoFicheiroVisita(visitaId, ficheiro),
    registar: (enviado) => registarFotoVisita(visitaId, enviado),
    destino: "esta visita",
  })

  const [aberta, setAberta] = useState<string | null>(null)
  const inputCamara = useRef<HTMLInputElement>(null)
  const inputGaleria = useRef<HTMLInputElement>(null)

  // A página fica guardada escondida ao navegar: fechar a foto aberta.
  useLayoutEffect(() => () => setAberta(null), [])

  function escolher(evento: React.ChangeEvent<HTMLInputElement>) {
    const ficheiros = Array.from(evento.target.files ?? [])
    // Permite voltar a escolher o mesmo ficheiro.
    evento.target.value = ""
    if (ficheiros.length > 0) adicionar(ficheiros, null)
  }

  const indiceAberta = fotos.findIndex((foto) => foto.id === aberta)
  const fotoAberta = indiceAberta >= 0 ? fotos[indiceAberta] : null

  return (
    <div className="grid gap-5">
      <AvisoSemRede />

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Button type="button" size="lg" onClick={() => inputCamara.current?.click()}>
          <CameraIcon />
          Tirar foto
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={() => inputGaleria.current?.click()}>
          <ImagesIcon />
          Escolher fotos
        </Button>
      </div>
      <input
        ref={inputCamara}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-label="Tirar foto"
        onChange={escolher}
      />
      <input
        ref={inputGaleria}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label="Escolher fotos"
        onChange={escolher}
      />

      {envios.length > 0 && (
        <ul className="grid gap-2" aria-label="Fotos a enviar" aria-live="polite">
          {envios.map((envio) => (
            <LinhaEnvio
              key={envio.id}
              envio={envio}
              rotulo="Foto"
              aoTentarDeNovo={() => tentarDeNovo(envio)}
              aoDescartar={() => remover(envio.id)}
            />
          ))}
        </ul>
      )}

      {fotos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ainda não há fotos desta visita.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-4 lg:grid-cols-6" aria-label="Fotos da visita">
          {fotos.map((foto, indice) => (
            <li key={foto.id} className="grid content-start gap-1">
              <MiniaturaFoto
                url={foto.url}
                rotulo={`Ver em grande: foto ${indice + 1}${foto.legenda ? ` (${foto.legenda})` : ""}`}
                aoAbrir={() => setAberta(foto.id)}
              />
              {foto.legenda && (
                <p className="line-clamp-2 text-xs break-words text-muted-foreground">{foto.legenda}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Ver em grande, com a legenda. */}
      <VerFoto
        foto={
          fotoAberta && {
            url: fotoAberta.url,
            largura: fotoAberta.largura,
            altura: fotoAberta.altura,
            titulo: `Foto ${indiceAberta + 1} de ${fotos.length}`,
            descricao: `${fotoAberta.autor ? `${fotoAberta.autor} · ` : ""}${fotoAberta.quando}`,
            alt: fotoAberta.legenda ?? "Foto da visita",
          }
        }
        aoFechar={() => setAberta(null)}
        aoAnterior={indiceAberta > 0 ? () => setAberta(fotos[indiceAberta - 1].id) : null}
        aoSeguinte={
          indiceAberta >= 0 && indiceAberta < fotos.length - 1 ? () => setAberta(fotos[indiceAberta + 1].id) : null
        }
        acoes={
          fotoAberta && (
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
              acao={() => apagarFotoVisita(visitaId, fotoAberta.id)}
              aoConcluir={() => setAberta(null)}
            />
          )
        }
      >
        {fotoAberta && (
          // A chave volta a pôr no campo a legenda gravada (ou a da foto seguinte).
          <Legenda
            key={`${fotoAberta.id}|${fotoAberta.legenda ?? ""}`}
            visitaId={visitaId}
            fotoId={fotoAberta.id}
            legenda={fotoAberta.legenda}
          />
        )}
      </VerFoto>
    </div>
  )
}

/** Legenda da foto (ex.: "canteiro junto ao muro"), guardada ao carregar em Guardar. */
function Legenda({ visitaId, fotoId, legenda }: { visitaId: string; fotoId: string; legenda: string | null }) {
  const [texto, setTexto] = useState(legenda ?? "")
  const [aGuardar, iniciar] = useTransition()
  const alterada = texto.trim() !== (legenda ?? "")

  function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    iniciar(async () => {
      let resultado: ResultadoAcao
      try {
        resultado = await guardarLegendaFoto(visitaId, fotoId, texto)
      } catch {
        toast.error("Não foi possível comunicar com o servidor. Verifique a ligação à internet.")
        return
      }
      if (resultado.ok) toast.success(resultado.mensagem ?? "Guardado.")
      else toast.error(resultado.erro)
    })
  }

  return (
    <form onSubmit={guardar} className="flex gap-2">
      <Input
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        maxLength={200}
        autoComplete="off"
        enterKeyHint="done"
        placeholder="Legenda (ex.: canteiro junto ao muro)"
        aria-label="Legenda da foto"
        className="h-12 md:h-12"
      />
      <Button type="submit" size="lg" variant="secondary" disabled={!alterada || aGuardar}>
        {aGuardar ? <LoaderCircleIcon className="animate-spin" /> : <SaveIcon />}
        Guardar
      </Button>
    </form>
  )
}
