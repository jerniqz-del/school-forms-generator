export const FREE_SIGNUP_TOKENS = 25;
export const TOKENS_PER_STUDENT_FORM = 5;
export const TOKEN_RELOAD_MIN_PESOS = 20;
export const TOKENS_PER_PESO = 2.5;
export const TOKEN_RELOAD_BONUS_THRESHOLD_PESOS = 100;
export const TOKEN_RELOAD_BONUS_RATE = 0.05;
export const REFERRAL_REWARD_TOKENS = 20;
export const GENERATION_REWARD_INTERVAL = 50;
export const GENERATION_REWARD_TOKENS = 10;

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
