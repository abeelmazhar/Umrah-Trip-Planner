const seedHotels = require('../data/hotels');

const byName = new Map(seedHotels.map((h) => [h.name, h]));

/**
 * Hotel as a plain object with Arabic labels filled in.
 * Databases seeded before Arabic labels existed fall back to the seed data (matched by name),
 * so no migration is needed.
 */
function localizeHotel(hotel) {
  if (!hotel) return null;
  const h = typeof hotel.toObject === 'function' ? hotel.toObject() : { ...hotel };
  const seed = byName.get(h.name);
  return { ...h, nameAr: h.nameAr || seed?.nameAr || h.name, addressAr: h.addressAr || seed?.addressAr || '' };
}

module.exports = { localizeHotel };
