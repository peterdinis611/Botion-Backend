import { join } from 'path';

export const TMP_ROOT = join(process.cwd(), 'tmp');
export const META_FILENAME = '.uploads.json';
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const DEFAULT_MAX_AGE_HOURS = 24;

export function getTmpFileMaxAgeMs(): number {
  const hours = Number(process.env.TMP_FILE_MAX_AGE_HOURS ?? DEFAULT_MAX_AGE_HOURS);
  const safeHours =
    Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_MAX_AGE_HOURS;
  return safeHours * 60 * 60 * 1000;
}

export function isTmpCleanupEnabled(): boolean {
  return process.env.TMP_CLEANUP_ENABLED !== 'false';
}
