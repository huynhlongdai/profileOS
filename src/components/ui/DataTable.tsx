'use client'

interface Column<T> {
  key: string
  label: string
  className?: string
  hideOnMobile?: boolean
  render: (item: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (item: T) => string
  onRowClick?: (item: T) => void
  mobileCard?: (item: T) => React.ReactNode
  loading?: boolean
  emptyMessage?: string
}

export default function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  mobileCard,
  emptyMessage = 'No data',
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-surface-2)' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-medium ${col.className || ''}`}
                  style={{ color: 'var(--text-muted)' }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-white/[0.02]' : ''}`}
                onClick={() => onRowClick?.(item)}
                style={{ borderColor: 'var(--border-color)' }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 ${col.className || ''}`}
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {data.map((item) => (
          <div
            key={keyExtractor(item)}
            className={`rounded-lg border p-3 ${onRowClick ? 'cursor-pointer active:bg-white/5' : ''}`}
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
            onClick={() => onRowClick?.(item)}
          >
            {mobileCard ? mobileCard(item) : (
              <div className="space-y-1.5">
                {columns.filter(c => !c.hideOnMobile).map((col) => (
                  <div key={col.key} className="flex items-center justify-between gap-2">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{col.label}</span>
                    <span className="text-xs text-right">{col.render(item)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
