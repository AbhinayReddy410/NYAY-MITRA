import type { ReactNode } from 'react';

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps): JSX.Element {
  return (
    <div className='min-h-screen bg-slate-50'>
      <div className='mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-6'>
        {children}
      </div>
    </div>
  );
}
