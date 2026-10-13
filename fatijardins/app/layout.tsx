import type { Metadata, Viewport } from "next"
import { Geist } from "next/font/google"

import { RegistarServiceWorker } from "@/components/registar-service-worker"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const fonte = Geist({
  variable: "--font-sans-app",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "Fatijardins",
    template: "%s · Fatijardins",
  },
  description: "Gestão de manutenção e construção de jardins.",
  applicationName: "Fatijardins",
  appleWebApp: {
    capable: true,
    title: "Fatijardins",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: "#15803d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-PT" className={`${fonte.variable} h-full`}>
      <body className="min-h-full">
        {children}
        <Toaster />
        <RegistarServiceWorker />
      </body>
    </html>
  )
}
