// Tiny Jest-style expect() on top of node:assert, so the integration tests read the same as the unit tests.
const assert = require('node:assert/strict');

function matches(actual, expected) {
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    return Object.entries(expected).every(([k, v]) => matches(actual?.[k], v));
  }
  try {
    assert.deepStrictEqual(actual, expected);
    return true;
  } catch {
    return false;
  }
}

function expect(actual) {
  return {
    toBe: (v) => assert.strictEqual(actual, v),
    toEqual: (v) => {
      if (v && v.__arrayContaining) return assert.ok(v.items.every((i) => actual.includes(i)), `${JSON.stringify(actual)} should contain ${v.items}`);
      return assert.deepStrictEqual(actual, v);
    },
    toMatch: (re) => assert.match(actual, re),
    toHaveLength: (n) => assert.strictEqual(actual.length, n),
    toBeUndefined: () => assert.strictEqual(actual, undefined),
    toBeCloseTo: (v, digits = 2) => assert.ok(Math.abs(actual - v) < 10 ** -digits / 2, `${actual} ≈ ${v}`),
    toBeGreaterThan: (v) => assert.ok(actual > v, `${actual} > ${v}`),
    toMatchObject: (v) => assert.ok(matches(actual, v), `${JSON.stringify(actual)} should match ${JSON.stringify(v)}`),
  };
}
expect.arrayContaining = (items) => ({ __arrayContaining: true, items });

module.exports = { expect };
