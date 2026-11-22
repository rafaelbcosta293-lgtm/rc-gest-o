import { describe, expect, it } from 'vitest'
import { formatarEuros, lerResultado, limparNumero, mensagemCheckin, temDadosPagamento } from './checkin'

describe('check-in no tablet', () => {
  it('só guarda algarismos', () => {
    expect(limparNumero('F 26-345')).toBe('26345')
    expect(limparNumero('123456789012')).toBe('1234567890')
  })
  it('lê a resposta da base de dados sem aceitar lixo', () => {
    expect(lerResultado({ estado: 'ok', tipo: 'treino', hora: '10:00', repetido: false })).toEqual({ estado: 'ok', tipo: 'treino', hora: '10:00', repetido: false })
    expect(lerResultado({ estado: 'recusado' })).toEqual({ estado: 'recusado' })
    expect(lerResultado(null)).toEqual({ estado: 'erro' })
    expect(lerResultado({ estado: 'outro' })).toEqual({ estado: 'erro' })
  })
  it('mensalidade em falta: não regista e leva ao pagamento', () => {
    const r = lerResultado({
      estado: 'sem_mensalidade',
      tipo: 'treino',
      hora: '09:00',
      expirou_em: '30/11/2026',
      valor: '110.00',
      pagamento: { mbway: ' 912 345 678 ', iban: '', titular: null, link: 'https://pagar.exemplo.pt/rc', nota: null },
    })
    expect(r).toEqual({
      estado: 'sem_mensalidade',
      tipo: 'treino',
      hora: '09:00',
      expirouEm: '30/11/2026',
      valor: 110,
      pagamento: { mbway: '912 345 678', iban: null, titular: null, link: 'https://pagar.exemplo.pt/rc', nota: null },
    })
    const m = mensagemCheckin(r)
    expect(m.titulo).toBe('Não foi possível registar a presença')
    expect(m.texto).toContain('expirou a 30/11/2026')
    expect(m.texto).not.toContain('treinador')
  })
  it('o QR code só aceita links https', () => {
    const r = lerResultado({ estado: 'sem_mensalidade', hora: '09:00', pagamento: { link: 'javascript:alert(1)' } })
    expect(r.estado === 'sem_mensalidade' && r.pagamento?.link).toBeNull()
  })
  it('sem histórico de mensalidade e sem meios de pagamento definidos', () => {
    const r = lerResultado({ estado: 'sem_mensalidade', tipo: 'aula', hora: '18:30', expirou_em: null, valor: null, pagamento: null })
    expect(mensagemCheckin(r).texto).toBe('Não encontrámos uma mensalidade ativa. Assim que estiver regularizada, a presença passa a ficar registada. Obrigado!')
    expect(temDadosPagamento({ mbway: null, iban: null, titular: 'RC', link: null, nota: null })).toBe(false)
  })
  it('valores em euros', () => {
    expect(formatarEuros(110).replace(/\s/g, ' ')).toBe('110 €')
    expect(formatarEuros(69.5).replace(/\s/g, ' ')).toBe('69,50 €')
  })
  it('a mensagem nunca tem dados do cliente e a recusa é sempre igual', () => {
    expect(mensagemCheckin({ estado: 'ok', tipo: 'aula', hora: '18:30', repetido: false }).texto).toBe('Aula das 18:30. Bom treino!')
    expect(mensagemCheckin({ estado: 'ok', tipo: 'treino', hora: '9:00', repetido: true }).titulo).toBe('Presença já estava registada')
    expect(mensagemCheckin({ estado: 'recusado' }).titulo).toBe('Não encontrámos um treino agora')
  })
})
