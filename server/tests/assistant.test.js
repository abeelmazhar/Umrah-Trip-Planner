const { prayerTimes } = require('../src/services/prayerTimesService');
const { SYSTEM_PROMPT, buildTripContext } = require('../src/services/assistantPrompt');
const {
  validateQuestion,
  trimHistory,
  riyadhDay,
  buildRequest,
  DEFAULT_MODEL,
} = require('../src/services/assistantService');
const { atRiyadh } = require('../src/utils/riyadh');

function turn(role, content) {
  return { role, content };
}

const hotelsById = {
  h1: { name: 'Pullman Zamzam Madinah', distanceToHaramM: 250 },
  h2: { name: 'Swissotel Makkah', distanceToHaramM: 120 },
};

function sampleTrip() {
  return {
    people: 3,
    startDate: '2026-12-24',
    endDate: '2027-01-03',
    stays: [
      { city: 'Madinah', hotelId: 'h1', checkIn: '2026-12-24', checkOut: '2026-12-28' },
      { city: 'Makkah', hotelId: 'h2', checkIn: '2026-12-28', checkOut: '2027-01-03' },
    ],
    transfers: [{ from: 'Madinah', to: 'Makkah', date: '2026-12-28', mode: 'train' }],
    ritual: { ihram: true, tawafRounds: 3, saiRounds: 0 },
    travellers: [{ name: 'Aisha Khan', passportExpiry: new Date('2030-06-01'), phone: '0500000000', email: 'aisha@example.com' }],
  };
}

describe('assistant prompt', () => {
  test('buildTripContext uses the city for today and that city\'s prayer times', () => {
    const madinah = buildTripContext({
      trip: sampleTrip(),
      hotelsById,
      appLanguage: 'en',
      now: atRiyadh('2026-12-25', 14, 5),
    });
    const times = prayerTimes('Madinah', '2026-12-25').times;
    expect(madinah).toMatch(/Today the user is in: Madinah/);
    expect(madinah).toMatch(/Pullman Zamzam Madinah \(250 m from the Haram\)/);
    expect(madinah).toContain(`Prayer times today in Madinah: Fajr ${times.fajr}`);
    expect(madinah).toMatch(/Umrah progress: ihram yes, Tawaf 3\/7, Sa'i 0\/7/);

    const makkah = buildTripContext({
      trip: sampleTrip(),
      hotelsById,
      appLanguage: 'en',
      now: atRiyadh('2026-12-28', 14, 5),
    });
    expect(makkah).toMatch(/Today the user is in: Makkah/);
    expect(makkah).toMatch(/Swissotel Makkah \(120 m from the Haram\)/);
    expect(makkah).toMatch(/Prayer times today in Makkah:/);
  });

  test('buildTripContext leaves out traveller names and passport dates', () => {
    const text = buildTripContext({
      trip: sampleTrip(),
      hotelsById,
      appLanguage: 'en',
      now: atRiyadh('2026-12-25', 14, 5),
    });
    expect(text).not.toMatch(/Aisha Khan/);
    expect(text).not.toMatch(/2030-06-01/);
    expect(text).not.toMatch(/0500000000/);
    expect(text).not.toMatch(/aisha@example.com/);
  });

  test('buildTripContext without a trip is only the language and the date', () => {
    const text = buildTripContext({ appLanguage: 'ur', now: atRiyadh('2026-12-25', 14, 5) });
    expect(text).toBe('App language: ur\nToday (Saudi time): Friday 2026-12-25 14:05');
  });

  test('SYSTEM_PROMPT is a constant with no date and no user data', () => {
    expect(SYSTEM_PROMPT).toBe(SYSTEM_PROMPT);
    expect(SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(SYSTEM_PROMPT).not.toMatch(/@/);
    expect(SYSTEM_PROMPT).toMatch(/as a fatwa/i);
    expect(SYSTEM_PROMPT).toMatch(/911/);
  });
});

describe('assistant chat rules', () => {
  test('trimHistory keeps the newest 20, starts with user, and alternates', () => {
    const many = Array.from({ length: 25 }, (_, i) => turn(i % 2 === 0 ? 'user' : 'assistant', String(i)));
    const exact = Array.from({ length: 20 }, (_, i) => turn(i % 2 === 0 ? 'user' : 'assistant', String(i)));
    expect(trimHistory(exact)).toHaveLength(20);
    expect(trimHistory(exact)[0].role).toBe('user');

    const trimmed = trimHistory(many);
    expect(trimmed.length).toBeLessThanOrEqual(20);
    expect(trimmed).toHaveLength(19);
    expect(trimmed[0]).toEqual({ role: 'user', content: '6' });
    trimmed.forEach((message, index) => {
      if (index === 0) return;
      expect(message.role).not.toBe(trimmed[index - 1].role);
    });

    const startsWithAssistant = trimHistory(many.slice(1));
    expect(startsWithAssistant[0].role).toBe('user');

    const merged = trimHistory([
      turn('user', 'a'),
      turn('user', 'b'),
      turn('assistant', 'c'),
      turn('assistant', 'd'),
    ]);
    expect(merged).toEqual([
      { role: 'user', content: 'a\nb' },
      { role: 'assistant', content: 'c\nd' },
    ]);
  });

  test('validateQuestion rejects empty and too-long text', () => {
    expect(validateQuestion('  Where is the Haram?  ')).toBe('Where is the Haram?');
    expect(() => validateQuestion(' ')).toThrow('Question must be between 2 and 1000 characters');
    expect(() => validateQuestion('a'.repeat(1001))).toThrow('Question must be between 2 and 1000 characters');
  });

  test('riyadhDay treats 23:30 UTC on 1 Jan as 2 Jan in Riyadh', () => {
    expect(riyadhDay(new Date('2026-01-01T23:30:00Z'))).toBe('2026-01-02');
  });

  test('buildRequest sends one system message and omits sampling keys', () => {
    const params = buildRequest({
      system: SYSTEM_PROMPT,
      context: 'App language: en',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    expect(params.model).toBe(DEFAULT_MODEL);
    expect(params.model).toBe('anthropic/claude-opus-5.5');
    expect(params.max_tokens).toBe(4096);
    expect(params.messages[0].role).toBe('system');
    expect(params.messages[0].content).toContain(SYSTEM_PROMPT);
    expect(params.messages[0].content).toContain('<trip_context>');
    expect(params.messages[1]).toEqual({ role: 'user', content: 'Hi' });
    expect(params.temperature).toBeUndefined();
    expect(params.top_p).toBeUndefined();
    expect(params.top_k).toBeUndefined();
  });
});
