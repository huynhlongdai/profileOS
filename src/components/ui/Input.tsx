import { forwardRef } from 'react'
import { Search } from 'lucide-react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div>
        {label && (
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full px-3 py-2 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-1 ${className}`}
          style={{
            backgroundColor: 'var(--bg-surface-2)',
            borderColor: error ? '#ef4444' : 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
          {...props}
        />
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

export default Input

export function SearchInput({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
      <input
        type="search"
        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-1"
        style={{
          backgroundColor: 'var(--bg-surface-2)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
        {...props}
      />
    </div>
  )
}
