const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
const STORAGE_KEY = 'flowchat_utms';

export type UtmParams = Partial<Record<typeof UTM_KEYS[number], string>>;

export function captureUtmParams(): UtmParams {
  // Check sessionStorage first
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* ignore */ }
  }

  const params = new URLSearchParams(window.location.search);
  const utms: UtmParams = {};
  let found = false;

  for (const key of UTM_KEYS) {
    const val = params.get(key);
    if (val) {
      utms[key] = val;
      found = true;
    }
  }

  if (found) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(utms));
  }

  return utms;
}

export function getUtmParams(): UtmParams {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* ignore */ }
  }
  return {};
}
