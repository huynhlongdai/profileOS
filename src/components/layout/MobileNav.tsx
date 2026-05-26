'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Globe, Users, ListTodo, MoreHorizontal } from 'lucide-react'

const tabs = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/profiles', label: 'Profiles', icon: Globe },
  { href: '/accounts', label: 'Accounts', icon: Users },
  { href: '/tasks', label: 'Tasks', icon: ListTodo },
  { href: '/more', label: 'More', icon: MoreHorizontal },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t safe-area-bottom"
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
    >
      <div className="flex items-center justify-around h-16">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isMore = href === '/more'
          const isActive = isMore
            ? !['/dashboard', '/profiles', '/accounts', '/tasks'].some(p => pathname?.startsWith(p))
            : pathname === href || (href !== '/' && pathname?.startsWith(href))
          const linkHref = isMore ? '/modules' : href

          return (
            <Link
              key={href}
              href={linkHref}
              className="flex flex-col items-center gap-0.5 px-3 py-1 min-w-[60px]"
            >
              <Icon
                size={20}
                style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
              />
              <span
                className="text-[10px] font-medium"
                style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
