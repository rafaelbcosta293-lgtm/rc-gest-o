import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Play } from 'lucide-react'
import { Cartao, Etiqueta, Seccao } from '@/components/ui'
import { aulasVirtuais, contaAtual } from '@/lib/dados'
import { capaDoVideo, leitorDoVideo, resumoDaAula } from '@/lib/videos'

export const metadata = { title: 'Aula virtual' }

// Uma aula em vídeo: o leitor, a descrição e as outras aulas da mesma
// categoria. Quem não tem o serviço não recebe aula nenhuma da base de
// dados — a página dá "não encontrada".
export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await contaAtual()
  const aulas = await aulasVirtuais()
  const aula = aulas.find((a) => a.id === id)
  if (!aula) notFound()
  const outras = aulas.filter((a) => a.categoria === aula.categoria && a.id !== aula.id)

  return (
    <div>
      <Link href="/videos" className="-ml-1 inline-flex h-10 items-center gap-0.5 pt-1 text-sm font-semibold text-muted active:text-foreground">
        <ChevronLeft className="h-5 w-5" /> Aulas virtuais
      </Link>

      {/* O vídeo ocupa a largura toda do ecrã, sem margens. */}
      <div className="-mx-4 mt-1 aspect-video bg-black sm:mx-0 sm:overflow-hidden sm:rounded-2xl">
        <iframe
          src={leitorDoVideo(aula.youtube_id)}
          title={aula.titulo}
          // O YouTube recusa tocar vídeos embutidos sem saber de que site vêm.
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          className="h-full w-full border-0"
        />
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Etiqueta>{aula.categoria}</Etiqueta>
          {resumoDaAula(aula) && <span className="text-sm text-muted">{resumoDaAula(aula)}</span>}
        </div>
        <h1 className="mt-2 text-[1.45rem] leading-tight font-bold tracking-tight">{aula.titulo}</h1>
        {aula.descricao && <p className="mt-2 text-[0.95rem] leading-relaxed whitespace-pre-line text-muted">{aula.descricao}</p>}
      </div>

      {outras.length > 0 && (
        <Seccao titulo={`Mais em ${aula.categoria}`}>
          <Cartao className="divide-y divide-border">
            {outras.map((a) => (
              <Link key={a.id} href={`/videos/${a.id}`} className="flex items-center gap-3.5 p-3 active:bg-soft">
                <span className="relative block aspect-video w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-200">
                  {/* eslint-disable-next-line @next/next/no-img-element -- capa servida pelo YouTube */}
                  <img src={capaDoVideo(a.youtube_id)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/15">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white">
                      <Play className="h-3.5 w-3.5 translate-x-px fill-current" />
                    </span>
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[0.95rem] leading-snug font-semibold">{a.titulo}</span>
                  {resumoDaAula(a) && <span className="mt-0.5 block text-sm text-muted">{resumoDaAula(a)}</span>}
                </span>
              </Link>
            ))}
          </Cartao>
        </Seccao>
      )}
    </div>
  )
}
