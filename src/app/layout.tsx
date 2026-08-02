'use client';

import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from '@/components/theme-provider';
import { DisclaimerProvider } from '@/app/(main)/disclaimer-context';
import { FirebaseClientProvider } from '@/firebase/client-provider';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>School Form 9 Dashboard</title>
        <meta name="description" content="Generate Form 9 instantly from your Form 1 Excel file." />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <FirebaseClientProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <DisclaimerProvider>
              <div className="relative flex min-h-dvh flex-col bg-background">
                <main className="flex-1">
                  {children}
                </main>
                <Toaster />
              </div>
            </DisclaimerProvider>
          </ThemeProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
