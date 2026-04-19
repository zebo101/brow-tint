'use client';

import { useEffect, useMemo, useState } from 'react';

interface Hairstyle {
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

interface HairstyleCategory {
  key: string;
  count: number;
}

interface HairstyleData {
  hairstyles: Record<string, Hairstyle[]>;
  categories: HairstyleCategory[];
}

// Cache key for sessionStorage
const CACHE_KEY = 'hairstyles_cache';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

interface CacheEntry {
  data: HairstyleData;
  timestamp: number;
}

function getFromCache(): HairstyleData | null {
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

function setToCache(data: HairstyleData): void {
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
const FALLBACK_CATEGORIES: HairstyleCategory[] = [
  { key: 'men', count: 12 },
  { key: 'women', count: 12 },
  { key: 'boys', count: 12 },
  { key: 'girls', count: 12 },
];

/**
 * Custom hook for fetching and caching hairstyles data
 * Uses sessionStorage for client-side caching
 */
export function useHairstyles() {
  const [hairstyles, setHairstyles] = useState<Record<string, Hairstyle[]>>({});
  const [categories, setCategories] = useState<HairstyleCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchHairstyles = async () => {
      // Check cache first
      const cached = getFromCache();
      if (cached) {
        if (isMounted) {
          setHairstyles(cached.hairstyles);
          setCategories(cached.categories);
          setIsLoading(false);
        }
        return;
      }

      try {
        const resp = await fetch('/api/hairstyle/list');
        if (!resp.ok) throw new Error('Failed to fetch hairstyles');

        const { data } = await resp.json();
        if (!data?.hairstyles || !data?.categories) {
          throw new Error('Invalid response format');
        }

        // Group hairstyles by category
        const grouped: Record<string, Hairstyle[]> = {};
        for (const h of data.hairstyles) {
          if (!grouped[h.category]) {
            grouped[h.category] = [];
          }
          grouped[h.category].push(h);
        }

        // Convert categories object to array & sort
        const cats: HairstyleCategory[] = Object.entries(data.categories).map(
          ([key, count]) => ({ key, count: count as number })
        );
        const order = ['men', 'women', 'boys', 'girls'];
        cats.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

        const cacheData: HairstyleData = {
          hairstyles: grouped,
          categories: cats.length > 0 ? cats : FALLBACK_CATEGORIES,
        };

        // Save to cache
        setToCache(cacheData);

        if (isMounted) {
          setHairstyles(grouped);
          setCategories(cacheData.categories);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load hairstyles:', err);
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
          setCategories(FALLBACK_CATEGORIES);
          setIsLoading(false);
        }
      }
    };

    fetchHairstyles();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    hairstyles,
    categories,
    isLoading,
    error,
  };
}
