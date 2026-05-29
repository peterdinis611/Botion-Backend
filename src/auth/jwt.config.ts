/** Stable secret in dev — set JWT_SECRET in .env for production. */
export const JWT_SECRET =
  process.env.JWT_SECRET ?? 'SECRET_KEY_JWT_CHANGE_ME';

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

function parseExpiresInSeconds(): number {
  const raw = process.env.JWT_EXPIRES_IN_SECONDS;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return THIRTY_DAYS_SECONDS;
}

/** Session length in seconds (default 30 days). */
export const JWT_EXPIRES_IN_SECONDS = parseExpiresInSeconds();
