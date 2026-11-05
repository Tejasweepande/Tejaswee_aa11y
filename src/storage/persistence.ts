/**
 * Ask the browser not to clear this site's saved data automatically when disk space is low.
 * Chrome and Edge decide from how the site is used, Firefox asks the user, Safari decides by
 * itself. It is a request, never a guarantee, which is why Export exists as a backup.
 *
 * Callers ask only after something has really been saved, never on page load.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage) return false;
    if (navigator.storage.persisted && (await navigator.storage.persisted())) return true; // already granted: do not ask again
    if (!navigator.storage.persist) return false;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
