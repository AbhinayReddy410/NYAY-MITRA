import type { HTMLAttributes } from 'react';

type CardProps = HTMLAttributes<HTMLDivElement>;

const BASE_CLASSES = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm';

export function Card({ className, ...props }: CardProps): JSX.Element {
  const classes = `${BASE_CLASSES} ${className ?? ''}`.trim();
  return <div className={classes} {...props} />;
}
