// Check-in no tablet do estúdio (ver a migração 20261118010000_checkin_tablet.sql).
// A resposta da base de dados nunca traz nomes nem outros dados de
// clientes — só o resultado e a hora do treino/aula.

export type ResultadoCheckin =
  | { estado: 'ok'; tipo: 'treino' | 'aula'; hora: string; repetido: boolean }
  // Tem treino/aula agora, mas a mensalidade desse serviço não está em dia:
  // a presença não fica registada e pede-se, com simpatia, para regularizar.
  | { estado: 'sem_mensalidade'; tipo: 'treino' | 'aula'; hora: string }
  | { estado: 'recusado' | 'bloqueado' | 'posto_invalido' | 'erro' }

// Mensagem a mostrar no ecrã do tablet. A recusa é sempre a mesma,
// exista ou não o número — quem experimente números ao calhas não fica
// a saber nada.
export function mensagemCheckin(r: ResultadoCheckin): { tom: 'ok' | 'info' | 'aviso' | 'erro'; titulo: string; texto: string } {
  switch (r.estado) {
    case 'sem_mensalidade':
      return {
        tom: 'info',
        titulo: 'Falta só regularizar a mensalidade',
        texto: `Para registar a presença ${r.tipo === 'aula' ? 'na aula' : 'no treino'} das ${r.hora}, fale por favor com o seu treinador para regularizar a mensalidade. Obrigado!`,
      }
    case 'ok':
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

export function lerResultado(dados: unknown): ResultadoCheckin {
  const d = dados as Partial<{ estado: string; tipo: string; hora: string; repetido: boolean }> | null
  if (d?.estado === 'ok' && typeof d.hora === 'string') {
    return { estado: 'ok', tipo: d.tipo === 'aula' ? 'aula' : 'treino', hora: d.hora, repetido: !!d.repetido }
  }
  if (d?.estado === 'sem_mensalidade' && typeof d.hora === 'string') {
    return { estado: 'sem_mensalidade', tipo: d.tipo === 'aula' ? 'aula' : 'treino', hora: d.hora }
  }
  if (d?.estado === 'recusado' || d?.estado === 'bloqueado' || d?.estado === 'posto_invalido') return { estado: d.estado }
  return { estado: 'erro' }
}
