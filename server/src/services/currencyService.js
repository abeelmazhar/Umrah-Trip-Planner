/**
 * Approximate exchange rates: how much 1 SAR is worth in each currency.
 * The riyal is pegged to the US dollar at 3.75, so USD is exact; the others
 * are reference values for planning only. Update RATES_AS_OF when you change them.
 */
const RATES_AS_OF = '2026-11';
const RATES = {
  SAR: 1,
  USD: 0.2667,
  PKR: 74.5,
  INR: 23.1,
  BDT: 32.5,
  IDR: 4350,
  MYR: 1.16,
  GBP: 0.205,
  EUR: 0.235,
  TRY: 11.2,
  EGP: 13.1,
  AED: 0.979,
};

function convertFromSAR(amountSAR, currency) {
  const rate = RATES[currency];
  if (!rate) throw new Error(`Unsupported currency: ${currency}`);
  return Math.round(amountSAR * rate * 100) / 100;
}

module.exports = { RATES, RATES_AS_OF, convertFromSAR };
