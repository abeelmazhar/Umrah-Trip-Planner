// Default Umrah checklist. Titles are stable keys the client translates (see client i18n "checklist.*").
const DEFAULT_CHECKLIST = [
  'passportValid',
  'umrahVisa',
  'flightsBooked',
  'vaccinations',
  'nusukPermit',
  'ihramClothing',
  'learnRituals',
  'travelInsurance',
  'currencySAR',
  'comfortableSandals',
  'medications',
  'duaBook',
];

function defaultChecklist() {
  return DEFAULT_CHECKLIST.map((title) => ({ title, done: false }));
}

module.exports = { DEFAULT_CHECKLIST, defaultChecklist };
