'use client';

import { useEffect, useMemo, useState } from 'react';

interface BrowTint {
  id: string;
  category: string;
  sequence: number;
  name: string;
  tags: string[];
  description?: string;
  prompt?: string;
  imageUrl: string;
  thumbnailUrl: string;
}

interface BrowTintCategory {
  key: string;
  count: number;
}

interface BrowTintData {
  browTints: Record<string, BrowTint[]>;
  categories: BrowTintCategory[];
}

// Cache key for sessionStorage
const CACHE_KEY = 'brow_tints_cache';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

interface CacheEntry {
  data: BrowTintData;
  timestamp: number;
}

function getFromCache(): BrowTintData | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const entry: CacheEntry = JSON.parse(cached);
    const isExpired = Date.now() - entry.timestamp > CACHE_TTL;

    if (isExpired) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

function setToCache(data: BrowTintData): void {
  if (typeof window === 'undefined') return;

  try {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

// Fallback categories when API fails
const FALLBACK_CATEGORIES: BrowTintCategory[] = [
  { key: 'men', count: 12 },
  { key: 'women', count: 12 },
  { key: 'boys', count: 12 },
  { key: 'girls', count: 12 },
];

/**
 * Custom hook for fetching and caching brow tints data
 * Uses sessionStorage for client-side caching
 */
export function useBrowTints() {
  const [browTints, setBrowTints] = useState<Record<string, BrowTint[]>>({});
  const [categories, setCategories] = useState<BrowTintCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchBrowTints = async () => {
      // Check cache first
      const cached = getFromCache();
      if (cached) {
        if (isMounted) {
          setBrowTints(cached.browTints);
          setCategories(cached.categories);
          setIsLoading(false);
        }
        return;
      }

      try {
        const resp = await fetch('/api/brow-tint/list');
        if (!resp.ok) throw new Error('Failed to fetch brow tints');

        const { data } = await resp.json();
        if (!data?.browTints || !data?.categories) {
          throw new Error('Invalid response format');
        }

        // Group brow tints by category
        const grouped: Record<string, BrowTint[]> = {};
        for (const h of data.browTints) {
          if (!grouped[h.category]) {
            grouped[h.category] = [];
          }
          grouped[h.category].push(h);
        }

        // Convert categories object to array & sort
        const cats: BrowTintCategory[] = Object.entries(data.categories).map(
          ([key, count]) => ({ key, count: count as number })
        );
        const order = ['men', 'women', 'boys', 'girls'];
        cats.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

        const cacheData: BrowTintData = {
          browTints: grouped,
          categories: cats.length > 0 ? cats : FALLBACK_CATEGORIES,
        };

        // Save to cache
        setToCache(cacheData);

        if (isMounted) {
          setBrowTints(grouped);
          setCategories(cacheData.categories);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load brow tints:', err);
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
          setCategories(FALLBACK_CATEGORIES);
          setIsLoading(false);
        }
      }
    };

    fetchBrowTints();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    browTints,
    categories,
    isLoading,
    error,
  };
}
