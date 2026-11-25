import { criarSupabase } from '@/lib/supabase'

// A capa de uma aula em vídeo, servida pela própria app: assim o endereço
// da imagem não mostra qual é o vídeo no YouTube. Só chega aqui quem tem o
// serviço (as regras da base de dados não devolvem a aula aos outros).
// Com "?grande" vai a imagem em tamanho de ecrã (para o leitor).
const TAMANHOS_GRANDES = ['maxresdefault', 'sddefault', 'mqdefault']
const TAMANHOS_PEQUENOS = ['mqdefault']

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 })

  const supabase = await criarSupabase()
  const { data } = await supabase.from('aulas_virtuais').select('youtube_id').eq('id', id).maybeSingle()
  if (!data?.youtube_id) return new Response(null, { status: 404 })

  const tamanhos = new URL(request.url).searchParams.has('grande') ? TAMANHOS_GRANDES : TAMANHOS_PEQUENOS
  for (const tamanho of tamanhos) {
    const imagem = await fetch(`https://i.ytimg.com/vi/${data.youtube_id}/${tamanho}.jpg`).catch(() => null)
    if (!imagem?.ok || !imagem.body) continue
    return new Response(imagem.body, {
      headers: {
        'Content-Type': imagem.headers.get('content-type') ?? 'image/jpeg',
        // Fica guardada no telemóvel de quem a viu, não em caches partilhadas.
        'Cache-Control': 'private, max-age=86400',
      },
    })
  }
  return new Response(null, { status: 404 })
}
