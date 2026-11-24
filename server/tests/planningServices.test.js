const { miqatFor } = require('../src/services/miqatService');
const { planBudget, summarizeExpenses } = require('../src/services/budgetService');
const { convertFromSAR, RATES } = require('../src/services/currencyService');
const { checkTravellers } = require('../src/services/documentService');

describe('miqatFor', () => {
  test('flying from Pakistan straight to Makkah: Yalamlam', () => {
    expect(miqatFor('south-asia', 'Makkah')).toMatchObject({ code: 'yalamlam', flying: true });
  });

  test('visiting Madinah first: Dhul Hulayfah regardless of origin', () => {
    expect(miqatFor('south-asia', 'Madinah')).toMatchObject({ code: 'dhulHulayfah', flying: false });
  });

  test('Gulf: Qarn al-Manazil; Europe: Al-Juhfah; Iraq: Dhat Irq', () => {
    expect(miqatFor('gulf-east', 'Makkah').code).toBe('qarnAlManazil');
    expect(miqatFor('north-west', 'Makkah').code).toBe('juhfah');
    expect(miqatFor('iraq-iran', 'Makkah').code).toBe('dhatIrq');
  });

  test('rejects unknown regions', () => {
    expect(() => miqatFor('mars', 'Makkah')).toThrow();
  });
});

describe('planBudget', () => {
  test('combines itinerary costs with per-person estimates', () => {
    const b = planBudget({
      people: 2,
      nights: 4,
      accommodationSAR: 5000,
      transportSAR: 320,
      budget: { flightsPerPersonSAR: 2000, visaPerPersonSAR: 500, foodPerPersonPerDaySAR: 100, ziyaratSAR: 300, shoppingSAR: 0 },
    });
    expect(b.days).toBe(5);
    expect(b.planned).toMatchObject({ flights: 4000, visa: 1000, food: 1000, ziyarat: 300, shopping: 0 });
    expect(b.totalSAR).toBe(5000 + 320 + 4000 + 1000 + 1000 + 300);
    expect(b.perPersonSAR).toBe(b.totalSAR / 2);
  });

  test('rejects negative estimates', () => {
    expect(() => planBudget({ people: 1, nights: 1, accommodationSAR: 0, transportSAR: 0, budget: { otherSAR: -5 } })).toThrow();
  });
});

describe('summarizeExpenses', () => {
  test('spent vs planned with overspend flag', () => {
    const s = summarizeExpenses(
      [
        { category: 'food', amountSAR: 60 },
        { category: 'food', amountSAR: 50 },
        { category: 'shopping', amountSAR: 20 },
      ],
      { food: 100, shopping: 500 }
    );
    const food = s.categories.find((c) => c.category === 'food');
    expect(food).toMatchObject({ spentSAR: 110, plannedSAR: 100, remainingSAR: -10, over: true });
    expect(s.totalSpentSAR).toBe(130);
    expect(s.remainingSAR).toBe(470);
  });
});

describe('convertFromSAR', () => {
  test('USD uses the official 3.75 peg', () => {
    expect(convertFromSAR(375, 'USD')).toBeCloseTo(100, 0);
  });

  test('every listed currency converts', () => {
    for (const c of Object.keys(RATES)) expect(convertFromSAR(100, c)).toBeGreaterThan(0);
  });

  test('rejects unsupported currencies', () => {
    expect(() => convertFromSAR(1, 'XYZ')).toThrow();
  });
});

describe('checkTravellers', () => {
  const trip = { startDate: '2026-12-01', people: 2 };

  test('valid passport and vaccine: no issues', () => {
    const r = checkTravellers([{ name: 'A', passportExpiry: '2028-01-01', meningitisVaccine: true }], { ...trip, people: 1 });
    expect(r).toEqual({ issues: [], ok: true });
  });

  test('passport valid for less than 6 months is an error', () => {
    const r = checkTravellers([{ name: 'A', passportExpiry: '2027-03-01', meningitisVaccine: true }], { ...trip, people: 1 });
    expect(r.ok).toBe(false);
    expect(r.issues[0]).toMatchObject({ code: 'passportUnder6Months', severity: 'error' });
  });

  test('expired passport, missing vaccine and missing travellers', () => {
    const r = checkTravellers([{ name: 'A', passportExpiry: '2026-11-01', meningitisVaccine: false }], trip);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['missingTravellers', 'passportExpired', 'vaccineMissing']));
  });
});
