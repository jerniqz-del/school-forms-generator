
'use client';
import { Inter as FontSans } from "next/font/google"

import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from '@/components/theme-provider';
import { DisclaimerProvider, useDisclaimer } from '@/app/(main)/disclaimer-context';
import { Button } from '@/components/ui/button';
import { AppHeader } from "@/app/app-header";
import { cn } from "@/lib/utils";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
})

function AppFooter() {
  const { openDisclaimer } = useDisclaimer();
  return (
    <footer className="py-6 md:px-8 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
            <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
               Developed by John Edward A. Enriquez, T-II &copy; {new Date().getFullYear()}.
            </p>
            <Button variant="link" size="sm" className="text-sm h-auto p-0 text-muted-foreground" onClick={openDisclaimer}>
                Terms of Use
            </Button>
        </div>
    </footer>
  );
}


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
              <AppFooter />
              <Toaster />
            </div>
          </DisclaimerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
