/** Envios para o Storage na ficha do trabalho (as funções comuns estão em components/fotos). */

import { mensagemErroEnvio as mensagemErroEnvioComum, type ErroStorage } from "@/components/fotos/envio-storage"

export { novoUuid, SEM_REDE, semRede } from "@/components/fotos/envio-storage"

/** Traduz um erro do upload para o Storage. */
export function mensagemErroEnvio(erro: ErroStorage): string {
  return mensagemErroEnvioComum(erro, "este trabalho")
}
