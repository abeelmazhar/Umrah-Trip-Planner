import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** Renders `value` as a QR code image (generated in the browser, no external service). */
export default function QrCode({ value, size = 160, label }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(value, { width: size * 2, margin: 1, color: { dark: '#0a3622', light: '#ffffff' } })
      .then(setSrc)
      .catch(() => setSrc(''));
  }, [value, size]);
  return src ? <img src={src} width={size} height={size} alt={label || value} className="rounded-lg bg-white" /> : null;
}
