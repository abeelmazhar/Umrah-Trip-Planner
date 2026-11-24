import { useEffect, useState } from 'react';
import api from '../api/client';

// Options shared by many screens (transport prices, regions, currencies…). Loaded once per page load.
let cache = null;
let pending = null;

export default function useMeta() {
  const [meta, setMeta] = useState(cache);
  useEffect(() => {
    if (cache) return;
    pending = pending || api.get('/meta').then((r) => (cache = r.data));
    pending.then(setMeta).catch(() => {
      pending = null;
    });
  }, []);
  return meta;
}
