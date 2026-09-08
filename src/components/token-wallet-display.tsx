import { cn } from '@/lib/utils';
import { readTokenBalances, splitTokenSpend } from '@/lib/tokens';

type WalletLike = {
  tokens?: number;
  freeTokens?: number;
  shareableTokens?: number;
} | null | undefined;

function bronzeClassName(compact = false) {
  return cn(
    'inline-flex items-center gap-1 rounded-full font-semibold',
    compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
    'bg-[#cd7f32]/15 text-[#8a5416] dark:text-[#e2a45c]'
  );
}

function goldClassName(compact = false) {
  return cn(
    'inline-flex items-center gap-1 rounded-full font-semibold',
    compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
    'bg-[#d4af37]/20 text-[#7a6410] dark:text-[#efd178]'
  );
}

export function TokenKindChip({
  kind,
  amount,
  compact = false,
  label,
  showKindLabel = true,
}: {
  kind: 'bronze' | 'gold';
  amount: number;
  compact?: boolean;
  label?: string;
  showKindLabel?: boolean;
}) {
  const isBronze = kind === 'bronze';
  const kindLabel = label ?? (isBronze ? 'Bronze' : 'Gold');
  return (
    <span
      className={isBronze ? bronzeClassName(compact) : goldClassName(compact)}
      aria-label={`${kindLabel} ${amount}`}
    >
      <span
        className={cn('rounded-full', compact ? 'size-1.5' : 'size-2', isBronze ? 'bg-[#cd7f32]' : 'bg-[#d4af37]')}
        aria-hidden
      />
      {showKindLabel && <span>{kindLabel}</span>}
      <span>{amount}</span>
    </span>
  );
}

export function TokenBalanceChips({
  wallet,
  compact = false,
  showLabels = true,
}: {
  wallet?: WalletLike;
  compact?: boolean;
  showLabels?: boolean;
}) {
  const balances = readTokenBalances(wallet);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <TokenKindChip
        kind="bronze"
        amount={balances.freeTokens}
        compact={compact}
        showKindLabel={showLabels}
      />
      <TokenKindChip
        kind="gold"
        amount={balances.shareableTokens}
        compact={compact}
        showKindLabel={showLabels}
      />
    </span>
  );
}

export function TokenWalletBreakdown({
  wallet,
  className,
}: {
  wallet?: WalletLike;
  className?: string;
}) {
  const balances = readTokenBalances(wallet);
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Available tokens</p>
          <p className="text-3xl font-bold text-foreground">{balances.tokens}</p>
        </div>
        <TokenBalanceChips wallet={balances} />
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Bronze tokens are free and reward tokens. They are used first and cannot be shared. Gold tokens come from reloads and can be shared. Generation rewards count only gold tokens spent on student forms.
      </p>
    </div>
  );
}

export function TokenSpendPreview({
  wallet,
  cost,
  showGenerationRewardHint = false,
}: {
  wallet?: WalletLike;
  cost: number;
  showGenerationRewardHint?: boolean;
}) {
  const balances = readTokenBalances(wallet);
  const spend = splitTokenSpend(balances.freeTokens, balances.shareableTokens, cost);
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between text-muted-foreground">
        <span>Bronze used first</span>
        <span className="font-semibold text-[#8a5416] dark:text-[#e2a45c]">{spend.bronzeUsed}</span>
      </div>
      <div className="flex items-center justify-between text-muted-foreground">
        <span>Gold used after bronze</span>
        <span className="font-semibold text-[#7a6410] dark:text-[#efd178]">{spend.goldUsed}</span>
      </div>
      <div className="flex items-center justify-between border-t pt-2 font-semibold text-foreground">
        <span>Total used</span>
        <span>{spend.covered}</span>
      </div>
      {spend.uncovered > 0 && (
        <div className="flex items-center justify-between text-destructive">
          <span>Still needed</span>
          <span>{spend.uncovered}</span>
        </div>
      )}
      {showGenerationRewardHint && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Only gold tokens used for student forms count toward generation rewards.
        </p>
      )}
    </div>
  );
}
