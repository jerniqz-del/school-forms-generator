import './globals.css';
import type { Metadata } from 'next';
import { AppProviders } from '@/app/providers';

export const metadata: Metadata = {
  title: 'School Forms Generator',
  description: 'Generate DepEd school forms instantly from your Form 1 Excel file.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
