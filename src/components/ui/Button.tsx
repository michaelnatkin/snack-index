import { type ButtonHTMLAttributes, type ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = `
    inline-flex items-center justify-center gap-2
    font-medium rounded-full transition-all duration-200
    focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white/40
    disabled:opacity-50 disabled:cursor-not-allowed
    whitespace-nowrap backdrop-blur
  `;

  const variantStyles = {
    primary: `
      bg-gradient-to-r from-primary to-primary-dark text-charcoal
      hover:brightness-95
      focus-visible:ring-primary
      shadow-lg hover:shadow-xl
    `,
    secondary: `
      bg-white/90 text-charcoal border border-white/60
      hover:bg-white
      focus-visible:ring-eggplant
      shadow-md
    `,
    outline: `
      border-2 border-charcoal/15 text-charcoal
      hover:bg-charcoal hover:text-cream
      focus-visible:ring-charcoal
      bg-white/60
    `,
    ghost: `
      text-charcoal hover:bg-charcoal/10
      focus-visible:ring-charcoal
      bg-white/30
    `,
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}

export default Button;

