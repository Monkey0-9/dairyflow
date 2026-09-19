import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'sunlight' | 'luxury' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      type = 'button',
      ...props
    },
    ref
  ) => {
    // Base styles: 44px minimum touch target for field usage, sleek typography, focus ring
    const baseStyles =
      'inline-flex items-center justify-center font-bold tracking-tight rounded-2xl transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2';

    const sizeStyles = {
      sm: 'px-3.5 py-1.5 text-xs min-h-[36px] gap-1.5',
      md: 'px-5 py-2.5 text-sm min-h-[44px] gap-2 shadow-xs',
      lg: 'px-6 py-3.5 text-base min-h-[48px] gap-2.5 shadow-sm',
    }[size];

    const variantStyles = {
      primary:
        'bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950 shadow-xs border border-slate-800 dark:border-white/20',
      secondary:
        'bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800',
      outline:
        'bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-800',
      ghost:
        'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 border border-transparent',
      danger:
        'bg-rose-600 hover:bg-rose-500 text-white border border-rose-500 shadow-rose-600/20 shadow-xs',
      success:
        'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 shadow-emerald-600/20 shadow-xs',
      sunlight:
        'bg-black hover:bg-neutral-900 text-white border-2 border-black font-black uppercase tracking-wider',
      luxury:
        'bg-emerald-950 hover:bg-emerald-900 text-emerald-100 border border-emerald-800/80 shadow-xs',
      gold:
        'bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black border border-amber-400/40 shadow-xs',
    }[variant];

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
