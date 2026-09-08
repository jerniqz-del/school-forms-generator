import assert from 'node:assert/strict';
import {
  GENERATION_REWARD_GOLD_INTERVAL_TOKENS,
  GENERATION_REWARD_TOKENS,
  TOKENS_PER_STUDENT_FORM,
  applyTokenSpend,
  creditFreeTokens,
  creditShareableTokens,
  generationRewardFromGoldSpend,
  readTokenBalances,
  reservationReleaseAmounts,
  splitTokenSpend,
} from '../src/lib/tokens';

const derived = readTokenBalances({ tokens: 50, shareableTokens: 20 });
assert.deepEqual(derived, { tokens: 50, freeTokens: 30, shareableTokens: 20 });

const clamped = readTokenBalances({ tokens: 10, shareableTokens: 20 });
assert.deepEqual(clamped, { tokens: 10, freeTokens: 0, shareableTokens: 10 });

const spendAllBronze = splitTokenSpend(30, 20, 10);
assert.deepEqual(spendAllBronze, { bronzeUsed: 10, goldUsed: 0, covered: 10, uncovered: 0 });

const spendMixed = applyTokenSpend({ tokens: 50, freeTokens: 30, shareableTokens: 20 }, 40);
assert.equal(spendMixed.bronzeUsed, 30);
assert.equal(spendMixed.goldUsed, 10);
assert.deepEqual(spendMixed.next, { tokens: 10, freeTokens: 0, shareableTokens: 10 });

assert.throws(() => applyTokenSpend({ tokens: 5, freeTokens: 5, shareableTokens: 0 }, 10), /Insufficient tokens/);

const shortSpend = splitTokenSpend(5, 5, 20);
assert.deepEqual(shortSpend, { bronzeUsed: 5, goldUsed: 5, covered: 10, uncovered: 10 });

const afterReward = creditFreeTokens(spendMixed.next, 10);
assert.deepEqual(afterReward, { tokens: 20, freeTokens: 10, shareableTokens: 10 });

const afterReload = creditShareableTokens(afterReward, 20);
assert.deepEqual(afterReload, { tokens: 40, freeTokens: 10, shareableTokens: 30 });

const oldReservation = reservationReleaseAmounts({ tokens: 15 });
assert.deepEqual(oldReservation, { tokens: 15, freeTokens: 15, shareableTokens: 0 });

const splitReservation = reservationReleaseAmounts({ tokens: 40, bronzeTokens: 30, goldTokens: 10 });
assert.deepEqual(splitReservation, { tokens: 40, freeTokens: 30, shareableTokens: 10 });

assert.equal(GENERATION_REWARD_GOLD_INTERVAL_TOKENS, 50 * TOKENS_PER_STUDENT_FORM);

const bronzeOnlyReservation = reservationReleaseAmounts({ tokens: 250, bronzeTokens: 250, goldTokens: 0 });
const bronzeOnlyReward = generationRewardFromGoldSpend(0, bronzeOnlyReservation.shareableTokens);
assert.equal(bronzeOnlyReward.rewardTokens, 0);
assert.equal(bronzeOnlyReward.goldPaidGenerations, 0);

const goldPaidReservation = reservationReleaseAmounts({ tokens: 250, bronzeTokens: 0, goldTokens: 250 });
const exactlyFiftyGoldPaidForms = generationRewardFromGoldSpend(0, goldPaidReservation.shareableTokens);
assert.equal(exactlyFiftyGoldPaidForms.rewardTokens, GENERATION_REWARD_TOKENS);
assert.equal(exactlyFiftyGoldPaidForms.goldPaidGenerations, 50);
assert.equal(exactlyFiftyGoldPaidForms.nextGoldSpent, 250);

const mixedReservation = reservationReleaseAmounts({ tokens: 250, bronzeTokens: 30, goldTokens: 220 });
const mixedNoRewardYet = generationRewardFromGoldSpend(0, mixedReservation.shareableTokens);
assert.equal(mixedNoRewardYet.rewardTokens, 0);
assert.equal(mixedNoRewardYet.goldPaidGenerations, 44);

const oneTokenShort = generationRewardFromGoldSpend(0, GENERATION_REWARD_GOLD_INTERVAL_TOKENS - 1);
assert.equal(oneTokenShort.rewardTokens, 0);
assert.equal(oneTokenShort.goldPaidGenerations, 49);

const crossingMilestone = generationRewardFromGoldSpend(249, 1);
assert.equal(crossingMilestone.rewardTokens, GENERATION_REWARD_TOKENS);
assert.equal(crossingMilestone.goldPaidGenerations, 50);

const mixedBatchGoldOnly = generationRewardFromGoldSpend(0, 10);
assert.equal(mixedBatchGoldOnly.rewardTokens, 0);
assert.equal(mixedBatchGoldOnly.goldPaidGenerations, 2);

const twoMilestonesAtOnce = generationRewardFromGoldSpend(200, 300);
assert.equal(twoMilestonesAtOnce.rewardTokens, 20);
assert.equal(twoMilestonesAtOnce.nextGoldSpent, 500);
assert.equal(twoMilestonesAtOnce.goldPaidGenerations, 100);

const afterFirstReward = generationRewardFromGoldSpend(250, 250);
assert.equal(afterFirstReward.rewardTokens, GENERATION_REWARD_TOKENS);
assert.equal(afterFirstReward.goldPaidGenerations, 100);

console.log('token split checks passed');
