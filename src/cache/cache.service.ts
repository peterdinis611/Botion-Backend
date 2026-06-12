import { Injectable } from '@nestjs/common';
import { CACHE_MAX_ENTRIES } from './cache.constants';

interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
}

@Injectable()
export class CacheService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private patternBuckets = new Map<string, Set<string>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.removeKey(key);
      return null;
    }

    // LRU: move recently used keys to the end.
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    const expiresAt = ttlMs ? Date.now() + ttlMs : null;
    this.removeKey(key);
    this.evictIfNeeded();
    this.cache.set(key, { value, expiresAt });
    this.registerPatternBuckets(key);
  }

  delete(key: string): void {
    this.removeKey(key);
  }

  clearPattern(pattern: string): void {
    const bucket = this.patternBuckets.get(pattern);
    if (bucket) {
      for (const key of bucket) {
        this.cache.delete(key);
      }
      this.patternBuckets.delete(pattern);
      return;
    }

    const regexPattern = '^' + pattern.replace(/\*/g, '.*') + '$';
    const regex = new RegExp(regexPattern);
    for (const key of [...this.cache.keys()]) {
      if (regex.test(key)) {
        this.removeKey(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
    this.patternBuckets.clear();
  }

  private removeKey(key: string): void {
    this.cache.delete(key);
    for (const bucket of this.patternBuckets.values()) {
      bucket.delete(key);
    }
  }

  private registerPatternBuckets(key: string): void {
    const segments = key.split(':');
    for (let i = 0; i < segments.length; i++) {
      const prefix = segments.slice(0, i + 1).join(':');
      const pattern = `${prefix}:*`;
      let bucket = this.patternBuckets.get(pattern);
      if (!bucket) {
        bucket = new Set<string>();
        this.patternBuckets.set(pattern, bucket);
      }
      bucket.add(key);
    }
  }

  private evictIfNeeded(): void {
    while (this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (!oldestKey) break;
      this.removeKey(oldestKey);
    }
  }
}
