/** Stable list reads (notebooks, folders). */
export const CACHE_TTL_LIST_STABLE_MS = 180_000;

/** Frequently changing lists (notes, calendar). */
export const CACHE_TTL_LIST_HOT_MS = 90_000;

/** Single-entity reads. */
export const CACHE_TTL_DETAIL_MS = 120_000;

/** Tags and graphs — moderate churn. */
export const CACHE_TTL_META_MS = 120_000;

export const CACHE_MAX_ENTRIES = 5_000;
