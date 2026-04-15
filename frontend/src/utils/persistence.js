/**
 * Persistent Storage Utilities
 * Handles background caching to localStorage with TTL (Time To Live) support.
 * This ensures data remains available even after browser crashes or refreshes.
 */

export const saveToCache = (key, data) => {
  try {
    localStorage.setItem(`ah_cache_${key}`, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('Cache write failed:', e);
  }
};

export const getFromCache = (key, ttl = 1000 * 60 * 60) => { // 1 Hour Default TTL
  try {
    const item = localStorage.getItem(`ah_cache_${key}`);
    if (!item) return null;
    
    const { data, timestamp } = JSON.parse(item);
    
    // Check if cache is stale (older than TTL)
    if (Date.now() - timestamp > ttl) {
      return null; 
    }
    
    return data;
  } catch (e) {
    return null;
  }
};

export const clearCache = (key) => {
  if (key) {
    localStorage.removeItem(`ah_cache_${key}`);
  } else {
    // Clear all AH caches
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('ah_cache_')) localStorage.removeItem(k);
    });
  }
};
