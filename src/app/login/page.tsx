'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/firebase/auth/use-user';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const { user, isUserLoading, signInWithGoogle } = useUser();

  useEffect(() => {
    if (!isUserLoading && user) {
      router.replace(redirect);
    }
  }, [isUserLoading, redirect, router, user]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Sign In</CardTitle>
          <CardDescription>
            Use your Google account to keep tokens connected to you and enable Google Drive backup.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={signInWithGoogle}
            disabled={isUserLoading}
          >
            <LogIn className="size-4" />
            Continue with Google and Drive Backup
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
