/** Keys this app writes outside IndexedDB. Sign-out removes all of them. */

export const AI_SETTINGS_KEY = 'family_history_ai_settings';
export const AI_SECRETS_KEY = 'family_history_ai_secrets';
export const DRAFT_PREFIX = 'fhp_';

export function isAppStorageKey(key) {
  if (!key) return false;
  return key.startsWith(DRAFT_PREFIX)
    || key === AI_SETTINGS_KEY
    || key === AI_SECRETS_KEY
    || key.startsWith('family_history_ai_');
}

export function collectStorageKeysToClear(keys) {
  return (keys || []).filter(isAppStorageKey);
}
