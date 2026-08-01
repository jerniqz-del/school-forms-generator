'use client';
import { Inter as FontSans } from "next/font/google";

import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from '@/components/theme-provider';
import { DisclaimerProvider } from '@/app/(main)/disclaimer-context';
import { cn } from "@/lib/utils";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

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
      <body className={cn(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable
        )}>
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
      </body>
    </html>
  );
}
