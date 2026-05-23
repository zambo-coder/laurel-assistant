import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
  loading?: boolean
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed'

  const sizes = {
    sm: 'px-3.5 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
  }

  const variants = {
    primary: 'bg-[--foreground] text-[--background] hover:opacity-80',
    secondary: 'bg-[--background] border border-[--border] text-[--foreground] hover:bg-[--cream-200,#f4efe6]',
    ghost: 'text-[--muted] hover:text-[--foreground] hover:bg-[--cream-200,#f4efe6]',
  }

  return (
    <button
      disabled={disabled || loading}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          {children}
        </>
      ) : children}
    </button>
  )
}
