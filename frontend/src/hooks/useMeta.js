import { useEffect, useState } from 'react';

import { api } from '../api/client';

// The category/priority/status vocabulary changes about once a year, so it is
// fetched once per session and shared through this module-level cache.
let cache = null;
let inflight = null;

const load = () => {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = api.meta()
      .then((data) => {
        cache = {
          ...data,
          // Lookup maps for rendering labels from a stored value.
          statusLabels: Object.fromEntries(data.statuses.map((s) => [s.value, s.label])),
          priorityLabels: Object.fromEntries(data.priorities.map((p) => [p.value, p.label])),
          nextStatuses: Object.fromEntries(data.statuses.map((s) => [s.value, s.next])),
        };
        return cache;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
};

export const clearMetaCache = () => { cache = null; };

export default function useMeta() {
  const [meta, setMeta] = useState(cache);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    load().then((data) => { if (active) setMeta(data); }).catch((err) => { if (active) setError(err); });
    return () => { active = false; };
  }, []);

  return { meta, error, loading: !meta && !error };
}
