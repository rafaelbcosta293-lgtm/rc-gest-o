// Check-in no tablet do estúdio (ver as migrações 20261118010000_checkin_tablet.sql
// e 20261121010000_checkin_sem_mensalidade.sql). A resposta da base de
// dados nunca traz nomes nem outros dados de clientes — só o resultado, a
// hora do treino/aula e, se a mensalidade não estiver em dia, a data em que
// expirou, o valor e os meios de pagamento do estúdio (dados do negócio).

export type DadosPagamento = {
  mbway: string | null
  iban: string | null
  titular: string | null
  // Link de pagamento (ex.: o do banco ou de um serviço de pagamentos) —
  // o tablet mostra-o como QR code.
  link: string | null
  nota: string | null
}

export type ResultadoCheckin =
  | { estado: 'ok'; tipo: 'treino' | 'aula'; hora: string; repetido: boolean }
  // Tem treino/aula agora, mas a mensalidade desse serviço não está em dia:
  // a presença NÃO fica registada e o tablet leva logo ao pagamento.
  | {
      estado: 'sem_mensalidade'
      tipo: 'treino' | 'aula'
      hora: string
      expirouEm: string | null // DD/MM/AAAA
      valor: number | null
      pagamento: DadosPagamento | null
    }
  | { estado: 'recusado' | 'bloqueado' | 'posto_invalido' | 'erro' }

export const temDadosPagamento = (p: DadosPagamento | null | undefined): p is DadosPagamento =>
  !!p && !!(p.mbway || p.iban || p.link || p.nota)

export const formatarEuros = (v: number) =>
  v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(v) ? 0 : 2 })

// Mensagem a mostrar no ecrã do tablet. A recusa é sempre a mesma,
// exista ou não o número — quem experimente números ao calhas não fica
// a saber nada.
export function mensagemCheckin(r: ResultadoCheckin): { tom: 'ok' | 'info' | 'aviso' | 'erro'; titulo: string; texto: string } {
  switch (r.estado) {
    case 'ok':
      return {
        tom: 'ok',
        titulo: r.repetido ? 'Presença já estava registada' : 'Presença registada',
        texto: `${r.tipo === 'aula' ? 'Aula' : 'Treino'} das ${r.hora}. Bom treino!`,
      }
    case 'sem_mensalidade':
      return {
        tom: 'info',
        titulo: 'Não foi possível registar a presença',
        texto:
          (r.expirouEm ? `A sua mensalidade expirou a ${r.expirouEm}.` : 'Não encontrámos uma mensalidade ativa.') +
          (temDadosPagamento(r.pagamento)
            ? ' Pode regularizar já aqui — assim que estiver em dia, a presença passa a ficar registada.'
            : ' Assim que estiver regularizada, a presença passa a ficar registada. Obrigado!'),
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
// Só links https (o QR code nunca aponta para outra coisa).
const linkSeguro = (v: unknown) => {
  const t = texto(v)
  return t && /^https:\/\/\S+$/i.test(t) ? t : null
}

export function lerResultado(dados: unknown): ResultadoCheckin {
  const d = dados as Partial<{
    estado: string
    tipo: string
    hora: string
    repetido: boolean
    expirou_em: string | null
    valor: number | string | null
    pagamento: Record<string, unknown> | null
  }> | null
  const tipo = d?.tipo === 'aula' ? 'aula' : 'treino'
  if (d?.estado === 'ok' && typeof d.hora === 'string') {
    return { estado: 'ok', tipo, hora: d.hora, repetido: !!d.repetido }
  }
  if (d?.estado === 'sem_mensalidade' && typeof d.hora === 'string') {
    const p = d.pagamento
    const valor = d.valor == null ? null : Number(d.valor)
    return {
      estado: 'sem_mensalidade',
      tipo,
      hora: d.hora,
      expirouEm: texto(d.expirou_em),
      valor: valor != null && Number.isFinite(valor) && valor > 0 ? valor : null,
      pagamento: p ? { mbway: texto(p.mbway), iban: texto(p.iban), titular: texto(p.titular), link: linkSeguro(p.link), nota: texto(p.nota) } : null,
    }
  }
  if (d?.estado === 'recusado' || d?.estado === 'bloqueado' || d?.estado === 'posto_invalido') return { estado: d.estado }
  return { estado: 'erro' }
}
