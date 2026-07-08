/**
 * Phone number normalization for Nepal.
 * All phone numbers are stored as E.164 format: +977XXXXXXXXXX
 * This ensures +9779841234567 and 9841234567 resolve to the same user.
 */
export function normalizeNepalPhone(raw: string): string {
  // Strip all non-digit chars except leading +
  const stripped = raw.replace(/[^\d+]/g, '');

  // Already E.164 with country code
  if (stripped.startsWith('+977') && stripped.length === 14) return stripped;

  // 977XXXXXXXXXX (13 digits, no +)
  if (stripped.startsWith('977') && stripped.length === 13) return `+${stripped}`;

  // 0XXXXXXXXXX (11 digits, starts with 0)
  if (stripped.startsWith('0') && stripped.length === 11) return `+977${stripped.slice(1)}`;

  // 9XXXXXXXXX (10 digits, just the local number)
  if (stripped.length === 10 && stripped.startsWith('9')) return `+977${stripped}`;

  // Return as-is if unrecognised (validation regex will catch it)
  return raw;
}

export const NEPAL_PHONE_REGEX = /^\+977[6-9]\d{9}$/;
