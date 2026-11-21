import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AppIcon from './AppIcon.jsx';
import { SkeletonLine } from './PageLoadingSkeleton.jsx';
import { authService } from '../../services/authService.js';

export default function AccountDeletionDialog({ open, authMethod, initialNotice = '', onClose, onConfirm }) {
  const dialogRef = useRef(null);
  const [phrase, setPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [understands, setUnderstands] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reauth, setReauth] = useState({ loading: false, ready: false, configured: true });

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const focusable = () => [...(dialogRef.current?.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled)') || [])];
    focusable()[0]?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0]; const last = items.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [open, busy, onClose]);

  useEffect(() => {
    if (!open) return;
    setPhrase(''); setPassword(''); setUnderstands(false); setError('');
    if (authMethod !== 'google') { setReauth({ loading: false, ready: false, configured: true }); return; }
    let live = true;
    setReauth((current) => ({ ...current, loading: true }));
    authService.accountDeletionStatus().then((result) => {
      if (live) setReauth({ loading: false, ready: Boolean(result.googleReauthAvailable), configured: result.googleReauthConfigured !== false });
    }).catch(() => {
      if (live) setReauth({ loading: false, ready: false, configured: true });
    });
    return () => { live = false; };
  }, [open, authMethod]);

  if (!open) return null;
  const localReady = authMethod === 'local' && password.length > 0;
  const googleReady = authMethod === 'google' && reauth.ready && !reauth.loading;
  const canDelete = phrase === 'DELETE' && understands && !busy && (localReady || googleReady);

  const submit = async (event) => {
    event.preventDefault();
    if (!canDelete) return;
    setBusy(true); setError('');
    try {
      await onConfirm({ confirmationPhrase: phrase, ...(authMethod === 'local' ? { currentPassword: password } : {}) });
    } catch (requestError) {
      setError(requestError?.message || 'Account deletion could not be completed. Your account remains unchanged.');
      setBusy(false);
    }
  };

  return createPortal(
    <div className="settings-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <form className="settings-dialog settings-dialog--delete" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="delete-account-title" aria-describedby="delete-account-description" onSubmit={submit}>
        <button className="settings-dialog__close" type="button" onClick={onClose} disabled={busy} aria-label="Close delete account dialog"><AppIcon name="close" /></button>
        <span className="settings-dialog__icon settings-dialog__icon--danger"><AppIcon name="shield" /></span>
        <p className="app-eyebrow settings-dialog__danger-eyebrow">DANGER ZONE / DELETE ACCOUNT</p>
        <h2 id="delete-account-title">Permanently delete your account?</h2>
        <p id="delete-account-description" className="settings-dialog__intro">This cannot be undone. You will lose access to THE SYSTEM, and your personal Tasks, progression, preferences, history and other records owned only by this account will be permanently deleted.</p>
        <div className="settings-reset-warning"><strong>PERMANENT ACTION</strong><span>Deletion removes only this account and its exclusively owned records. Shared system data and other members' information are not included.</span></div>

        {authMethod === 'local' ? <label className="settings-reset-phrase"><span>Current password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} /></label> : authMethod === 'google' ? (
          <div className="settings-delete-google" role="status">
            {reauth.loading ? <SkeletonLine width="long" label="Checking recent Google verification" /> : reauth.ready ? <span className="is-ready"><i />Google identity verified for this account.</span> : reauth.configured ? <>
              <span>A fresh Google sign-in is required immediately before deletion.</span>
              <a className="settings-dialog__submit" href="/api/v1/auth/account/google-deletion/reauth">Verify with Google</a>
            </> : <span>Google re-authentication is not configured on this server.</span>}
          </div>
        ) : <p className="settings-reset-error" role="alert">The account sign-in method could not be verified.</p>}

        <label className="settings-reset-phrase"><span>Type <code>DELETE</code> to continue</span><input autoComplete="off" value={phrase} onChange={(event) => setPhrase(event.target.value)} disabled={busy} /></label>
        <label className="settings-reset-read"><input type="checkbox" checked={understands} onChange={(event) => setUnderstands(event.target.checked)} disabled={busy} /><span>I understand that my account and its personal data will be permanently deleted.</span></label>
        {initialNotice === 'reauth-failed' && <p className="settings-reset-error" role="alert">Google verification did not match this signed-in account or expired. Your account was not deleted.</p>}
        {error && <p className="settings-reset-error" role="alert">{error}</p>}
        <div className="settings-dialog__actions">
          <button type="button" className="settings-dialog__cancel" onClick={onClose} disabled={busy}>Keep account</button>
          <button type="submit" className="settings-dialog__submit settings-dialog__submit--danger" disabled={!canDelete}>{busy ? 'Deleting account…' : 'Permanently delete account'}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
