import { createClient } from '@/lib/supabase/server'

export default async function RegulamentoClientePage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('config')
    .select('valor')
    .eq('chave', 'regulamento')
    .maybeSingle()

  const texto: string = data?.valor ?? ''
  const paragrafos = texto.split('\n').filter((linha: string) => linha.trim() !== '')

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Regulamento interno</h1>

      {paragrafos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/10 p-6 text-center text-sm text-zinc-500 dark:border-white/10">
          O regulamento ainda não foi publicado.
        </p>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-5 text-sm leading-relaxed text-zinc-700 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-300">
          {paragrafos.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}
    </div>
  )
}
