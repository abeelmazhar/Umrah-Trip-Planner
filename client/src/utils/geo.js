/** Great-circle distance in metres (haversine). */
export function distanceMeters(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m, lang) {
  const nf = (n, digits) => new Intl.NumberFormat(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en', { maximumFractionDigits: digits }).format(n);
  return m < 1000 ? `${nf(Math.round(m / 10) * 10, 0)} ${lang === 'ar' ? 'م' : 'm'}` : `${nf(m / 1000, 1)} ${lang === 'ar' ? 'كم' : 'km'}`;
}

/** "3 minutes ago" / "قبل ٣ دقائق" */
export function timeAgo(date, lang) {
  const rtf = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en', { numeric: 'auto' });
  const sec = Math.round((new Date(date) - Date.now()) / 1000);
  if (Math.abs(sec) < 60) return rtf.format(sec, 'second');
  if (Math.abs(sec) < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  return rtf.format(Math.round(sec / 3600), 'hour');
}

export const mapsUrl = ({ lat, lng }) => `https://www.google.com/maps?q=${lat},${lng}`;

/** Promise wrapper around navigator.geolocation. */
export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(Object.assign(new Error('unavailable'), { code: 'unavailable' }));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (err) => reject(Object.assign(new Error(err.message), { code: err.code === 1 ? 'denied' : 'unavailable' })),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  });
}
