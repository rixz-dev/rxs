import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title:       'ANERS — Aria c11',
  description: 'AI yang bekerja sampai selesai. Dual-agent: Aria builder + Nexus reviewer.',
  icons:       { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
