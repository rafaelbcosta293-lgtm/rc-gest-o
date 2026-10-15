"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { CameraIcon, ImagesIcon, Trash2Icon } from "lucide-react"

import { LinhaEnvio } from "@/components/fotos/linha-envio"
import { MiniaturaFoto } from "@/components/fotos/miniatura-foto"
import { AvisoSemRede } from "@/components/fotos/sem-rede"
import { useEnvioFotos } from "@/components/fotos/use-envio-fotos"
import { useUrlsFotos } from "@/components/fotos/use-urls-fotos"
import { VerFoto } from "@/components/fotos/ver-foto"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { caminhoFicheiroTrabalho, NOMES_MOMENTO_FOTO, type MomentoFoto } from "@/lib/trabalhos"
import { apagarFoto, registarFoto } from "../acoes"
import { Confirmar } from "./confirmar"

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

const MOMENTOS: MomentoFoto[] = ["antes", "depois", "outra"]
const TITULOS_GRUPO: Record<MomentoFoto, string> = { antes: "Antes", depois: "Depois", outra: "Outras" }

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
  const fotos = useUrlsFotos(fotosServidor, urlsGeradosEm)
  const { envios, adicionar, tentarDeNovo, remover } = useEnvioFotos<MomentoFoto>({
    caminhoNovo: (ficheiro) => caminhoFicheiroTrabalho(trabalhoId, ficheiro),
    registar: (enviado, momento) => registarFoto(trabalhoId, { ...enviado, momento }),
    destino: "este trabalho",
  })

  const [pendentes, setPendentes] = useState<File[] | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)
  const inputAntes = useRef<HTMLInputElement>(null)
  const inputDepois = useRef<HTMLInputElement>(null)
  const inputGaleria = useRef<HTMLInputElement>(null)

  // A página fica guardada escondida ao navegar: fechar as janelas abertas.
  useLayoutEffect(
    () => () => {
      setPendentes(null)
      setAberta(null)
    },
    []
  )

  function escolher(evento: React.ChangeEvent<HTMLInputElement>, momento: MomentoFoto | null) {
    const ficheiros = Array.from(evento.target.files ?? [])
    // Permite voltar a escolher o mesmo ficheiro.
    evento.target.value = ""
    if (ficheiros.length === 0) return
    if (momento) adicionar(ficheiros, momento)
    else setPendentes(ficheiros)
  }

  const ordenadas = MOMENTOS.flatMap((momento) => fotos.filter((foto) => foto.momento === momento))
  const indiceAberta = ordenadas.findIndex((foto) => foto.id === aberta)
  const fotoAberta = indiceAberta >= 0 ? ordenadas[indiceAberta] : null

  return (
    <div className="grid gap-5">
      <AvisoSemRede />

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
              rotulo={`Foto ${NOMES_MOMENTO_FOTO[envio.dados].toLowerCase()}`}
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
                    <MiniaturaFoto
                      url={foto.url}
                      rotulo={`Ver em grande: ${TITULOS_GRUPO[momento].toLowerCase()} ${indice + 1}`}
                      aoAbrir={() => setAberta(foto.id)}
                    />
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
      <VerFoto
        foto={
          fotoAberta && {
            url: fotoAberta.url,
            largura: fotoAberta.largura,
            altura: fotoAberta.altura,
            titulo: `${NOMES_MOMENTO_FOTO[fotoAberta.momento]} · ${indiceAberta + 1} de ${ordenadas.length}`,
            descricao: `${fotoAberta.autor ? `${fotoAberta.autor} · ` : ""}${fotoAberta.quando}`,
            alt: `Foto ${NOMES_MOMENTO_FOTO[fotoAberta.momento].toLowerCase()} do trabalho`,
          }
        }
        aoFechar={() => setAberta(null)}
        aoAnterior={indiceAberta > 0 ? () => setAberta(ordenadas[indiceAberta - 1].id) : null}
        aoSeguinte={
          indiceAberta >= 0 && indiceAberta < ordenadas.length - 1
            ? () => setAberta(ordenadas[indiceAberta + 1].id)
            : null
        }
        acoes={
          fotoAberta?.podeApagar && (
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
          )
        }
      />
    </div>
  )
}
