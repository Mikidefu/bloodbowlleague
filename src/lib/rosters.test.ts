import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ROSTERS, rosterTier } from '@/lib/rosters';

test('ogni Team Roster ha un tier da 1 a 4 (p. 156)', () => {
  for (const roster of ROSTERS) assert.ok([1, 2, 3, 4].includes(rosterTier(roster) as number), roster.key);
  assert.equal(rosterTier(null), null);
});
