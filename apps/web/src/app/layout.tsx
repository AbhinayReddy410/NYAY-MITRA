import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import localFont from 'next/font/local';

import { Providers } from './providers';

import './globals.css';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900'
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900'
});

const APP_TITLE = 'NyayaMitra';
const APP_DESCRIPTION = 'Legal draft generation for advocates.';

export const metadata: Metadata = {
  title: APP_TITLE,
  description: APP_DESCRIPTION
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  return (
    <html lang='en'>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
