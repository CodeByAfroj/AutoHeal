import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getFromCache, saveToCache } from '../utils/persistence';

/**
 * useAutoQuery Hook
 * A premium data fetching hook with "Stale-While-Revalidate" (SWR) behavior
 * and persistent disk caching. 
 * 
 * Features:
 * - Immediate UI: Shows cached data instantly on mount
 * - Background Refresh: Always fetches fresh data in the background
 * - Persistence: Survives refreshes and crashes
 * - SSE-Compatible: Exposes a silent refetch for real-time updates
 */
export function useAutoQuery(key, path, options = {}) {
  const { apiFetch, token } = useAuth();
  const { ttl, enabled = true } = options;
  
  // 1. Initialize state from Persistent Disk Cache for instant UI rendering
  const [data, setData] = useState(() => getFromCache(key, ttl));
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState(null);
  
  // Track the last path fetched to avoid redundant mounts
  const lastPath = useRef(path);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!token || !enabled) return;
    
    if (!isSilent && !data) setLoading(true);
    
    try {
      const res = await apiFetch(path);
      if (res.ok) {
        const result = await res.json();
        
        // 2. Update UI and persist to Disk Cache
        setData(result);
        saveToCache(key, result);
        setError(null);
      } else {
        setError(`Failed to fetch: ${res.statusText}`);
      }
    } catch (err) {
      setError(err.message);
      console.error(`[AutoQuery] Error fetching ${path}:`, err);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, path, token, key, enabled, data]);

  // Synchronous refresh on path change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { 
    data, 
    loading, 
    error, 
    refetch: fetchData, 
    setData,
    isStale: !!data // Handy for showing a small "Updating..." indicator
  };
}
