
'use client';

import { useState } from "react";
import { deleteUser, GoogleAuthProvider, reauthenticateWithPopup } from "firebase/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser } from "@/firebase/auth/use-user";
import { useToast } from "@/components/ui/use-toast";
import { Coins, History, LogIn, LogOut, RotateCcw, Share2, Trash2, UserCircle, Package as PackageIcon } from "lucide-react";

type AppHeaderProps = {
    availableTokens?: number | null;
    onReloadTokens?: () => void;
    onShareTokens?: () => void;
    onOpenTokenHistory?: () => void;
    onResetAccount?: () => void;
};

export function AppHeader({
    availableTokens,
    onReloadTokens,
    onShareTokens,
    onOpenTokenHistory,
    onResetAccount,
}: AppHeaderProps) {
    const { user, isUserLoading, isAdmin, signInWithGoogle, signOut } = useUser();
    const { toast } = useToast();
    const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isAccountActionLoading, setIsAccountActionLoading] = useState(false);
    const fallback = user?.displayName
        ?.split(' ')
        .map(part => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U';

    const getAuthHeaders = async (forceRefresh = false) => {
        if (!user) throw new Error('Sign in is required.');
        const token = await user.getIdToken(forceRefresh);
        return { Authorization: `Bearer ${token}` };
    };

    const handleResetAccount = async () => {
        setIsAccountActionLoading(true);
        try {
            const response = await fetch('/api/account', {
                method: 'POST',
                headers: await getAuthHeaders(),
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) throw new Error(data?.error || 'Unable to reset account.');

            onResetAccount?.();
            setIsResetDialogOpen(false);
            toast({
                variant: 'success',
                title: 'Account Reset',
                description: data?.releasedTokens
                    ? `${data.releasedTokens} reserved token(s) were returned to your wallet.`
                    : 'Your workspace and pending account state were reset.',
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Account Reset Failed',
                description: error.message || 'Unable to reset account.',
            });
        } finally {
            setIsAccountActionLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        setIsAccountActionLoading(true);
        try {
            if (!user) throw new Error('Sign in is required.');

            const provider = new GoogleAuthProvider();
            await reauthenticateWithPopup(user, provider);

            const response = await fetch('/api/account', {
                method: 'DELETE',
                headers: await getAuthHeaders(true),
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) throw new Error(data?.error || 'Unable to delete account.');

            setIsDeleteDialogOpen(false);
            await deleteUser(user);
            toast({
                variant: 'success',
                title: 'Account Deleted',
                description: 'Your School Forms Generator account has been deleted.',
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Account Deletion Failed',
                description: error.code === 'auth/popup-closed-by-user'
                    ? 'Google confirmation was closed before account deletion.'
                    : error.message || 'Unable to delete account.',
            });
        } finally {
            setIsAccountActionLoading(false);
        }
    };

    return (
        <>
            <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-sm">
                <div className="container flex min-h-16 flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-6 md:gap-10">
                        <a href="/" className="flex items-center space-x-2">
                             <span className="inline-block font-bold">School Forms Generator</span>
                        </a>
                    </div>

                    <div className="flex flex-1 items-center justify-end">
                        <nav className="flex flex-wrap items-center justify-end gap-2">
                        {user && typeof availableTokens === 'number' && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="rounded-full bg-muted/40 px-3 font-semibold">
                                        {availableTokens} tokens
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-80 p-3">
                                    <div className="mb-3 px-1">
                                        <p className="text-sm font-semibold">Token Wallet</p>
                                        <p className="text-xs text-muted-foreground">{availableTokens} token(s) available</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button variant="outline" size="sm" onClick={onReloadTokens} className="flex-1 gap-2">
                                            <Coins className="size-4" />
                                            Reload
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={onShareTokens} className="flex-1 gap-2">
                                            <Share2 className="size-4" />
                                            Share
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={onOpenTokenHistory} className="flex-1 gap-2">
                                            <History className="size-4" />
                                            History
                                        </Button>
                                    </div>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        {user ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="relative size-10 rounded-full p-0">
                                        <Avatar className="size-9">
                                            <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'Account'} />
                                            <AvatarFallback>{fallback}</AvatarFallback>
                                        </Avatar>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-64">
                                    <DropdownMenuLabel className="flex items-center gap-2">
                                        <UserCircle className="size-4" />
                                        <span className="truncate">{user.displayName || user.email || 'Signed in'}</span>
                                    </DropdownMenuLabel>
                                    {user.email && (
                                        <div className="truncate px-2 pb-1 text-xs text-muted-foreground">
                                            {user.email}
                                        </div>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setIsResetDialogOpen(true)}>
                                        <RotateCcw className="size-4" />
                                        Reset account
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => setIsDeleteDialogOpen(true)}
                                        className="text-destructive focus:text-destructive"
                                    >
                                        <Trash2 className="size-4" />
                                        Delete account
                                    </DropdownMenuItem>
                                    {isAdmin && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => (window.location.href = '/admin')}>
                                          <PackageIcon className="size-4" />
                                          Admin
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={signOut}>
                                        <LogOut className="size-4" />
                                        Sign out
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={signInWithGoogle}
                                disabled={isUserLoading}
                                className="gap-2"
                            >
                                <LogIn className="size-4" />
                                Sign in
                            </Button>
                        )}
                        <ThemeToggle />
                        </nav>
                    </div>
                </div>
            </header>

            <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset your account?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This clears your current workspace, cached Drive folders, pending reload checkout sessions, and releases reserved tokens. Your bought tokens, token history, and sign-in account are kept.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isAccountActionLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetAccount} disabled={isAccountActionLoading}>
                            Reset Account
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently removes your School Forms Generator account, token wallet, token history, referrals, sharing records, and sign-in account. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isAccountActionLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteAccount}
                            disabled={isAccountActionLoading}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete Account
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
