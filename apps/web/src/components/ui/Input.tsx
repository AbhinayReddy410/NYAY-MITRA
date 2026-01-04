import type { InputHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

const BASE_CLASSES =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none';

export function Input({ className, ...props }: InputProps): JSX.Element {
  const classes = `${BASE_CLASSES} ${className ?? ''}`.trim();
  return <input className={classes} {...props} />;
}
