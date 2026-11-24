/**
 * Travel-document checks for each traveller.
 * Saudi Arabia requires a passport valid for at least 6 months from the date
 * of entry, and Umrah pilgrims need a meningitis (ACYW) vaccination certificate.
 * We deliberately store only the passport EXPIRY date, never the passport number.
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addMonths(date, months) {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/**
 * @returns {{ issues: Array<{ traveller: number|null, code: string, severity: 'error'|'warning' }>, ok: boolean }}
 */
function checkTravellers(travellers = [], { startDate, people }) {
  const issues = [];
  const start = new Date(startDate);

  if (people && travellers.length < people) {
    issues.push({ traveller: null, code: 'missingTravellers', severity: 'warning', count: people - travellers.length });
  }

  travellers.forEach((t, i) => {
    if (!t.passportExpiry) {
      issues.push({ traveller: i, code: 'passportExpiryMissing', severity: 'warning' });
    } else {
      const expiry = new Date(t.passportExpiry);
      if (expiry < start) {
        issues.push({ traveller: i, code: 'passportExpired', severity: 'error' });
      } else if (expiry < addMonths(start, 6)) {
        const daysLeft = Math.round((expiry - start) / MS_PER_DAY);
        issues.push({ traveller: i, code: 'passportUnder6Months', severity: 'error', daysLeft });
      }
    }
    if (!t.meningitisVaccine) {
      issues.push({ traveller: i, code: 'vaccineMissing', severity: 'warning' });
    }
  });

  return { issues, ok: !issues.some((x) => x.severity === 'error') };
}

module.exports = { checkTravellers };
