import type { Metadata, Viewport } from 'next'

// Manifest/ícones só se aplicam dentro de /cliente — o resto da app
// (equipa, em /painel) continua exatamente como estava, sem a opção
// de "instalar como app" a aparecer lá.
export const metadata: Metadata = {
  title: 'RC Private Fitness Studio',
  manifest: '/cliente-manifest.webmanifest',
  icons: {
    icon: ['/icon-192.png', '/icon-512.png'],
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#d9b96a',
}

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
