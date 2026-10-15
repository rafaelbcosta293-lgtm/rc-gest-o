"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import type { ResultadoAcao } from "@/lib/acoes"
import { comprimirImagem, type ImagemComprimida } from "@/lib/fotos"
import { createClient } from "@/lib/supabase/client"
import { BUCKET_FOTOS } from "@/lib/trabalhos"
import { mensagemErroEnvio, novoUuid, SEM_REDE, semRede } from "./envio-storage"

export type EstadoEnvio = "em_espera" | "a_comprimir" | "a_enviar" | "feito" | "erro"

/** Foto já guardada no Storage, pronta a registar. */
export type FicheiroEnviado = { caminho: string; largura: number; altura: number; tamanho: number }

export type Envio<D> = {
  id: string
  ficheiro: File
  /** Dados próprios de cada foto (ex.: o momento antes/depois). */
  dados: D
  estado: EstadoEnvio
  erro?: string
  /** O ficheiro já está no Storage: ao tentar de novo só falta registá-lo. */
  enviado?: FicheiroEnviado
}

const MAXIMO_POR_ENVIO = 20

/** Erro com mensagem já pronta a mostrar. */
class ErroEnvio extends Error {}

type Opcoes<D> = {
  /** Caminho no Storage de um ficheiro novo (na pasta do trabalho ou da visita). */
  caminhoNovo: (ficheiro: string) => string
  /** Regista no servidor a foto já enviada (Server Action). */
  registar: (enviado: FicheiroEnviado, dados: D) => Promise<ResultadoAcao>
  /** Para as mensagens de erro: "este trabalho", "esta visita"… */
  destino: string
}

/**
 * Fila de envio de fotos: comprimir no telemóvel, enviar direto para o
 * Storage e registar no servidor, uma de cada vez (poupa memória e rede).
 */
export function useEnvioFotos<D>({ caminhoNovo, registar, destino }: Opcoes<D>) {
  const [envios, setEnvios] = useState<Envio<D>[]>([])
  const cadeia = useRef<Promise<void>>(Promise.resolve())

  // Avisar antes de fechar o separador com fotos a meio do envio.
  const aEnviar = envios.some((envio) => envio.estado !== "feito" && envio.estado !== "erro")
  useEffect(() => {
    if (!aEnviar) return
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault()
    window.addEventListener("beforeunload", avisar)
    return () => window.removeEventListener("beforeunload", avisar)
  }, [aEnviar])

  function atualizar(id: string, alteracoes: Partial<Envio<D>>) {
    setEnvios((lista) => lista.map((envio) => (envio.id === id ? { ...envio, ...alteracoes } : envio)))
  }

  function remover(id: string) {
    setEnvios((lista) => lista.filter((envio) => envio.id !== id))
  }

  async function processar(envio: Envio<D>) {
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
        const caminho = caminhoNovo(`${novoUuid()}.jpg`)
        const { error } = await supabase.storage
          .from(BUCKET_FOTOS)
          .upload(caminho, imagem.blob, { contentType: "image/jpeg", cacheControl: "3600", upsert: false })
        if (error) throw new ErroEnvio(mensagemErroEnvio(error, destino))
        enviado = { caminho, largura: imagem.largura, altura: imagem.altura, tamanho: imagem.blob.size }
        atualizar(envio.id, { enviado })
      } else {
        atualizar(envio.id, { estado: "a_enviar", erro: undefined })
      }

      let resultado: ResultadoAcao
      try {
        resultado = await registar(enviado, envio.dados)
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
  function agendar(envio: Envio<D>) {
    cadeia.current = cadeia.current.then(() => processar(envio))
  }

  function adicionar(ficheiros: File[], dados: D) {
    if (ficheiros.length > MAXIMO_POR_ENVIO) {
      toast.warning(`Pode enviar até ${MAXIMO_POR_ENVIO} fotos de cada vez. Vão ser enviadas as primeiras ${MAXIMO_POR_ENVIO}.`)
    }
    const novos: Envio<D>[] = ficheiros
      .slice(0, MAXIMO_POR_ENVIO)
      .map((ficheiro) => ({ id: novoUuid(), ficheiro, dados, estado: "em_espera" }))
    setEnvios((lista) => [...lista, ...novos])
    novos.forEach(agendar)
  }

  function tentarDeNovo(envio: Envio<D>) {
    const novo: Envio<D> = { ...envio, estado: "em_espera", erro: undefined }
    atualizar(envio.id, { estado: "em_espera", erro: undefined })
    agendar(novo)
  }

  return { envios, adicionar, tentarDeNovo, remover }
}
