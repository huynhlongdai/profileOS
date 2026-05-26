'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Globe, Shield, FileText, ListTodo,
  Settings, Zap, MonitorPlay, UserPlus, Link2, Sheet, ChevronLeft,
  ChevronRight, Layers, Plug, Crosshair
} from 'lucide-react'

const navGroups = [
  {
    label: 'Main',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/workspace', label: 'Workspace', icon: Crosshair },
      { href: '/profiles', label: 'Profiles', icon: Globe },
      { href: '/accounts', label: 'Accounts', icon: Users },
      { href: '/proxies', label: 'Proxies', icon: Shield },
    ],
  },
  {
    label: 'Tools',
    items: [
      { href: '/tasks', label: 'Tasks', icon: ListTodo },
      { href: '/automation', label: 'Automation', icon: Zap },
      { href: '/recordings', label: 'Recordings', icon: MonitorPlay },
      { href: '/auto-register', label: 'Auto Register', icon: UserPlus },
      { href: '/modules', label: 'Modules', icon: Layers },
      { href: '/logs', label: 'Logs', icon: FileText },
    ],
  },
  {
    label: 'Settings',
    items: [
      { href: '/account-types', label: 'Account Types', icon: Users },
      { href: '/settings/automation', label: 'Task Engine', icon: Settings },
      { href: '/settings/browser-connections', label: 'Connections', icon: Plug },
      { href: '/settings/google-sheets', label: 'Google Sheets', icon: Sheet },
    ],
  },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobile?: boolean
}

export default function Sidebar({ collapsed, onToggle, mobile }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={`fixed left-0 top-0 h-full z-40 transition-all duration-200 ease-in-out flex flex-col border-r ${mobile ? '' : 'hidden md:flex'}`}
      style={{
        width: collapsed ? 64 : 240,
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-color)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 gap-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <span className="text-lg">⚡</span>
        {!collapsed && (
          <span className="font-semibold text-sm" style={{ color: 'var(--accent)' }}>
            ProfileOS
          </span>
        )}
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-3">
            {!collapsed && (
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {group.label}
              </div>
            )}
            {group.items.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || (href !== '/' && pathname?.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  title={collapsed ? label : undefined}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
                    isActive ? 'bg-indigo-500/10' : 'hover:bg-white/5'
                  }`}
                  style={{
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center h-10 border-t hover:bg-white/5 transition-colors"
        style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  )
}
