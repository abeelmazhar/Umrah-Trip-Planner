const { prayerTimes } = require('../src/services/prayerTimesService');
const { buildReminders, DEFAULT_PREFS } = require('../src/services/reminderService');
const { parsePrefs } = require('../src/services/notificationService');

const USER = 'user1';
const RIYADH_MS = 3 * 60 * 60 * 1000;

/** Clock time in Asia/Riyadh as a UTC Date. */
function atRiyadh(day, hour, minute) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour, minute) - RIYADH_MS);
}

function prefs(overrides = {}) {
  return {
    ...DEFAULT_PREFS,
    prayer: { ...DEFAULT_PREFS.prayer, prayers: [...DEFAULT_PREFS.prayer.prayers] },
    quietHours: { ...DEFAULT_PREFS.quietHours },
    ...overrides,
  };
}

function user(overrides) {
  return { _id: USER, notificationPrefs: prefs(overrides) };
}

const MEETING_AT = atRiyadh('2026-12-10', 21, 15); // 18:15Z

function meetingGroup(time = MEETING_AT, extra = {}) {
  return {
    _id: 'g1',
    leaderId: USER,
    members: [{ userId: USER, role: 'leader' }],
    meetingPoints: [
      { _id: 'p1', title: 'After Isha', place: 'Gate 79 (King Fahd Gate)', time, note: '', ...extra },
    ],
  };
}

function meetingsAt(now, group = meetingGroup()) {
  return buildReminders({ trip: null, user: user(), groups: [group], now });
}

describe('meeting reminders', () => {
  test('21:15 meeting is due only from 21:10 through 21:14', () => {
    expect(meetingsAt(atRiyadh('2026-12-10', 21, 9))).toEqual([]);
    [10, 12, 14].forEach((minute) => {
      const due = meetingsAt(atRiyadh('2026-12-10', 21, minute));
      expect(due).toHaveLength(1);
      expect(due[0].sendAt.toISOString()).toBe(atRiyadh('2026-12-10', 21, 10).toISOString());
    });
    expect(meetingsAt(atRiyadh('2026-12-10', 21, 16))).toEqual([]);

    const due = meetingsAt(atRiyadh('2026-12-10', 21, 10))[0];
    expect(due.title).toBe('Meeting in 5 minutes');
    expect(due.body).toBe('After Isha at Gate 79 (King Fahd Gate) · 21:15');
    expect(due.url).toBe('/groups/g1');
    expect(due.urgent).toBe(true);
    expect(due.tag).toBe(due.key);
    expect(due.key).toBe(`meeting:g1:p1:${MEETING_AT.toISOString()}:${USER}`);
  });

  test('includes the note when the leader wrote one', () => {
    const due = meetingsAt(atRiyadh('2026-12-10', 21, 10), meetingGroup(MEETING_AT, { note: 'Bring water' }));
    expect(due[0].body).toBe('After Isha at Gate 79 (King Fahd Gate) · 21:15 · Bring water');
  });

  test('a meeting point without a time produces nothing', () => {
    const group = meetingGroup();
    delete group.meetingPoints[0].time;
    expect(meetingsAt(atRiyadh('2026-12-10', 21, 10), group)).toEqual([]);
  });

  test('a meeting added 2 minutes before its time is sent immediately', () => {
    const due = meetingsAt(atRiyadh('2026-12-10', 21, 13));
    expect(due).toHaveLength(1);
    expect(due[0].sendAt.toISOString()).toBe(atRiyadh('2026-12-10', 21, 10).toISOString());
  });

  test('a meeting already in the past produces nothing', () => {
    expect(meetingsAt(atRiyadh('2026-12-10', 21, 15))).toEqual([]);
    expect(meetingsAt(atRiyadh('2026-12-10', 22, 0))).toEqual([]);
  });

  test('editing the meeting time changes the key, and deleting it removes the reminder', () => {
    const first = meetingsAt(atRiyadh('2026-12-10', 21, 10))[0].key;
    const editedTime = atRiyadh('2026-12-10', 22, 0);
    const second = meetingsAt(atRiyadh('2026-12-10', 21, 55), meetingGroup(editedTime))[0].key;
    expect(second).not.toBe(first);
    expect(second).toContain(editedTime.toISOString());

    const removed = meetingGroup();
    removed.meetingPoints = [];
    expect(meetingsAt(atRiyadh('2026-12-10', 21, 10), removed).map((r) => r.key)).not.toContain(first);
  });

  test('ignores a group the user does not belong to', () => {
    const group = meetingGroup();
    group.leaderId = 'someone-else';
    group.members = [{ userId: 'someone-else' }];
    expect(meetingsAt(atRiyadh('2026-12-10', 21, 10), group)).toEqual([]);
  });
});

