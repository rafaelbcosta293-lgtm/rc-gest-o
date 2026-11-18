import type { Metadata } from 'next'
import TecladoCheckin from './TecladoCheckin'

export const metadata: Metadata = {
  title: 'Check-in · RC',
  robots: { index: false, follow: false },
}

// Página do tablet de check-in (sem login). Não lê dados nenhuns: o link
// só é validado quando alguém regista a presença.
export default async function CheckinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <TecladoCheckin token={token} />
}
