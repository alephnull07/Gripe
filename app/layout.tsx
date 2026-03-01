import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, Space_Mono, Syne } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ConvexClientProvider } from '@/components/convex-provider'
import './globals.css'

const _spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' })
const _spaceMono = Space_Mono({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-space-mono' })
const _syne = Syne({ subsets: ['latin'], variable: '--font-syne' })

export const metadata: Metadata = {
  title: 'GRIPE - Autonomous Product Intelligence',
  description: 'Real-time operations dashboard for autonomous AI product feedback agent',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${_spaceGrotesk.variable} ${_spaceMono.variable} ${_syne.variable}`}>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ConvexClientProvider>
          {children}
        </ConvexClientProvider>
        <Analytics />
      </body>
    </html>
  )
}
