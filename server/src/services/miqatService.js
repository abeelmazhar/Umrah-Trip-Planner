/**
 * Miqat guidance: the boundary where pilgrims must be in ihram before entering
 * the Haram area for Umrah. Which miqat applies depends on the direction you come from.
 * These are the five classical miqats; the guidance is general and pilgrims should
 * confirm with their scholar, group leader or airline announcement.
 */
const MIQATS = {
  dhulHulayfah: { name: 'Dhul Hulayfah (Abyar Ali)', nameAr: 'ذو الحليفة (أبيار علي)', distanceToMakkahKm: 420 },
  juhfah: { name: 'Al-Juhfah (near Rabigh)', nameAr: 'الجحفة (رابغ)', distanceToMakkahKm: 186 },
  qarnAlManazil: { name: 'Qarn al-Manazil (As-Sail al-Kabir)', nameAr: 'قرن المنازل (السيل الكبير)', distanceToMakkahKm: 75 },
  yalamlam: { name: 'Yalamlam (As-Sa’diyyah)', nameAr: 'يلملم (السعدية)', distanceToMakkahKm: 100 },
  dhatIrq: { name: 'Dhat Irq', nameAr: 'ذات عرق', distanceToMakkahKm: 100 },
};

/** Where pilgrims fly in from, and the miqat their flight path usually crosses. */
const ORIGIN_REGIONS = {
  'south-asia': { miqat: 'yalamlam', examples: 'Pakistan, India, Bangladesh, Sri Lanka' },
  'south-east-asia': { miqat: 'yalamlam', examples: 'Indonesia, Malaysia, Singapore' },
  'gulf-east': { miqat: 'qarnAlManazil', examples: 'UAE, Qatar, Kuwait, Bahrain, Oman, Riyadh' },
  'iraq-iran': { miqat: 'dhatIrq', examples: 'Iraq, Iran' },
  'north-west': { miqat: 'juhfah', examples: 'Egypt, Levant, Turkey, Europe, North Africa, Americas' },
  'africa-south': { miqat: 'yalamlam', examples: 'Yemen, East and South Africa' },
};

/**
 * @param originRegion one of ORIGIN_REGIONS keys
 * @param firstCity    first city of the itinerary ("Makkah" | "Madinah")
 * @returns {{ code, name, nameAr, distanceToMakkahKm, reason, flying }}
 */
function miqatFor(originRegion, firstCity) {
  if (firstCity === 'Madinah') {
    return { code: 'dhulHulayfah', ...MIQATS.dhulHulayfah, reason: 'fromMadinah', flying: false };
  }
  const region = ORIGIN_REGIONS[originRegion];
  if (!region) throw new Error(`originRegion must be one of: ${Object.keys(ORIGIN_REGIONS).join(', ')}`);
  return { code: region.miqat, ...MIQATS[region.miqat], reason: 'flyingIn', flying: true };
}

module.exports = { MIQATS, ORIGIN_REGIONS, miqatFor };