function transferTrip(overrides = {}) {
  return {
    _id: 't1',
    ritual: { ihram: false },
    stays: [],
    transfers: [
      { _id: 'tr1', from: 'Madinah', to: 'Makkah', date: '2026-12-11', mode: 'train' },
    ],
    travellers: [],
    checklist: [],
    ...overrides,
  };
}

describe('transfer reminders', () => {
  const eve = atRiyadh('2026-12-10', 20, 0);
  const soon = atRiyadh('2026-12-11', 8, 0);

  test('evening before and 2 hours before, with ihram only when heading to Makkah without ihram', () => {
    const evening = buildReminders({ trip: transferTrip(), user: user(), groups: [], now: eve });
    expect(evening).toHaveLength(1);
    expect(evening[0].title).toBe('Travel tomorrow');
    expect(evening[0].body).toBe('Train to Makkah tomorrow 10:00. Wear ihram before boarding.');
    expect(evening[0].urgent).toBe(true);
    expect(evening[0].key).toContain('transfer-eve:t1:tr1:');

    const later = buildReminders({ trip: transferTrip(), user: user(), groups: [], now: soon });
    expect(later).toHaveLength(1);
    expect(later[0].title).toBe('Travel in 2 hours');
    expect(later[0].body).toBe('Train to Makkah at 10:00. Wear ihram before boarding.');
    expect(later[0].key).toContain('transfer-2h:');

    const ready = buildReminders({
      trip: transferTrip({ ritual: { ihram: true } }),
      user: user(),
      groups: [],
      now: eve,
    });
    expect(ready[0].body).toBe('Train to Makkah tomorrow 10:00.');

    const madinah = transferTrip();
    madinah.transfers[0].to = 'Madinah';
    const away = buildReminders({ trip: madinah, user: user(), groups: [], now: eve });
    expect(away[0].body).toBe('Train to Madinah tomorrow 10:00.');
  });

  test('outside the 15 minute window nothing is sent', () => {
    expect(buildReminders({ trip: transferTrip(), user: user(), groups: [], now: new Date(eve.getTime() - 60000) })).toEqual([]);
    expect(buildReminders({ trip: transferTrip(), user: user(), groups: [], now: new Date(eve.getTime() + 15 * 60000) })).toEqual([]);
  });
});

describe('check-out reminders', () => {
  const trip = {
    _id: 't1',
    stays: [{ _id: 's1', city: 'Makkah', hotelName: 'Swissotel Makkah', checkIn: '2026-12-10', checkOut: '2026-12-12' }],
    transfers: [],
    travellers: [],
    checklist: [],
  };

  test('20:00 the evening before and 09:00 on the day', () => {
    const eve = buildReminders({ trip, user: user(), groups: [], now: atRiyadh('2026-12-11', 20, 0) });
    expect(eve).toHaveLength(1);
    expect(eve[0].body).toBe('Check-out tomorrow from Swissotel Makkah, Makkah');
    const morning = buildReminders({ trip, user: user(), groups: [], now: atRiyadh('2026-12-12', 9, 0) });
    expect(morning).toHaveLength(1);
    expect(morning[0].body).toBe('Check-out today from Swissotel Makkah, Makkah');
    expect(morning[0].url).toBe('/trips/t1');
  });
});

