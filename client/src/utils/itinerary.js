import { addDaysISO, nightsBetween, todayISO } from './format';

export const CITIES = ['Makkah', 'Madinah'];
export const MAX_STAYS = 6;
export const MODE_ICON = { train: '🚄', bus: '🚌', taxi: '🚗' };

/** One transfer per change of city, mirroring the server's rule. */
export function transfersNeeded(stays) {
  return stays.slice(1).flatMap((s, i) => (s.city !== stays[i].city ? [{ from: stays[i].city, to: s.city, date: s.checkIn }] : []));
}

/** Per-stay error key ('datesInvalid' | 'orderInvalid' | 'missing') or null. */
export function validateStays(stays) {
  const errors = stays.map((s, i) => {
    if (!s.checkIn || !s.checkOut) return 'missing';
    if (nightsBetween(s.checkIn, s.checkOut) < 1) return 'datesInvalid';
    if (i > 0 && stays[i - 1].checkOut && s.checkIn < stays[i - 1].checkOut) return 'orderInvalid';
    return null;
  });
  return { errors, ok: errors.every((e) => e === null) };
}

/** Price of a transport option for the whole group. */
export const groupCost = (option, people) =>
  option.pricing === 'perVehicle' ? Math.ceil(people / option.seats) * option.priceSAR : people * option.priceSAR;

/** Quick-start itineraries: back-to-back stays from `start` (default: 30 days from today). */
export function presetStays(cities, start = addDaysISO(todayISO(), 30)) {
  let day = start;
  return cities.map((city, i) => {
    const nights = cities.length === 1 ? 7 : i === 0 ? 4 : 6;
    const stay = { city, checkIn: day, checkOut: addDaysISO(day, nights), hotelId: '' };
    day = stay.checkOut;
    return stay;
  });
}

/** Next stay after the last one: the other city, starting on the last check-out. */
export function nextStay(last) {
  const checkIn = last.checkOut || '';
  return { city: last.city === 'Makkah' ? 'Madinah' : 'Makkah', checkIn, checkOut: checkIn ? addDaysISO(checkIn, 3) : '', hotelId: '' };
}
