import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="mb-3" style={{ color: 'var(--text-muted)' }}>
        {icon || <Inbox size={40} strokeWidth={1.5} />}
      </div>
      <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
        {title}
      </h3>
      {description && (
        <p className="text-xs text-center max-w-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          {description}
        </p>
      )}
      {action}
    </div>
  )
}
