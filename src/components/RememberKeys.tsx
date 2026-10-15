import React, { useId, useState } from 'react';
import { useKeyVault } from '../hooks/useKeyVault';
import { MIN_PASSPHRASE_LENGTH } from '../storage/keyVault';

const inputClass =
  'w-full bg-lab-card border border-lab-border rounded px-3 py-2 text-sm text-lab-text focus:ring-2 focus:ring-sky-500/50 focus:outline-none';
const primaryBtn =
  'px-3 py-1.5 rounded text-sm font-bold bg-lab-accent text-lab-onAccent hover:bg-lab-accentHover disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
const quietBtn =
  'px-3 py-1.5 rounded text-sm font-semibold text-lab-text bg-lab-subtle border border-lab-border hover:border-sky-500/50 disabled:opacity-50 transition-colors';
const dangerBtn =
  'px-3 py-1.5 rounded text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors';

/**
 * "Remember on this device" for the Figma token and the Gemini key. It shows the same thing
 * wherever it is placed (the Figma page and the Gemini key dialog), because both keys share one
 * saved copy and one optional passphrase. Without a KeyVault provider it renders nothing.
 */
export const RememberKeys: React.FC = () => {
  const vault = useKeyVault();
  const uid = useId();
  const [open, setOpen] = useState(false); // "Remember on this device" ticked, not saved yet
  const [adding, setAdding] = useState(false); // adding a passphrase to plain-text saved keys
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [unlockPass, setUnlockPass] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  if (!vault || vault.status === 'loading') return null;
  const { status, busy } = vault;
  const error = localError ?? vault.error;

  const reset = () => {
    setPass('');
    setPass2('');
    setUnlockPass('');
    setLocalError(null);
    vault.clearError();
  };

  const submitNew = async (mode: 'remember' | 'protect') => {
    setLocalError(null);
    vault.clearError();
    if (pass && pass !== pass2) {
      setLocalError('The two passphrases do not match.');
      return;
    }
    const done = mode === 'protect' ? await vault.protect(pass) : await vault.remember(pass || undefined);
    if (done) {
      reset();
      setOpen(false);
      setAdding(false);
    }
  };

  const submitUnlock = async () => {
    setLocalError(null);
    if (await vault.unlock(unlockPass)) reset();
  };

  const onEnter = (action: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // keep Enter from submitting a form this panel sits inside
      action();
    }
  };

  const forget = async () => {
    await vault.forget();
    reset();
    setOpen(false);
    setAdding(false);
  };

  const passphraseFields = (idBase: string, withConfirm: boolean) => (
    <div className="space-y-2">
      <div>
        <label htmlFor={`${idBase}-pass`} className="block text-xs font-semibold text-lab-text mb-1">
          Passphrase{withConfirm && ' (optional, recommended)'}
        </label>
        <input
          id={`${idBase}-pass`}
          type="password"
          autoComplete="new-password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={onEnter(() => submitNew(adding ? 'protect' : 'remember'))}
          className={inputClass}
          aria-describedby={`${idBase}-help`}
        />
      </div>
      {pass.length > 0 && (
        <div>
          <label htmlFor={`${idBase}-pass2`} className="block text-xs font-semibold text-lab-text mb-1">
            Repeat passphrase
          </label>
          <input
            id={`${idBase}-pass2`}
            type="password"
            autoComplete="new-password"
            value={pass2}
            onChange={(e) => setPass2(e.target.value)}
            onKeyDown={onEnter(() => submitNew(adding ? 'protect' : 'remember'))}
            className={inputClass}
          />
        </div>
      )}
      <p id={`${idBase}-help`} className="text-xs text-lab-dim leading-relaxed">
        With a passphrase (at least {MIN_PASSPHRASE_LENGTH} characters) the keys are encrypted and you type it once per visit. Without one they are saved as plain text that anyone using this
        browser profile can read. A forgotten passphrase cannot be recovered; use Forget saved keys instead.
      </p>
    </div>
  );

  let body: React.ReactNode = null;

  if (status === 'unavailable') {
    body = <p className="text-xs text-lab-dim leading-relaxed">This browser is not letting the app save keys on this device, so they stay in memory until you refresh.</p>;
  } else if (status === 'none') {
    body = (
      <>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={open}
            onChange={(e) => {
              setOpen(e.target.checked);
              reset();
            }}
            className="mt-0.5 h-4 w-4 accent-sky-600"
            aria-controls={`${uid}-panel`}
            aria-expanded={open}
          />
          <span className="text-sm font-semibold text-lab-text">
            Remember on this device
            <span className="block text-xs font-normal text-lab-dim leading-relaxed">Keeps your Figma token and Gemini key after a refresh. They stay in this browser only.</span>
          </span>
        </label>
        {open && (
          <div id={`${uid}-panel`} className="space-y-2 pl-6">
            {passphraseFields(uid, true)}
            <button type="button" disabled={busy} onClick={() => submitNew('remember')} className={primaryBtn}>
              {pass ? 'Encrypt and save' : 'Save without a passphrase'}
            </button>
          </div>
        )}
      </>
    );
  } else if (status === 'plain') {
    body = (
      <>
        <p className="text-sm text-lab-text">
          <span className="font-semibold">Saved on this device</span> without a passphrase.
        </p>
        {adding ? (
          <div className="space-y-2">
            {passphraseFields(`${uid}-add`, false)}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy || !pass} onClick={() => submitNew('protect')} className={primaryBtn}>
                Encrypt saved keys
              </button>
              <button type="button" onClick={() => { setAdding(false); reset(); }} className={quietBtn}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {vault.canEncrypt && (
              <button type="button" onClick={() => setAdding(true)} className={quietBtn}>
                Add a passphrase
              </button>
            )}
            <button type="button" onClick={forget} className={dangerBtn}>
              Forget saved keys
            </button>
          </div>
        )}
      </>
    );
  } else if (status === 'unlocked') {
    body = (
      <>
        <p className="text-sm text-lab-text">
          <span className="font-semibold">Saved on this device</span> and encrypted with your passphrase.
        </p>
        <div>
          <button type="button" onClick={forget} className={dangerBtn}>
            Forget saved keys
          </button>
        </div>
      </>
    );
  } else if (status === 'locked') {
    body = (
      <>
        <p className="text-sm text-lab-text">
          <span className="font-semibold">Saved keys are locked.</span> Enter your passphrase to use them.
        </p>
        <div>
          <label htmlFor={`${uid}-unlock`} className="block text-xs font-semibold text-lab-text mb-1">
            Passphrase
          </label>
          <input
            id={`${uid}-unlock`}
            type="password"
            autoComplete="current-password"
            value={unlockPass}
            onChange={(e) => setUnlockPass(e.target.value)}
            onKeyDown={onEnter(submitUnlock)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || !unlockPass} onClick={submitUnlock} className={primaryBtn}>
            Unlock
          </button>
          <button type="button" onClick={forget} className={dangerBtn}>
            Forget saved keys
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-2 pt-1" data-testid="remember-keys">
      {body}
      <p role="alert" className={error ? 'text-xs font-semibold text-red-600 dark:text-red-400' : 'sr-only'}>
        {error ?? ''}
      </p>
    </div>
  );
};