describe('passport reminders', () => {
  function trip(expiry) {
    return {
      _id: 't1',
      startDate: '2026-12-10',
      endDate: '2026-12-20',
      stays: [],
      transfers: [],
      checklist: [],
      travellers: [{ _id: 'tv1', name: 'Aisha', passportExpiry: expiry }],
    };
  }

  test('warns once when the passport expires less than 6 months after the trip, and again 30 days before', () => {
    const short = buildReminders({ trip: trip('2027-03-01'), user: user(), groups: [], now: atRiyadh('2026-12-01', 9, 0) });
    expect(short).toHaveLength(1);
    expect(short[0].key).toContain('passport:t1:tv1:2027-03-01:');
    expect(short[0].body).toBe("Aisha's passport needs to be renewed before the trip.");
    expect(short[0].body).not.toContain('2027');

    const monthBefore = buildReminders({ trip: trip('2027-03-01'), user: user(), groups: [], now: atRiyadh('2026-11-10', 9, 0) });
    expect(monthBefore.map((r) => r.key).some((key) => key.startsWith('passport-30d:'))).toBe(true);
    expect(monthBefore.find((r) => r.key.startsWith('passport-30d:')).sendAt.toISOString()).toBe(atRiyadh('2026-11-10', 9, 0).toISOString());

    const longEnough = buildReminders({ trip: trip('2027-08-01'), user: user(), groups: [], now: atRiyadh('2026-12-01', 9, 0) });
    expect(longEnough).toEqual([]);
  });
});

describe('Nusuk permit reminders', () => {
  function trip(done) {
    return {
      _id: 't1',
      startDate: '2026-12-17',
      stays: [],
      transfers: [],
      travellers: [],
      checklist: [{ title: 'nusukPermit', done }],
    };
  }

  test('daily at 09:00 from 7 days before start, only while the item is not done', () => {
    const open = buildReminders({ trip: trip(false), user: user(), groups: [], now: atRiyadh('2026-12-10', 9, 0) });
    expect(open).toHaveLength(1);
    expect(open[0].key).toBe(`nusuk:t1:2026-12-10:${USER}`);
    expect(open[0].body).toContain('Nusuk');

    expect(buildReminders({ trip: trip(true), user: user(), groups: [], now: atRiyadh('2026-12-10', 9, 0) })).toEqual([]);
    expect(buildReminders({ trip: trip(false), user: user(), groups: [], now: atRiyadh('2026-12-09', 9, 0) })).toEqual([]);
    expect(buildReminders({ trip: trip(false), user: user(), groups: [], now: atRiyadh('2026-12-10', 9, 14) })).toHaveLength(1);
    expect(buildReminders({ trip: trip(false), user: user(), groups: [], now: atRiyadh('2026-12-10', 9, 15) })).toEqual([]);
  });
});

describe('prayer reminders', () => {
  test('only on days the user is in that city', () => {
    const day = '2026-06-15';
    const makkah = prayerTimes('Makkah', day);
    const [hour, minute] = makkah.times.fajr.split(':').map(Number);
    const now = new Date(atRiyadh(day, hour, minute).getTime() - 15 * 60000);
    const trip = {
      _id: 't1',
      stays: [
        { city: 'Makkah', checkIn: '2026-06-15', checkOut: '2026-06-16', hotelName: 'H' },
        { city: 'Madinah', checkIn: '2026-06-16', checkOut: '2026-06-18', hotelName: 'H2' },
      ],
      transfers: [],
      travellers: [],
      checklist: [],
    };
    const prayerUser = user({
      prayer: { enabled: true, minutesBefore: 15, prayers: ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] },
      transfers: false,
      checkOut: false,
      passport: false,
      nusukPermit: false,
      meetingPoints: false,
    });
    const due = buildReminders({ trip, user: prayerUser, groups: [], now });
    expect(due).toHaveLength(1);
    expect(due[0].title).toBe('Fajr in 15 minutes');
    expect(due[0].body).toBe(`${makkah.times.fajr} in Makkah`);

    const next = '2026-06-16';
    const madinah = prayerTimes('Madinah', next);
    const [h2, m2] = madinah.times.fajr.split(':').map(Number);
    const now2 = new Date(atRiyadh(next, h2, m2).getTime() - 15 * 60000);
    const due2 = buildReminders({ trip, user: prayerUser, groups: [], now: now2 });
    expect(due2).toHaveLength(1);
    expect(due2[0].body).toBe(`${madinah.times.fajr} in Madinah`);
  });
});

