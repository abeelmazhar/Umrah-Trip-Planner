import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api/client';

/**
 * GET a resource and keep it in state.
 *   const { data, setData, error, setError, loading, reload } = useFetch(`/trips/${id}`);
 * Pass `null` as the url to skip the request.
 */
export default function useFetch(url, { params } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(Boolean(url));
  const key = JSON.stringify(params || null);

  const reload = useCallback(
    ({ silent = false } = {}) => {
      if (!url) return Promise.resolve();
      if (!silent) setLoading(true);
      return api
        .get(url, { params: JSON.parse(key) })
        .then((res) => {
          setData(res.data);
          setError('');
          setStatus(res.status);
        })
        .catch((err) => {
          setStatus(err.response?.status ?? null);
          if (!silent) setError(errorMessage(err));
        })
        .finally(() => setLoading(false));
    },
    [url, key]
  );

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, setData, error, setError, status, loading, reload };
}
