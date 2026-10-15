/**
 * Ask the browser not to clear this site's saved data automatically when disk space is low.
 * Chrome and Edge decide from how the site is used, Firefox asks the user, Safari decides by
 * itself. It is a request, never a guarantee, so the app also offers Export as a backup.
 */
export interface StorageInfo {
  supported: boolean;
  persisted: boolean | null; // null = the browser cannot say
  usageBytes: number | null;
  quotaBytes: number | null;
}

export async function requestPersistence(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage) return false;
    if (navigator.storage.persisted && (await navigator.storage.persisted())) return true;
    if (!navigator.storage.persist) return false;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function getStorageInfo(): Promise<StorageInfo> {
  const none: StorageInfo = { supported: false, persisted: null, usageBytes: null, quotaBytes: null };
  try {
    if (typeof navigator === 'undefined' || !navigator.storage) return none;
    const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : null;
    const est = navigator.storage.estimate ? await navigator.storage.estimate() : null;
    return { supported: true, persisted, usageBytes: est?.usage ?? null, quotaBytes: est?.quota ?? null };
  } catch {
    return none;
  }
}

export const formatBytes = (n: number | null): string => {
  if (n === null) return 'unknown';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};
