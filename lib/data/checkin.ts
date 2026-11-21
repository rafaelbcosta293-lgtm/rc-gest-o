// Check-in no tablet do estúdio (ver as migrações 20261118010000_checkin_tablet.sql
// e 20261121010000_checkin_sem_mensalidade.sql). A resposta da base de
// dados nunca traz nomes nem outros dados de clientes — só o resultado, a
// hora do treino/aula e, se a mensalidade não estiver em dia, os meios de
// pagamento do estúdio (dados do negócio).

export type DadosPagamento = { mbway: string | null; iban: string | null; titular: string | null; nota: string | null }

export type ResultadoCheckin =
  | {
      estado: 'ok'
      tipo: 'treino' | 'aula'
      hora: string
      repetido: boolean
      // A presença ficou registada, mas a mensalidade desse serviço não está
      // em dia: mostra-se uma mensagem simpática e os meios de pagamento.
      mensalidadeEmFalta?: boolean
      pagamento?: DadosPagamento | null
    }
  | { estado: 'recusado' | 'bloqueado' | 'posto_invalido' | 'erro' }

export const temDadosPagamento = (p: DadosPagamento | null | undefined): p is DadosPagamento =>
  !!p && !!(p.mbway || p.iban || p.nota)

// Mensagem a mostrar no ecrã do tablet. A recusa é sempre a mesma,
// exista ou não o número — quem experimente números ao calhas não fica
// a saber nada.
export function mensagemCheckin(r: ResultadoCheckin): { tom: 'ok' | 'info' | 'aviso' | 'erro'; titulo: string; texto: string } {
  switch (r.estado) {
    case 'ok':
      if (r.mensalidadeEmFalta) {
        return {
          tom: 'info',
          titulo: 'Presença registada · ' + (r.tipo === 'aula' ? 'aula' : 'treino') + ' das ' + r.hora,
          texto: temDadosPagamento(r.pagamento)
            ? 'A sua mensalidade ainda não está regularizada. Pode tratar já disso — mostramos a seguir as formas de pagamento. Obrigado!'
            : 'A sua mensalidade ainda não está regularizada. Pedimos que a regularize pelos meios habituais. Obrigado!',
        }
      }
      return {
        tom: 'ok',
        titulo: r.repetido ? 'Presença já estava registada' : 'Presença registada',
        texto: `${r.tipo === 'aula' ? 'Aula' : 'Treino'} das ${r.hora}. Bom treino!`,
      }
    case 'recusado':
      return { tom: 'aviso', titulo: 'Não encontrámos um treino agora', texto: 'Confirme o número ou fale com o seu treinador.' }
    case 'bloqueado':
      return { tom: 'erro', titulo: 'Demasiadas tentativas', texto: 'Aguarde 1 minuto e tente de novo.' }
    case 'posto_invalido':
      return { tom: 'erro', titulo: 'Tablet não autorizado', texto: 'Peça ajuda à equipa.' }
    default:
      return { tom: 'erro', titulo: 'Sem ligação', texto: 'Tente de novo ou fale com o seu treinador.' }
  }
}

// Só algarismos, no máximo 10 (o resto do número — a letra do estúdio —
// é ignorado pela base de dados).
export function limparNumero(texto: string): string {
  return texto.replace(/\D/g, '').slice(0, 10)
}

const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

export function lerResultado(dados: unknown): ResultadoCheckin {
  const d = dados as Partial<{
    estado: string
    tipo: string
    hora: string
    repetido: boolean
    mensalidade_em_falta: boolean
    pagamento: Record<string, unknown> | null
  }> | null
  if (d?.estado === 'ok' && typeof d.hora === 'string') {
    const r: ResultadoCheckin = { estado: 'ok', tipo: d.tipo === 'aula' ? 'aula' : 'treino', hora: d.hora, repetido: !!d.repetido }
    if (d.mensalidade_em_falta) {
      r.mensalidadeEmFalta = true
      const p = d.pagamento
      r.pagamento = p ? { mbway: texto(p.mbway), iban: texto(p.iban), titular: texto(p.titular), nota: texto(p.nota) } : null
    }
    return r
  }
  if (d?.estado === 'recusado' || d?.estado === 'bloqueado' || d?.estado === 'posto_invalido') return { estado: d.estado }
  return { estado: 'erro' }
}
