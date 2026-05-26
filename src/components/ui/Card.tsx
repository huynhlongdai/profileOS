interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: boolean
}

export default function Card({ children, className = '', padding = true }: CardProps) {
  return (
    <div
      className={`rounded-xl border ${padding ? 'p-4 sm:p-5' : ''} ${className}`}
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export function CardHeader({ title, description, action }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        {description && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  trend?: { value: number; label: string }
  variant?: 'default' | 'success' | 'warning' | 'error'
}

const statVariants = {
  default: 'from-indigo-500/10 to-transparent',
  success: 'from-emerald-500/10 to-transparent',
  warning: 'from-amber-500/10 to-transparent',
  error: 'from-red-500/10 to-transparent',
}

export function StatCard({ label, value, icon, variant = 'default' }: StatCardProps) {
  return (
    <div
      className={`rounded-xl border p-4 bg-gradient-to-br ${statVariants[variant]}`}
      style={{ borderColor: 'var(--border-color)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
        {icon && <span style={{ color: 'var(--text-muted)' }}>{icon}</span>}
      </div>
      <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  )
}
