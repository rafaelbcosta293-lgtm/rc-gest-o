import Link from 'next/link'
import { MonitorPlay, Play } from 'lucide-react'
import { Cartao, Seccao, TituloPagina, Vazio } from '@/components/ui'
import { aulasVirtuais, contaAtual, totalAulasVirtuais } from '@/lib/dados'
import { ancora, capaDoVideo, porCategoria, resumoDaAula } from '@/lib/videos'
import { plural } from '@/lib/vistas'

export const metadata = { title: 'Aulas virtuais' }

// Aulas virtuais: a biblioteca de aulas em vídeo, por categoria. Só para
// quem tem o serviço; aos outros explica-se o que é e como aderir.
export default async function VideosPage() {
  const conta = await contaAtual()

  if (!conta.aulas_virtuais) {
    const total = await totalAulasVirtuais()
    return (
      <div>
        <TituloPagina titulo="Aulas virtuais" />
        <div className="mt-4 rounded-3xl bg-zinc-900 p-5 text-white shadow-lg shadow-zinc-900/10">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-brand">
            <MonitorPlay className="h-5 w-5" />
          </span>
          <p className="mt-4 text-lg leading-snug font-semibold">Treine em casa, quando quiser</p>
          <p className="mt-1.5 text-sm leading-snug text-zinc-300">
            {total > 0
              ? `${plural(total, 'aula em vídeo', 'aulas em vídeo')} com os nossos treinadores, sempre disponíveis aqui na app.`
              : 'Aulas em vídeo com os nossos treinadores, sempre disponíveis aqui na app.'}
          </p>
          <p className="mt-4 text-sm leading-snug text-zinc-300">
            As Aulas Virtuais são um serviço à parte. Para aderir, fale connosco no estúdio de {conta.estudio_nome}.
          </p>
        </div>
      </div>
    )
  }

  const aulas = await aulasVirtuais()
  const grupos = porCategoria(aulas)

  return (
    <div>
      <TituloPagina titulo="Aulas virtuais" subtitulo="Aulas em vídeo para fazer onde e quando quiser." />

      {aulas.length === 0 ? (
        <div className="mt-6">
          <Vazio Icone={MonitorPlay} titulo="Ainda não há aulas">
            As primeiras aulas em vídeo estão a chegar.
          </Vazio>
        </div>
      ) : (
        <>
          {grupos.length > 1 && (
            <nav aria-label="Categorias" className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {grupos.map((g) => (
                <a
                  key={g.categoria}
                  href={`#${ancora(g.categoria)}`}
                  className="shrink-0 rounded-full bg-surface px-3.5 py-2 text-sm font-semibold whitespace-nowrap shadow-card ring-1 ring-border active:bg-soft"
                >
                  {g.categoria}
                </a>
              ))}
            </nav>
          )}

          {grupos.map((g) => (
            <Seccao key={g.categoria} id={ancora(g.categoria)} titulo={`${g.categoria} · ${g.aulas.length}`}>
              <Cartao className="divide-y divide-border">
                {g.aulas.map((a) => (
                  <Link key={a.id} href={`/videos/${a.id}`} className="flex items-center gap-3.5 p-3 active:bg-soft">
                    <span className="relative block aspect-video w-[7.25rem] shrink-0 overflow-hidden rounded-xl bg-zinc-200">
                      {/* eslint-disable-next-line @next/next/no-img-element -- capa servida pelo YouTube */}
                      <img src={capaDoVideo(a.youtube_id)} alt="" loading="lazy" className="h-full w-full object-cover" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/15">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white">
                          <Play className="h-4 w-4 translate-x-px fill-current" />
                        </span>
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 leading-snug font-semibold">{a.titulo}</span>
                      {resumoDaAula(a) && <span className="mt-1 block text-sm text-muted">{resumoDaAula(a)}</span>}
                    </span>
                  </Link>
                ))}
              </Cartao>
            </Seccao>
          ))}
        </>
      )}
    </div>
  )
}
