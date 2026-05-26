import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ToastProvider from '@/components/ToastProvider'
import NavBar from '@/components/NavBar'
import LogConsole from '@/components/LogConsole'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'GPM Profile & Multi-Account Manager',
  description: 'Core + Plugin Architecture',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className} style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)' }}>
        <ToastProvider>
          <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-page)' }}>
            <NavBar />
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 pb-32">
              {children}
            </main>
            <LogConsole />
          </div>
        </ToastProvider>
      </body>
    </html>
  )
}
