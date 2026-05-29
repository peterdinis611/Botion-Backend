export type NotificationMetadata = Record<string, string | undefined>;

export function serializeNotificationMetadata(
  metadata?: NotificationMetadata | null,
): string | null {
  if (!metadata || Object.keys(metadata).length === 0) return null;
  return JSON.stringify(metadata);
}

export function parseNotificationMetadata(
  raw?: string | null,
): NotificationMetadata | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return null;
    const out: NotificationMetadata = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') out[key] = value;
    }
    return out;
  } catch {
    return null;
  }
}
