import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const BASE_CLASSES = 'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition';
const DISABLED_CLASSES = 'disabled:opacity-60 disabled:pointer-events-none';
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-slate-900 text-white hover:bg-slate-800',
  secondary: 'border border-slate-200 text-slate-900 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
  danger: 'bg-red-600 text-white hover:bg-red-700'
};

export function Button({ className, variant = 'primary', ...props }: ButtonProps): JSX.Element {
  const classes = `${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${DISABLED_CLASSES} ${className ?? ''}`.trim();
  return <button className={classes} {...props} />;
}
