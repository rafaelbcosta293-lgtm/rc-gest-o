import { describe, expect, it } from 'vitest'
import { lerResultado, limparNumero, mensagemCheckin, temDadosPagamento } from './checkin'

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
  it('mensalidade em falta: presença registada, com os meios de pagamento do estúdio', () => {
    const r = lerResultado({
      estado: 'ok',
      tipo: 'treino',
      hora: '09:00',
      repetido: false,
      mensalidade_em_falta: true,
      pagamento: { mbway: ' 912 345 678 ', iban: '', titular: null, nota: 'Indique o nº de cliente' },
    })
    expect(r).toEqual({
      estado: 'ok',
      tipo: 'treino',
      hora: '09:00',
      repetido: false,
      mensalidadeEmFalta: true,
      pagamento: { mbway: '912 345 678', iban: null, titular: null, nota: 'Indique o nº de cliente' },
    })
    const m = mensagemCheckin(r)
    expect(m.tom).toBe('info')
    expect(m.titulo).toContain('Presença registada')
    expect(m.texto).toContain('formas de pagamento')
    expect(m.texto).not.toContain('treinador')
  })
  it('sem meios de pagamento definidos não promete mostrá-los', () => {
    expect(temDadosPagamento({ mbway: null, iban: null, titular: 'RC', nota: null })).toBe(false)
    const m = mensagemCheckin({ estado: 'ok', tipo: 'aula', hora: '18:30', repetido: false, mensalidadeEmFalta: true, pagamento: null })
    expect(m.texto).toContain('meios habituais')
  })
  it('a mensagem nunca tem dados do cliente e a recusa é sempre igual', () => {
    expect(mensagemCheckin({ estado: 'ok', tipo: 'aula', hora: '18:30', repetido: false }).texto).toBe('Aula das 18:30. Bom treino!')
    expect(mensagemCheckin({ estado: 'ok', tipo: 'treino', hora: '9:00', repetido: true }).titulo).toBe('Presença já estava registada')
    expect(mensagemCheckin({ estado: 'recusado' }).titulo).toBe('Não encontrámos um treino agora')
  })
})
