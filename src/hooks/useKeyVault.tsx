import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { requestPersistence } from '../storage/persistence';
import {
  DerivedKey,
  MIN_PASSPHRASE_LENGTH,
  SavedKeys,
  WrongPassphraseError,
  canEncrypt,
  decryptKeys,
  deriveKey,
  forgetVault,
  readVault,
  saveEncrypted,
  savePlain,
} from '../storage/keyVault';

/**
 * "Remember on this device" for the Figma token and the Gemini key.
 *
 *  loading      reading what is saved
 *  none         nothing saved: keys live in memory only (the default)
 *  plain        saved as plain text, no passphrase
 *  locked       saved and encrypted; waiting for the passphrase
 *  unlocked     saved and encrypted; the passphrase has been entered this visit
 *  unavailable  this browser cannot save anything
 *
 * The passphrase itself is never kept. Only the key derived from it is held in memory, so
 * that later changes can be re-encrypted without asking again.
 */
export type VaultStatus = 'loading' | 'none' | 'plain' | 'locked' | 'unlocked' | 'unavailable';

export interface KeyVaultController {
  status: VaultStatus;
  busy: boolean;
  error: string | null;
  canEncrypt: boolean;
  /** Save the keys now; with a passphrase they are encrypted, without one they are plain text. */
  remember: (passphrase?: string) => Promise<boolean>;
  /** Turn plain-text saved keys into encrypted ones. */
  protect: (passphrase: string) => Promise<boolean>;
  unlock: (passphrase: string) => Promise<boolean>;
  /** Remove the saved keys from this device. Keys already typed stay in memory until refresh. */
  forget: () => Promise<void>;
  clearError: () => void;
}

export const KeyVaultContext = createContext<KeyVaultController | null>(null);
export const useKeyVault = () => useContext(KeyVaultContext);

const SAVE_DELAY_MS = 400;

export function useKeyVaultState(keys: SavedKeys, applyLoaded: (loaded: SavedKeys) => void): KeyVaultController {
  const [status, setStatus] = useState<VaultStatus>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const derivedRef = useRef<DerivedKey | null>(null);
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const applyRef = useRef(applyLoaded);
  applyRef.current = applyLoaded;
  const statusRef = useRef<VaultStatus>('loading');
  statusRef.current = status;
  // Bumped by Forget, so a save that was already on its way cannot bring the keys back
  const generationRef = useRef(0);

  useEffect(() => {
    let alive = true;
    readVault()
      .then((rec) => {
        if (!alive) return;
        if (!rec) setStatus('none');
        else if (rec.mode === 'plain') {
          applyRef.current(rec.keys);
          setStatus('plain');
        } else setStatus('locked');
      })
      .catch(() => alive && setStatus('unavailable'));
    return () => {
      alive = false;
    };
  }, []);

  const persistNow = useCallback(async (current: SavedKeys) => {
    const generation = generationRef.current;
    const derived = derivedRef.current;
    const stillWanted = () => generation === generationRef.current;
    try {
      if (derived) await saveEncrypted(current, derived, stillWanted);
      else await savePlain(current, stillWanted);
    } catch {
      setError('The saved keys could not be updated on this device.');
    }
  }, []);

  // While keys are being remembered, keep the saved copy in step with what is typed
  useEffect(() => {
    if (status !== 'plain' && status !== 'unlocked') return;
    const generation = generationRef.current;
    const t = window.setTimeout(() => {
      if (generation === generationRef.current && (statusRef.current === 'plain' || statusRef.current === 'unlocked')) void persistNow(keysRef.current);
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [status, keys.figmaToken, keys.geminiKey, persistNow]);

  const withBusy = useCallback(async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof WrongPassphraseError ? e.message : 'This did not work. The browser may not allow saving here.');
      return fallback;
    } finally {
      setBusy(false);
    }
  }, []);

  const encryptWith = useCallback(async (passphrase: string): Promise<boolean> => {
    if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
      setError(`Use a passphrase of at least ${MIN_PASSPHRASE_LENGTH} characters.`);
      return false;
    }
    if (!canEncrypt()) {
      setError('This browser cannot encrypt here (it needs a secure https page).');
      return false;
    }
    const derived = await deriveKey(passphrase);
    await saveEncrypted(keysRef.current, derived);
    derivedRef.current = derived;
    setStatus('unlocked');
    void requestPersistence(); // keys are now saved on this device: ask the browser to keep them
    return true;
  }, []);

  const remember = useCallback(
    (passphrase?: string) =>
      withBusy(async () => {
        if (passphrase) return encryptWith(passphrase);
        await savePlain(keysRef.current);
        derivedRef.current = null;
        setStatus('plain');
        void requestPersistence();
        return true;
      }, false),
    [withBusy, encryptWith]
  );

  const protect = useCallback((passphrase: string) => withBusy(() => encryptWith(passphrase), false), [withBusy, encryptWith]);

  const unlock = useCallback(
    (passphrase: string) =>
      withBusy(async () => {
        const rec = await readVault();
        if (!rec || rec.mode !== 'encrypted') {
          setStatus(rec ? 'plain' : 'none');
          return false;
        }
        const { keys: loaded, derived } = await decryptKeys(rec, passphrase);
        derivedRef.current = derived;
        applyRef.current(loaded);
        setStatus('unlocked');
        return true;
      }, false),
    [withBusy]
  );

  const forget = useCallback(async () => {
    generationRef.current += 1;
    derivedRef.current = null;
    setError(null);
    try {
      await forgetVault();
    } catch {
      /* nothing was saved */
    }
    setStatus('none');
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { status, busy, error, canEncrypt: canEncrypt(), remember, protect, unlock, forget, clearError };
}
