const { DEFAULT_CHECKLIST, defaultChecklist } = require('../src/services/checklistService');

describe('defaultChecklist', () => {
  test('returns every default item, none done', () => {
    const list = defaultChecklist();
    expect(list).toHaveLength(DEFAULT_CHECKLIST.length);
    expect(list.every((i) => i.done === false)).toBe(true);
    expect(list.map((i) => i.title)).toContain('ihramClothing');
  });

  test('returns a fresh array each time', () => {
    const a = defaultChecklist();
    a[0].done = true;
    expect(defaultChecklist()[0].done).toBe(false);
  });
});
