'use client';

import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';
import { DisclaimerProvider } from '@/app/(main)/disclaimer-context';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import type { ReactNode } from 'react';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <FirebaseClientProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <DisclaimerProvider>
          <div className="relative flex min-h-dvh flex-col bg-background">
            <main className="flex-1">{children}</main>
            <Toaster />
          </div>
        </DisclaimerProvider>
      </ThemeProvider>
    </FirebaseClientProvider>
  );
}
