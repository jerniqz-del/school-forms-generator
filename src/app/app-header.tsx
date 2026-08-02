
'use client';

import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser } from "@/firebase/auth/use-user";
import { Coins, History, LogIn, LogOut, Share2, UserCircle } from "lucide-react";

type AppHeaderProps = {
    availableTokens?: number | null;
    onReloadTokens?: () => void;
    onShareTokens?: () => void;
    onOpenTokenHistory?: () => void;
};

export function AppHeader({
    availableTokens,
    onReloadTokens,
    onShareTokens,
    onOpenTokenHistory,
}: AppHeaderProps) {
    const { user, isUserLoading, signInWithGoogle, signOut } = useUser();
    const fallback = user?.displayName
        ?.split(' ')
        .map(part => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U';

    return (
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
                            <div className="flex flex-col items-end gap-2">
                                <div className="rounded-full border bg-muted/40 px-3 py-1 text-sm font-semibold">
                                    {availableTokens} tokens
                                </div>
                                <div className="flex flex-wrap justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={onReloadTokens} className="gap-2">
                                        <Coins className="size-4" />
                                        Reload
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={onShareTokens} className="gap-2">
                                        <Share2 className="size-4" />
                                        Share
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={onOpenTokenHistory} className="gap-2">
                                        <History className="size-4" />
                                        History
                                    </Button>
                                </div>
                            </div>
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
    );
}