describe('preferences and quiet hours', () => {
  test('turning reminders off produces nothing', () => {
    expect(meetingsAt(atRiyadh('2026-12-10', 21, 10)).length).toBe(1);
    const due = buildReminders({
      trip: null,
      user: user({ enabled: false }),
      groups: [meetingGroup()],
      now: atRiyadh('2026-12-10', 21, 10),
    });
    expect(due).toEqual([]);
  });

  test('a disabled meeting preference drops meetings only', () => {
    const trip = transferTrip();
    const now = atRiyadh('2026-12-10', 20, 0);
    const group = meetingGroup(atRiyadh('2026-12-10', 20, 3));
    const due = buildReminders({ trip, user: user({ meetingPoints: false }), groups: [group], now });
    expect(due.map((r) => r.kind)).toEqual(['transfer']);
  });

  test('quiet hours skip passport and check-out but never meeting, transfer or Fajr', () => {
    const now = atRiyadh('2026-12-11', 20, 0);
    const trip = {
      ...transferTrip(),
      endDate: '2026-12-20',
      stays: [{ _id: 's1', city: 'Makkah', hotelName: 'Swissotel', checkIn: '2026-12-10', checkOut: '2026-12-12' }],
      travellers: [{ _id: 'tv1', name: 'Aisha', passportExpiry: '2027-03-01' }],
    };
    // Evening-before transfer for a Dec 12 departure is 20:00 on Dec 11 — this `now`.
    trip.transfers[0].date = '2026-12-12';
    const group = meetingGroup(atRiyadh('2026-12-11', 20, 4));
    const due = buildReminders({
      trip,
      user: user({ quietHours: { enabled: true, start: '19:00', end: '21:00' } }),
      groups: [group],
      now,
    });
    const kinds = due.map((r) => r.kind).sort();
    expect(kinds).toEqual(['meeting', 'transfer']);

    const morning = atRiyadh('2026-12-12', 9, 0);
    const checkout = buildReminders({
      trip,
      user: user({ quietHours: { enabled: true, start: '08:00', end: '10:00' }, transfers: false, passport: false }),
      groups: [meetingGroup(atRiyadh('2026-12-12', 9, 3))],
      now: morning,
    });
    expect(checkout.map((r) => r.kind)).toEqual(['meeting']);

    const day = '2026-06-15';
    const fajr = prayerTimes('Makkah', day);
    const [hour, minute] = fajr.times.fajr.split(':').map(Number);
    const fajrNow = new Date(atRiyadh(day, hour, minute).getTime() - 15 * 60000);
    const fajrTrip = {
      _id: 't1',
      endDate: '2026-06-20',
      stays: [{ city: 'Makkah', checkIn: day, checkOut: '2026-06-16', hotelName: 'H' }],
      transfers: [],
      checklist: [],
      travellers: [{ name: 'Aisha', passportExpiry: '2026-08-01' }],
    };
    const kept = buildReminders({
      trip: fajrTrip,
      user: user({
        prayer: { enabled: true, minutesBefore: 15, prayers: ['fajr'] },
        quietHours: { enabled: true, start: '00:00', end: '12:00' },
        transfers: false,
        checkOut: false,
        meetingPoints: false,
      }),
      groups: [],
      now: fajrNow,
    });
    expect(kept.map((r) => r.kind)).toEqual(['prayer']);
  });
});

describe('parsePrefs', () => {
  test('fills defaults and accepts a partial update', () => {
    expect(parsePrefs({})).toEqual(DEFAULT_PREFS);
    const next = parsePrefs({ transfers: false, prayer: { enabled: true, minutesBefore: 10 } });
    expect(next.transfers).toBe(false);
    expect(next.prayer).toEqual({ enabled: true, minutesBefore: 10, prayers: DEFAULT_PREFS.prayer.prayers });
    expect(next.checkOut).toBe(true);
  });

  test('rejects bad prayer and quiet-hour input', () => {
    expect(() => parsePrefs({ prayer: { minutesBefore: 15.5 } })).toThrow(/minutesBefore/);
    expect(() => parsePrefs({ prayer: { prayers: ['sunrise'] } })).toThrow(/prayers/);
    expect(() => parsePrefs({ quietHours: { start: '25:00' } })).toThrow(/quietHours.start/);
    expect(() => parsePrefs({ enabled: 'yes' })).toThrow(/enabled/);
  });
});
