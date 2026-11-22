import { describe, expect, it } from 'vitest'
import { lerResultado, limparNumero, mensagemCheckin } from './checkin'

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
  it('mensalidade em falta: não regista e pede para aguardar pelo instrutor', () => {
    const r = lerResultado({ estado: 'sem_mensalidade', tipo: 'treino', hora: '09:00', expirou_em: '30/11/2026' })
    expect(r).toEqual({ estado: 'sem_mensalidade', tipo: 'treino', hora: '09:00', expirouEm: '30/11/2026' })
    const m = mensagemCheckin(r)
    expect(m.titulo).toBe('Não foi possível registar a sua presença')
    expect(m.texto).toBe('A sua mensalidade expirou a 30/11/2026. Aguarde aqui pelo seu instrutor para a regularizar.')
  })
  it('sem histórico de mensalidade', () => {
    const r = lerResultado({ estado: 'sem_mensalidade', tipo: 'aula', hora: '18:30', expirou_em: null })
    expect(mensagemCheckin(r).texto).toBe('Não encontrámos uma mensalidade ativa. Aguarde aqui pelo seu instrutor para a regularizar.')
  })
  it('a mensagem nunca tem dados do cliente e a recusa é sempre igual', () => {
    expect(mensagemCheckin({ estado: 'ok', tipo: 'aula', hora: '18:30', repetido: false }).texto).toBe('Aula das 18:30. Bom treino!')
    expect(mensagemCheckin({ estado: 'ok', tipo: 'treino', hora: '9:00', repetido: true }).titulo).toBe('Presença já estava registada')
    expect(mensagemCheckin({ estado: 'recusado' }).titulo).toBe('Não encontrámos um treino agora')
  })
})
