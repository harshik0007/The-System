import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import AppIcon from '../components/app/AppIcon.jsx';
import { useAuth } from './AuthContext.jsx';
import { useFlashMessages } from './FlashMessageContext.jsx';

const AccountActionsContext = createContext(null);

function SignOutDialog({ open, onClose, onConfirm, logout }) {
  const { notifyError } = useFlashMessages();
  const dialogRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const requestRef = useRef(false);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const appRoot = document.getElementById('root');
    const previousInert = appRoot?.inert ?? false;
    if (appRoot) appRoot.inert = true;
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
      if (appRoot) appRoot.inert = previousInert;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected && previousFocus !== document.body) previousFocus.focus();
      else document.getElementById('app-navigation-toggle')?.focus();
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
      await logout();
      onConfirm();
    } catch (error) {
      const message = error?.message || 'We could not end this session. It may still be active; please try again.';
      setFeedback(message);
      notifyError(message);
    } finally {
      requestRef.current = false;
      setBusy(false);
    }
  };

  return createPortal(
    <div className="account-action-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="account-action-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="logout-dialog-title" aria-describedby="logout-dialog-description" tabIndex="-1">
        <button type="button" className="account-action-dialog__close" onClick={onClose} disabled={busy} aria-label="Close sign out confirmation"><AppIcon name="close" /></button>
        <span className="account-action-dialog__icon account-action-dialog__icon--danger"><AppIcon name="profile" /></span>
        <p className="app-eyebrow">ACCOUNT SESSION</p>
        <h2 id="logout-dialog-title">Log out of THE SYSTEM?</h2>
        <p id="logout-dialog-description">You will be signed out of THE SYSTEM. Your progress and history will not be deleted.</p>
        {feedback && <p className="account-action-dialog__feedback" role="status">{feedback}</p>}
        <div className="account-action-dialog__actions">
          <button type="button" className="account-action-dialog__cancel" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="account-action-dialog__confirm account-action-dialog__confirm--danger" onClick={submit} disabled={busy} aria-busy={busy}>
            {busy ? 'Signing out…' : 'Confirm log out'}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function AccountActionsProvider({ children }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { notifySuccess } = useFlashMessages();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const requestLogout = useCallback(() => setLogoutOpen(true), []);
  const closeLogout = useCallback(() => setLogoutOpen(false), []);
  const confirmLogout = useCallback(() => {
    setLogoutOpen(false);
    notifySuccess('You have been signed out. Your progress and history are saved.');
    navigate('/login', { replace: true });
  }, [navigate, notifySuccess]);

  return (
    <AccountActionsContext.Provider value={{ requestLogout }}>
      {children}
      <SignOutDialog open={logoutOpen} onClose={closeLogout} onConfirm={confirmLogout} logout={logout} />
    </AccountActionsContext.Provider>
  );
}

export function useAccountActions() {
  const context = useContext(AccountActionsContext);
  if (!context) throw new Error('useAccountActions must be used within AccountActionsProvider.');
  return context;
}
