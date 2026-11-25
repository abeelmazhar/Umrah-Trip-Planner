const g = require('../src/services/groupService');

const NOW = new Date('2026-12-01T12:00:00Z');
const minutes = (n) => new Date(NOW.getTime() + n * 60000);

describe('join codes', () => {
  test('6 characters from an unambiguous alphabet', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = g.generateCode();
      expect(code).toMatch(/^[A-Z2-9]{6}$/);
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  test('deterministic with a fixed random source', () => {
    expect(g.generateCode(() => Buffer.from([0, 1, 2, 3, 4, 5]))).toBe('ABCDEF');
  });

  test('normalizes what people type', () => {
    expect(g.normalizeCode(' abc-23 4 ')).toBe('ABC234');
    expect(g.normalizeCode(undefined)).toBe('');
  });
});

describe('parsePhone', () => {
  test('accepts international formats and empty values', () => {
    expect(g.parsePhone('+966  50 123 4567')).toBe('+966 50 123 4567');
    expect(g.parsePhone('0300-1234567')).toBe('0300-1234567');
    expect(g.parsePhone('')).toBe('');
    expect(g.parsePhone(undefined)).toBe('');
  });

  test('rejects letters and wrong lengths', () => {
    expect(() => g.parsePhone('call me')).toThrow();
    expect(() => g.parsePhone('12345')).toThrow();
    expect(() => g.parsePhone('+1234567890123456')).toThrow();
  });
});

describe('location sharing', () => {
  const member = (until, updatedAt = NOW) => ({ sharingUntil: until, location: { lat: 21.42, lng: 39.82, accuracy: 12, updatedAt } });

  test('parseLocation validates coordinates', () => {
    expect(g.parseLocation({ lat: '21.4225', lng: 39.8262, accuracy: 9.6 })).toEqual({ lat: 21.4225, lng: 39.8262, accuracy: 10 });
    expect(() => g.parseLocation({ lat: 95, lng: 0 })).toThrow();
    expect(() => g.parseLocation({ lat: 'x', lng: 0 })).toThrow();
  });

  test('only fixed sharing durations', () => {
    expect(g.parseShareMinutes(30)).toBe(30);
    expect(() => g.parseShareMinutes(1000)).toThrow();
  });

  test('visible only while sharing is active', () => {
    expect(g.locationView(member(minutes(10)), NOW)).toMatchObject({ lat: 21.42, stale: false });
    expect(g.locationView(member(minutes(-1)), NOW)).toBeNull();
    expect(g.locationView({ sharingUntil: minutes(10) }, NOW)).toBeNull();
  });

  test('marks positions older than 5 minutes as stale', () => {
    expect(g.locationView(member(minutes(10), minutes(-6)), NOW).stale).toBe(true);
  });
});

describe('meeting points', () => {
  test('requires a title and a place', () => {
    expect(() => g.parseMeetingPoint({ title: 'After Isha' })).toThrow();
    expect(g.parseMeetingPoint({ title: ' After Isha ', place: 'Gate 79' })).toEqual({ title: 'After Isha', place: 'Gate 79', note: '' });
  });

  test('upcoming first, then undated, then past', () => {
    const points = [
      { title: 'past', time: minutes(-60) },
      { title: 'later', time: minutes(120) },
      { title: 'any time' },
      { title: 'soon', time: minutes(30) },
    ];
    expect(g.sortMeetingPoints(points, NOW).map((p) => p.title)).toEqual(['soon', 'later', 'any time', 'past']);
  });
});

describe('buildLostCard', () => {
  test('combines member, leader, hotel and next meeting point', () => {
    const card = g.buildLostCard({
      group: { name: 'Family', leaderPhone: '+966 50 000 0000', meetingPoints: [{ title: 'Meet', place: 'Gate 79', time: minutes(30) }] },
      member: { displayName: 'Ahmed', phone: '', cardToken: 'abc' },
      leader: { displayName: 'Bilal', phone: '' },
      hotel: { name: 'Swissotel Makkah', nameAr: 'فندق سويس أوتيل مكة', addressAr: 'أبراج البيت', city: 'Makkah' },
      now: NOW,
    });
    expect(card).toMatchObject({
      name: 'Ahmed',
      groupName: 'Family',
      leader: { name: 'Bilal', phone: '+966 50 000 0000' },
      hotel: { nameAr: 'فندق سويس أوتيل مكة', city: 'Makkah' },
      meetingPoint: { place: 'Gate 79' },
    });
  });

  test('works without a hotel or meeting points', () => {
    const card = g.buildLostCard({ group: { name: 'G', meetingPoints: [] }, member: { displayName: 'A' }, leader: null, now: NOW });
    expect(card.hotel).toBeNull();
    expect(card.meetingPoint).toBeNull();
  });
});
