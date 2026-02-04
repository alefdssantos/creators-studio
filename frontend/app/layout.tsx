import type { Metadata } from 'next'
import { Agentation } from 'agentation'
import './globals.css'

export const metadata: Metadata = {
  title: 'Downloader - YouTube, TikTok & Twitter',
  description: 'Download videos from YouTube, TikTok and Twitter/X easily',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        {process.env.NODE_ENV === 'development' && <Agentation />}
      </body>
    </html>
  )
}
