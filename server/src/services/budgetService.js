const { round2 } = require('./costService');

const EXPENSE_CATEGORIES = ['accommodation', 'transport', 'flights', 'visa', 'food', 'ziyarat', 'shopping', 'other'];

/** Sensible starting estimates (SAR) a user can edit. */
const DEFAULT_BUDGET = {
  flightsPerPersonSAR: 0,
  visaPerPersonSAR: 0,
  foodPerPersonPerDaySAR: 100,
  ziyaratSAR: 300,
  shoppingSAR: 500,
  otherSAR: 0,
};

/**
 * Turns trip numbers + editable estimates into a planned budget per category.
 * Accommodation and transport come from the priced itinerary.
 */
function planBudget({ people, nights, accommodationSAR, transportSAR, budget = {} }) {
  const b = { ...DEFAULT_BUDGET, ...budget };
  for (const [k, v] of Object.entries(b)) {
    if (typeof v !== 'number' || Number.isNaN(v) || v < 0) throw new Error(`${k} must be a non-negative number`);
  }
  const days = nights + 1;
  const planned = {
    accommodation: round2(accommodationSAR),
    transport: round2(transportSAR),
    flights: round2(b.flightsPerPersonSAR * people),
    visa: round2(b.visaPerPersonSAR * people),
    food: round2(b.foodPerPersonPerDaySAR * people * days),
    ziyarat: round2(b.ziyaratSAR),
    shopping: round2(b.shoppingSAR),
    other: round2(b.otherSAR),
  };
  const totalSAR = round2(Object.values(planned).reduce((s, v) => s + v, 0));
  return { planned, totalSAR, perPersonSAR: round2(totalSAR / people), days };
}

/** Spent vs planned per category, plus overall. */
function summarizeExpenses(expenses = [], planned = {}) {
  const spent = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, 0]));
  for (const e of expenses) {
    if (spent[e.category] === undefined) continue;
    spent[e.category] = round2(spent[e.category] + e.amountSAR);
  }
  const categories = EXPENSE_CATEGORIES.map((c) => {
    const p = planned[c] || 0;
    return { category: c, plannedSAR: p, spentSAR: spent[c], remainingSAR: round2(p - spent[c]), over: spent[c] > p };
  });
  const totalSpentSAR = round2(Object.values(spent).reduce((s, v) => s + v, 0));
  const totalPlannedSAR = round2(Object.values(planned).reduce((s, v) => s + v, 0));
  return { categories, totalSpentSAR, totalPlannedSAR, remainingSAR: round2(totalPlannedSAR - totalSpentSAR) };
}

module.exports = { EXPENSE_CATEGORIES, DEFAULT_BUDGET, planBudget, summarizeExpenses };
