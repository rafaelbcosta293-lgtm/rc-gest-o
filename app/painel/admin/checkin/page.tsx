import Link from 'next/link'
import { headers } from 'next/headers'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { getEstudios } from '@/lib/data/estudios'

const CONFIG_KEY_POR_ESTUDIO: Record<string, string> = {
  fatima: 'qr_token_fatima',
  leiria: 'qr_token_leiria',
}

export default async function CheckinAdminPage() {
  const supabase = await createClient()
  const [estudios, { data: configData }] = await Promise.all([
    getEstudios(supabase),
    supabase
      .from('config')
      .select('chave, valor')
      .in('chave', Object.values(CONFIG_KEY_POR_ESTUDIO)),
  ])
  const tokenPorChave = new Map((configData ?? []).map((c) => [c.chave, c.valor]))
  const origin = (await headers()).get('origin')

  const estudiosComQr = await Promise.all(
    estudios.map(async (e) => {
      const chave = CONFIG_KEY_POR_ESTUDIO[e.slug]
      const token = chave ? tokenPorChave.get(chave) : null
      const url = token ? `${origin}/cliente/checkin/${token}` : null
      const png = url ? await QRCode.toDataURL(url, { width: 320, margin: 1 }) : null
      return { estudio: e, url, png }
    })
  )

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/painel/admin" className="text-sm text-zinc-600 underline dark:text-zinc-400">
        ← Administração
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Código QR de presença
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Imprime e afixa cada código à entrada do estúdio certo — o cliente digitaliza com a
        câmara do telemóvel para marcar presença na app.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {estudiosComQr.map(({ estudio, png }) => (
          <div
            key={estudio.id}
            className="flex flex-col items-center gap-3 rounded-xl border border-black/10 bg-white p-5 text-center dark:border-white/10 dark:bg-zinc-950"
          >
            <strong className="text-sm text-black dark:text-zinc-50">{estudio.nome}</strong>
            {png ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={png} alt={`Código QR de presença — ${estudio.nome}`} className="h-56 w-56" />
            ) : (
              <p className="text-xs text-red-600">Token em falta para este estúdio.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
