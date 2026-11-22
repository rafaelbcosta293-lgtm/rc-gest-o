import { randomInt } from 'node:crypto'

// Código de ativação enviado por SMS (sem letras/números que se
// confundem: I, O, 0, 1).
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function gerarCodigo(tamanho = 8): string {
  let s = ''
  for (let i = 0; i < tamanho; i++) s += ALFABETO[randomInt(ALFABETO.length)]
  return s
}

export const DIAS_CONVITE = 7

export function linkAtivacao(base: string, numero: string, codigo: string): string {
  return `${base}/ativar?n=${encodeURIComponent(numero)}&c=${encodeURIComponent(codigo)}`
}

export function mensagemConvite(nome: string, numero: string, link: string, reenvio: boolean): string {
  return (
    `Olá ${nome}! ${reenvio ? 'Aqui está um novo acesso à' : 'A sua conta na'} app do RC Private Fitness Studio${reenvio ? '' : ' está pronta'}: ` +
    `marque e desmarque aulas, veja os seus treinos, presenças e avaliações.\n\n` +
    `Para ${reenvio ? 'definir uma nova' : 'ativar e escolher a sua'} password, abra (válido ${DIAS_CONVITE} dias):\n${link}\n\n` +
    `Para entrar use o seu nº de cliente: ${numero}.\n\nA equipa RC Private Fitness Studio`
  )
}
