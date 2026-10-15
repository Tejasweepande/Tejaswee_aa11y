import { STORE_VAULT, openDb, request, transactionDone } from './idb';

/**
 * The saved Figma token and Gemini key, kept on this device only.
 *
 *  - Not saved (the default): the keys live in memory and vanish on refresh.
 *  - Saved without a passphrase: stored as plain text in this browser. Anyone using this
 *    browser profile can read them, and so can any script running on the page.
 *  - Saved with a passphrase: encrypted with AES-256-GCM. The key comes from the passphrase
 *    through PBKDF2 (SHA-256, 600,000 rounds, random salt). The passphrase is never stored
 *    and cannot be recovered; a wrong one simply fails to decrypt.
 */
export interface SavedKeys {
  figmaToken?: string;
  geminiKey?: string;
}

const RECORD_ID = 'keys';
export const KDF_ITERATIONS = 600_000;
export const MIN_PASSPHRASE_LENGTH = 8;
const AAD = new TextEncoder().encode('a11y-lab:saved-keys:v1'); // binds the ciphertext to its purpose

type PlainRecord = { id: typeof RECORD_ID; v: 1; mode: 'plain'; keys: SavedKeys; updatedAt: string };
type EncryptedRecord = {
  id: typeof RECORD_ID;
  v: 1;
  mode: 'encrypted';
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  iv: string;
  ciphertext: string;
  updatedAt: string;
};
export type VaultRecord = PlainRecord | EncryptedRecord;

export class WrongPassphraseError extends Error {
  constructor() {
    super('That passphrase does not unlock the saved keys.');
    this.name = 'WrongPassphraseError';
  }
}

export const canEncrypt = (): boolean => typeof crypto !== 'undefined' && !!crypto.subtle && !!crypto.getRandomValues;

const toB64 = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** What the passphrase becomes before it is used, so "é" typed two different ways still matches. */
const normalise = (p: string) => p.normalize('NFKC');

export interface DerivedKey {
  key: CryptoKey;
  salt: Uint8Array;
  iterations: number;
}

export async function deriveKey(passphrase: string, salt: Uint8Array = crypto.getRandomValues(new Uint8Array(16)), iterations = KDF_ITERATIONS): Promise<DerivedKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(normalise(passphrase)), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  return { key, salt, iterations };
}

export async function encryptKeys(keys: SavedKeys, derived: DerivedKey): Promise<EncryptedRecord> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // a fresh IV for every save
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: AAD },
    derived.key,
    new TextEncoder().encode(JSON.stringify(keys))
  );
  return {
    id: RECORD_ID,
    v: 1,
    mode: 'encrypted',
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: derived.iterations, salt: toB64(derived.salt) },
    iv: toB64(iv),
    ciphertext: toB64(ciphertext),
    updatedAt: new Date().toISOString(),
  };
}

export async function decryptKeys(rec: EncryptedRecord, passphrase: string): Promise<{ keys: SavedKeys; derived: DerivedKey }> {
  const derived = await deriveKey(passphrase, fromB64(rec.kdf.salt), rec.kdf.iterations);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(rec.iv) as BufferSource, additionalData: AAD },
      derived.key,
      fromB64(rec.ciphertext) as BufferSource
    );
    return { keys: sanitiseKeys(JSON.parse(new TextDecoder().decode(plain))), derived };
  } catch {
    throw new WrongPassphraseError(); // AES-GCM fails its integrity check on a wrong key or a changed file
  }
}

function sanitiseKeys(x: unknown): SavedKeys {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const out: SavedKeys = {};
  if (typeof o.figmaToken === 'string' && o.figmaToken) out.figmaToken = o.figmaToken;
  if (typeof o.geminiKey === 'string' && o.geminiKey) out.geminiKey = o.geminiKey;
  return out;
}

export async function readVault(): Promise<VaultRecord | null> {
  const db = await openDb();
  const rec = (await request(db.transaction(STORE_VAULT, 'readonly').objectStore(STORE_VAULT).get(RECORD_ID))) as VaultRecord | undefined;
  if (!rec || (rec.mode !== 'plain' && rec.mode !== 'encrypted')) return null;
  if (rec.mode === 'plain') return { ...rec, keys: sanitiseKeys(rec.keys) };
  return rec;
}

/**
 * `guard` is checked in the same instant the write begins (no waiting in between), so a save
 * that was already on its way can be cancelled by "Forget" and cannot bring the keys back.
 */
async function writeVault(rec: VaultRecord, guard: () => boolean): Promise<void> {
  const db = await openDb();
  if (!guard()) return;
  const tx = db.transaction(STORE_VAULT, 'readwrite');
  tx.objectStore(STORE_VAULT).put(rec);
  await transactionDone(tx);
}

export async function savePlain(keys: SavedKeys, guard: () => boolean = () => true): Promise<void> {
  await writeVault({ id: RECORD_ID, v: 1, mode: 'plain', keys: sanitiseKeys(keys), updatedAt: new Date().toISOString() }, guard);
}

export async function saveEncrypted(keys: SavedKeys, derived: DerivedKey, guard: () => boolean = () => true): Promise<void> {
  const rec = await encryptKeys(sanitiseKeys(keys), derived); // takes a moment
  await writeVault(rec, guard);
}

export async function forgetVault(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_VAULT, 'readwrite');
  tx.objectStore(STORE_VAULT).clear();
  await transactionDone(tx);
}
