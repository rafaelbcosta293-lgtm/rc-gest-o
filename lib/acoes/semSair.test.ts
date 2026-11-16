import { describe, expect, it } from 'vitest'
import { redirect } from 'next/navigation'
import { destinoDoRedirect, semSair } from './semSair'

// Estes testes usam o redirect() verdadeiro do Next: se uma versão nova
// mudar a forma como o redirect é assinalado, falham aqui (e não em
// silêncio, nas janelas de edição).
describe('semSair', () => {
  it('uma ação que corre bem e muda de página: sem erro, com o destino', async () => {
    const r = await semSair(async () => redirect('/painel/fatima/leads/abc'), new FormData())
    expect(r).toEqual({ erro: null, destino: '/painel/fatima/leads/abc' })
  })

  it('uma ação que volta com ?error=…: devolve a mensagem', async () => {
    const mensagem = 'O NIF 123 não é válido — corrige-o; ou deixa em branco.'
    const r = await semSair(async () => redirect(`/painel/fatima/leads/novo?error=${encodeURIComponent(mensagem)}`), new FormData())
    expect(r.erro).toBe(mensagem)
  })

  it('uma ação que acaba sem redirect: correu bem', async () => {
    expect(await semSair(async () => undefined, new FormData())).toEqual({ erro: null, destino: null })
  })

  it('um erro a sério não é engolido', async () => {
    await expect(semSair(async () => Promise.reject(new Error('falhou')), new FormData())).rejects.toThrow('falhou')
  })

  it('passa o formulário à ação', async () => {
    const fd = new FormData()
    fd.set('nome', 'Maria')
    let visto = ''
    await semSair(async (f) => {
      visto = String(f.get('nome'))
    }, fd)
    expect(visto).toBe('Maria')
  })
})

describe('destinoDoRedirect', () => {
  it('só reconhece redirects', () => {
    expect(destinoDoRedirect(new Error('x'))).toBeNull()
    expect(destinoDoRedirect(null)).toBeNull()
    expect(destinoDoRedirect({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' })).toBeNull()
  })
})
