export const FREE_SIGNUP_TOKENS = 30;
export const TOKENS_PER_STUDENT_FORM = 5;
export const TOKEN_RELOAD_MIN_PESOS = 20;
export const TOKENS_PER_PESO = 2.5;
export const TOKEN_RELOAD_BONUS_THRESHOLD_PESOS = 100;
export const TOKEN_RELOAD_BONUS_RATE = 0.05;
export const REFERRAL_REWARD_TOKENS = 20;
export const GENERATION_REWARD_INTERVAL = 50;
export const GENERATION_REWARD_TOKENS = 10;
export const GENERATION_REWARD_GOLD_INTERVAL_TOKENS =
  GENERATION_REWARD_INTERVAL * TOKENS_PER_STUDENT_FORM;

export type TokenBalances = {
  tokens: number;
  freeTokens: number;
  shareableTokens: number;
};

export type TokenSpendSplit = {
  bronzeUsed: number;
  goldUsed: number;
  uncovered: number;
  covered: number;
};

type WalletLike = {
  tokens?: unknown;
  freeTokens?: unknown;
  shareableTokens?: unknown;
} | null | undefined;

function asNonNegativeInt(value: unknown) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.floor(amount));
}

export function calculateTokenCost(studentCount: number) {
  return studentCount * TOKENS_PER_STUDENT_FORM;
}

export function calculateTokenReload(amountPesos: number) {
  const baseTokens = Math.floor(amountPesos * TOKENS_PER_PESO);
  const bonusTokens = amountPesos > TOKEN_RELOAD_BONUS_THRESHOLD_PESOS
    ? Math.floor(baseTokens * TOKEN_RELOAD_BONUS_RATE)
    : 0;

  return {
    amountPesos,
    amountInCentavos: Math.round(amountPesos * 100),
    baseTokens,
    bonusTokens,
    totalTokens: baseTokens + bonusTokens,
    bonusPercent: bonusTokens > 0 ? 5 : 0,
  };
}

export function calculateAllowableStudentForms(availableTokens: number) {
  return Math.floor(availableTokens / TOKENS_PER_STUDENT_FORM);
}

export function readTokenBalances(wallet: WalletLike): TokenBalances {
  const tokens = asNonNegativeInt(wallet?.tokens);
  const storedShareable = asNonNegativeInt(wallet?.shareableTokens);
  const shareableTokens = Math.min(storedShareable, tokens);
  const storedFree = wallet?.freeTokens == null ? null : asNonNegativeInt(wallet.freeTokens);

  if (storedFree == null) {
    return {
      tokens,
      freeTokens: Math.max(0, tokens - shareableTokens),
      shareableTokens,
    };
  }

  const freeTokens = Math.min(storedFree, tokens);
  if (freeTokens + shareableTokens === tokens) {
    return { tokens, freeTokens, shareableTokens };
  }

  return {
    tokens,
    freeTokens: Math.max(0, tokens - shareableTokens),
    shareableTokens,
  };
}

export function tokenBalancesNeedRepair(wallet: WalletLike) {
  const balances = readTokenBalances(wallet);
  return (
    asNonNegativeInt(wallet?.tokens) !== balances.tokens ||
    asNonNegativeInt(wallet?.freeTokens) !== balances.freeTokens ||
    asNonNegativeInt(wallet?.shareableTokens) !== balances.shareableTokens ||
    wallet?.freeTokens == null
  );
}

export function withNormalizedTokenBalances<T extends Record<string, any>>(wallet: T | null | undefined) {
  const balances = readTokenBalances(wallet);
  return {
    ...(wallet || {}),
    tokens: balances.tokens,
    freeTokens: balances.freeTokens,
    shareableTokens: balances.shareableTokens,
  };
}

export function splitTokenSpend(freeTokens: number, shareableTokens: number, cost: number): TokenSpendSplit {
  const bronzeAvailable = asNonNegativeInt(freeTokens);
  const goldAvailable = asNonNegativeInt(shareableTokens);
  const amount = asNonNegativeInt(cost);
  const bronzeUsed = Math.min(bronzeAvailable, amount);
  const goldUsed = Math.min(goldAvailable, Math.max(0, amount - bronzeUsed));
  const covered = bronzeUsed + goldUsed;

  return {
    bronzeUsed,
    goldUsed,
    covered,
    uncovered: Math.max(0, amount - covered),
  };
}

export function applyTokenSpend(wallet: WalletLike, cost: number) {
  const balances = readTokenBalances(wallet);
  const spend = splitTokenSpend(balances.freeTokens, balances.shareableTokens, cost);
  if (spend.uncovered > 0) {
    throw new Error('Insufficient tokens.');
  }

  return {
    ...spend,
    next: {
      tokens: balances.tokens - spend.covered,
      freeTokens: balances.freeTokens - spend.bronzeUsed,
      shareableTokens: balances.shareableTokens - spend.goldUsed,
    } satisfies TokenBalances,
  };
}

export function creditFreeTokens(wallet: WalletLike, amount: number): TokenBalances {
  const balances = readTokenBalances(wallet);
  const credited = asNonNegativeInt(amount);
  return {
    tokens: balances.tokens + credited,
    freeTokens: balances.freeTokens + credited,
    shareableTokens: balances.shareableTokens,
  };
}

export function creditShareableTokens(wallet: WalletLike, amount: number): TokenBalances {
  const balances = readTokenBalances(wallet);
  const credited = asNonNegativeInt(amount);
  return {
    tokens: balances.tokens + credited,
    freeTokens: balances.freeTokens,
    shareableTokens: balances.shareableTokens + credited,
  };
}

export function generationRewardFromGoldSpend(previousGoldSpent: number, goldSpentNow: number) {
  const previous = asNonNegativeInt(previousGoldSpent);
  const spentNow = asNonNegativeInt(goldSpentNow);
  const nextGoldSpent = previous + spentNow;
  const previousMilestones = Math.floor(previous / GENERATION_REWARD_GOLD_INTERVAL_TOKENS);
  const nextMilestones = Math.floor(nextGoldSpent / GENERATION_REWARD_GOLD_INTERVAL_TOKENS);

  return {
    rewardTokens: Math.max(0, nextMilestones - previousMilestones) * GENERATION_REWARD_TOKENS,
    previousGoldSpent: previous,
    nextGoldSpent,
    goldPaidGenerations: Math.floor(nextGoldSpent / TOKENS_PER_STUDENT_FORM),
  };
}

export function reservationReleaseAmounts(reservation: {
  tokens?: unknown;
  bronzeTokens?: unknown;
  goldTokens?: unknown;
  freeTokens?: unknown;
  shareableTokens?: unknown;
}) {
  const tokens = asNonNegativeInt(reservation.tokens);
  const bronzeTokens = reservation.bronzeTokens ?? reservation.freeTokens;
  const goldTokens = reservation.goldTokens ?? reservation.shareableTokens;
  const hasSplit = bronzeTokens != null || goldTokens != null;

  if (!hasSplit) {
    return {
      tokens,
      freeTokens: tokens,
      shareableTokens: 0,
    };
  }

  return {
    tokens,
    freeTokens: asNonNegativeInt(bronzeTokens),
    shareableTokens: asNonNegativeInt(goldTokens),
  };
}
