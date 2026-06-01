import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}

const variantClasses: Record<string, string> = {
  default: 'bg-zinc-900 text-white border-transparent',
  secondary: 'bg-zinc-100 text-zinc-900 border-transparent',
  destructive: 'bg-red-500 text-white border-transparent',
  outline: 'text-zinc-900 border-zinc-200',
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
