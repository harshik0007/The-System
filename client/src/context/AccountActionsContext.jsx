import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import AppIcon from '../components/app/AppIcon.jsx';
import { signOut } from '../services/authService.js';

const AccountActionsContext = createContext(null);

function SignOutDialog({ open, onClose, onConfirm }) {
  const dialogRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const requestRef = useRef(false);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const getFocusable = () => [...(dialogRef.current?.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])') || [])];
    getFocusable()[0]?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key !== 'Tab') return;
      const elements = getFocusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected && previousFocus !== document.body) previousFocus.focus();
      else document.getElementById('app-profile-menu-trigger')?.focus();
    };
  }, [open, busy, onClose]);

  useEffect(() => {
    if (open) setFeedback('');
  }, [open]);

  if (!open) return null;
  const submit = async () => {
    if (requestRef.current) return;
    requestRef.current = true;
    setBusy(true);
    setFeedback('');
    try {
      const result = await signOut();
      if (result.success) onConfirm();
      else setFeedback(result.message || 'Sign out could not be completed.');
    } catch {
      setFeedback('Sign out could not be completed. No progress data was changed.');
    } finally {
      requestRef.current = false;
      setBusy(false);
    }
  };

  return createPortal(
    <div className="account-action-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="account-action-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="logout-dialog-title" aria-describedby="logout-dialog-description" tabIndex="-1">
        <button type="button" className="account-action-dialog__close" onClick={onClose} disabled={busy} aria-label="Close sign out confirmation"><AppIcon name="close" /></button>
        <span className="account-action-dialog__icon"><AppIcon name="profile" /></span>
        <p className="app-eyebrow">ACCOUNT SESSION</p>
        <h2 id="logout-dialog-title">Log out of THE SYSTEM?</h2>
        <p id="logout-dialog-description">You will be signed out of THE SYSTEM. Your progress and history will not be deleted.</p>
        {feedback && <p className="account-action-dialog__feedback" role="status">{feedback}</p>}
        <div className="account-action-dialog__actions">
          <button type="button" className="account-action-dialog__cancel" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="account-action-dialog__confirm" onClick={submit} disabled={busy}>{busy ? 'Checking…' : 'Confirm log out'}</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function AccountActionsProvider({ children }) {
  const navigate = useNavigate();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const requestLogout = useCallback(() => setLogoutOpen(true), []);
  const closeLogout = useCallback(() => setLogoutOpen(false), []);
  const confirmLogout = useCallback(() => {
    setLogoutOpen(false);
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <AccountActionsContext.Provider value={{ requestLogout }}>
      {children}
      <SignOutDialog open={logoutOpen} onClose={closeLogout} onConfirm={confirmLogout} />
    </AccountActionsContext.Provider>
  );
}

export function useAccountActions() {
  const context = useContext(AccountActionsContext);
  if (!context) throw new Error('useAccountActions must be used within AccountActionsProvider.');
  return context;
}
