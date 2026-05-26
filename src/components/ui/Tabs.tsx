'use client'

interface Tab {
  key: string
  label: string
  count?: number
}

interface TabsProps {
  tabs: Tab[]
  active: string
  onChange: (key: string) => void
}

export default function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex gap-1 p-1 rounded-lg overflow-x-auto" style={{ backgroundColor: 'var(--bg-surface-2)' }}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
            active === tab.key ? 'shadow-sm' : 'hover:bg-white/5'
          }`}
          style={{
            backgroundColor: active === tab.key ? 'var(--bg-surface)' : 'transparent',
            color: active === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
          }}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              active === tab.key ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5'
            }`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
