import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-600/25 hover:from-indigo-400 hover:to-indigo-500 hover:shadow-indigo-500/30 focus-visible:ring-indigo-500',
        outline:
          'border border-zinc-700 bg-zinc-900/60 text-zinc-100 hover:bg-zinc-800 hover:border-zinc-600 focus-visible:ring-indigo-500',
        ghost: 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:ring-indigo-500',
        destructive:
          'bg-red-600 text-white shadow-lg shadow-red-600/20 hover:bg-red-500 focus-visible:ring-red-500',
      },
      size: {
        default: 'h-10 px-4 py-2 text-sm',
        sm: 'h-9 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-lg px-8 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
);

Button.displayName = 'Button';

export { Button, buttonVariants };
