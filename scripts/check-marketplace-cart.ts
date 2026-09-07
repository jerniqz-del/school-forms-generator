import assert from 'node:assert/strict';
import { marketplaceCartTotal, uniqueCartProductIds } from '../src/lib/marketplace';

assert.deepEqual(uniqueCartProductIds(['a', 'a', 'b', '', 1, 'c']), ['a', 'b', 'c']);
assert.equal(marketplaceCartTotal([{ tokenPrice: 10 }, { tokenPrice: 5 }, { tokenPrice: 0 }]), 15);
assert.equal(marketplaceCartTotal([{ tokenPrice: 2.9 }]), 2);

console.log('marketplace cart checks passed');
