import assert from 'node:assert/strict';
import {
  applyTokenSpend,
  creditFreeTokens,
  creditShareableTokens,
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

const afterReward = creditFreeTokens(spendMixed.next, 10);
assert.deepEqual(afterReward, { tokens: 20, freeTokens: 10, shareableTokens: 10 });

const afterReload = creditShareableTokens(afterReward, 20);
assert.deepEqual(afterReload, { tokens: 40, freeTokens: 10, shareableTokens: 30 });

const oldReservation = reservationReleaseAmounts({ tokens: 15 });
assert.deepEqual(oldReservation, { tokens: 15, freeTokens: 15, shareableTokens: 0 });

const splitReservation = reservationReleaseAmounts({ tokens: 40, bronzeTokens: 30, goldTokens: 10 });
assert.deepEqual(splitReservation, { tokens: 40, freeTokens: 30, shareableTokens: 10 });

console.log('token split checks passed');
