'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navLinks = [
  { href: '/dashboard',               label: 'Dashboard' },
  { href: '/accounts',                label: 'Accounts' },
  { href: '/profiles',                label: 'Profiles' },
  { href: '/proxies',                 label: 'Proxies' },
  { href: '/modules',                 label: 'Modules' },
  { href: '/logs',                    label: 'Logs' },
  { href: '/tasks',                   label: 'Tasks' },
  { href: '/auto-register',           label: 'Auto Register' },
  { href: '/recordings',              label: 'Recordings' },
  { href: '/account-types',           label: 'Account Types' },
  { href: '/settings/automation',     label: 'Settings' },
  { href: '/settings/browser-connections', label: '🔌 Connections' },
  { href: '/settings/google-sheets',  label: '📊 Sheets', accent: true },
]

export default function NavBar() {
  const pathname = usePathname()

  return (
    <nav style={{
      backgroundColor: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-color)',
    }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6 h-14">
          {/* Logo */}
          <span className="flex-shrink-0 text-base font-bold" style={{
            background: 'linear-gradient(135deg, #818cf8, #6366f1)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            ⚡ GPM Manager
          </span>

          {/* Links */}
          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
            {navLinks.map(({ href, label, accent }) => {
              const isActive = pathname === href || (href !== '/' && pathname?.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors duration-150"
                  style={{
                    color: isActive
                      ? (accent ? '#6ee7b7' : 'var(--accent)')
                      : (accent ? '#34d399' : 'var(--text-secondary)'),
                    backgroundColor: isActive ? 'var(--bg-surface-2)' : 'transparent',
                  }}
                >
                  {label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
