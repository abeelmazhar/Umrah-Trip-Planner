import { useCallback, useEffect, useRef, useState } from 'react';
import api, { errorMessage } from '../api/client';

/**
 * GET a resource and keep it in state.
 *   const { data, setData, error, setError, loading, reload } = useFetch(`/trips/${id}`);
 * Pass `null` as the url to skip the request.
 * `loading` is only the first fetch. A later reload keeps the current screen.
 */
export default function useFetch(url, { params } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(Boolean(url));
  const hasData = useRef(false);
  const request = useRef(0);
  const key = JSON.stringify(params || null);

  const reload = useCallback(
    ({ silent = false } = {}) => {
      if (!url) {
        setLoading(false);
        return Promise.resolve();
      }
      const id = request.current + 1;
      request.current = id;
      if (!silent && !hasData.current) setLoading(true);
      return api
        .get(url, { params: JSON.parse(key) })
        .then((res) => {
          if (request.current !== id) return;
          hasData.current = true;
          setData(res.data);
          setError('');
          setStatus(res.status);
        })
        .catch((err) => {
          if (request.current !== id) return;
          setStatus(err.response?.status ?? null);
          if (!silent) setError(errorMessage(err));
        })
        .finally(() => {
          if (request.current === id) setLoading(false);
        });
    },
    [url, key]
  );

  useEffect(() => {
    hasData.current = false;
    setData(null);
    setError('');
    reload();
  }, [reload]);

  return { data, setData, error, setError, status, loading, reload };
}
