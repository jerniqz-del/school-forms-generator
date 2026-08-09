import './globals.css';
import type { Metadata } from 'next';
import { Fredoka } from 'next/font/google';
import { AppProviders } from '@/app/providers';

const fredoka = Fredoka({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TeachTiangge',
  description: 'Your go to digital store for teaching related materials.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fredoka.variable} min-h-screen bg-background font-sans antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}