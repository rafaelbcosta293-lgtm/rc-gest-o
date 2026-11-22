import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })

export const metadata: Metadata = {
  title: { default: 'RC Private Fitness Studio', template: '%s · RC Private Fitness Studio' },
  description: 'As suas aulas, treinos e avaliações.',
  robots: { index: false, follow: false },
  appleWebApp: { title: 'RC Studio', statusBarStyle: 'default', capable: true },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
  formatDetection: { telephone: false, date: false, address: false, email: false },
}

export const viewport: Viewport = {
  themeColor: '#f6f4ef',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
