/**
 * Umrah progress as a small state machine:
 *   ihram → tawaf 1..7 → sa'i 1..7 → halq/taqsir → complete (count + 1, reset)
 * Pure functions: they take the current state and return the next one or throw.
 */
const ROUNDS = 7;
const EMPTY = Object.freeze({ ihram: false, tawafRounds: 0, saiRounds: 0, halq: false });

const isFinished = (r) => r.ihram && r.tawafRounds === ROUNDS && r.saiRounds === ROUNDS && r.halq;

function applyRitualUpdate(current, body = {}) {
  const r = { ...current };

  if (body.action === 'complete') {
    if (!isFinished(r)) throw new Error('Finish all steps before marking this Umrah complete');
    return { ...r, ...EMPTY, completedUmrahs: (r.completedUmrahs || 0) + 1 };
  }
  if (body.action === 'reset') return { ...r, ...EMPTY };

  for (const key of ['tawafRounds', 'saiRounds']) {
    if (body[key] === undefined) continue;
    const v = Number(body[key]);
    if (!Number.isInteger(v) || v < 0 || v > ROUNDS) throw new Error(`${key} must be between 0 and ${ROUNDS}`);
    r[key] = v;
  }
  for (const key of ['ihram', 'halq']) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== 'boolean') throw new Error(`${key} must be true or false`);
    r[key] = body[key];
  }

  if (r.tawafRounds > 0 && !r.ihram) throw new Error('Enter ihram before Tawaf');
  if (r.saiRounds > 0 && r.tawafRounds < ROUNDS) throw new Error("Complete 7 rounds of Tawaf before Sa'i");
  if (r.halq && r.saiRounds < ROUNDS) throw new Error("Complete 7 rounds of Sa'i before Halq/Taqsir");
  return r;
}

module.exports = { ROUNDS, applyRitualUpdate, isFinished };
