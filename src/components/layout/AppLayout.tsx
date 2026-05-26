'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import MobileNav from './MobileNav'
import LogConsole from '@/components/LogConsole'
import CommandPalette from './CommandPalette'

const NO_LAYOUT_PATHS = ['/login']

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  if (NO_LAYOUT_PATHS.includes(pathname)) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-page)' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed left-0 top-0 h-full z-50 md:hidden">
            <Sidebar collapsed={false} onToggle={() => setMobileMenuOpen(false)} mobile />
          </div>
        </>
      )}

      <div
        className="transition-all duration-200 md:pl-[var(--sidebar-w)]"
        style={{ '--sidebar-w': collapsed ? '64px' : '240px' } as React.CSSProperties}
      >
        <TopBar onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="p-4 sm:p-6 pb-24 md:pb-6 max-w-7xl mx-auto">
          {children}
        </main>
      </div>

      <MobileNav />
      <LogConsole />
      <CommandPalette />
    </div>
  )
}
