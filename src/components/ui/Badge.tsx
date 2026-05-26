interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'muted'
  size?: 'sm' | 'md'
  dot?: boolean
}

const variants = {
  default: 'bg-gray-500/10 text-gray-400',
  success: 'bg-emerald-500/10 text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-400',
  error: 'bg-red-500/10 text-red-400',
  info: 'bg-blue-500/10 text-blue-400',
  muted: 'bg-white/5 text-gray-500',
}

const dotColors = {
  default: 'bg-gray-400',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  error: 'bg-red-400',
  info: 'bg-blue-400',
  muted: 'bg-gray-500',
}

export default function Badge({ children, variant = 'default', size = 'sm', dot }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${variants[variant]} ${
      size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
    }`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  )
}
