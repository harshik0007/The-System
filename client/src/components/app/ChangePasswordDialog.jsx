import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AuthNotice from '../auth/AuthNotice.jsx';
import PasswordInput from '../auth/PasswordInput.jsx';
import PasswordStrengthIndicator from '../auth/PasswordStrengthIndicator.jsx';
import AppIcon from './AppIcon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { validatePasswordChange } from '../../utils/authValidation.js';

const emptyForm = () => ({ currentPassword: '', newPassword: '', confirmPassword: '' });

export default function ChangePasswordDialog({ open, onClose }) {
  const { changePassword } = useAuth();
  const dialogRef = useRef(null);
  const requestRef = useRef(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const close = useCallback(() => {
    setForm(emptyForm());
    setErrors({});
    setNotice('');
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const focusable = () => [...(dialog?.querySelectorAll('button:not(:disabled), input:not(:disabled)') || [])];
    dialog?.querySelector('input[type="password"]')?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) close();
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [open, busy, close]);

  const handleField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setNotice('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (requestRef.current) return;
    const nextErrors = validatePasswordChange(form);
    setErrors(nextErrors);
    setNotice('');
    if (Object.keys(nextErrors).length) return;

    requestRef.current = true;
    setBusy(true);
    const submitted = { currentPassword: form.currentPassword, newPassword: form.newPassword, confirmPassword: form.confirmPassword };
    try {
      const result = await changePassword(submitted);
      setForm(emptyForm());
      setNotice(result.message || 'Your password was updated.');
    } catch (error) {
      setNotice(error?.message || 'Password changes could not be completed. No password was changed.');
    } finally {
      requestRef.current = false;
      setBusy(false);
    }
  };

  if (!open) return null;
  return createPortal(
    <div className="settings-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }}>
      <section className="settings-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="change-password-title" tabIndex="-1">
        <button type="button" className="settings-dialog__close" onClick={close} disabled={busy} aria-label="Close change password"><AppIcon name="close" /></button>
        <span className="settings-dialog__icon"><AppIcon name="shield" /></span>
        <p className="app-eyebrow">SECURE ACCOUNT ACTION</p>
        <h2 id="change-password-title">Change password</h2>
        <p className="settings-dialog__intro">Enter your current password and choose a new one. Other active sessions will be revoked.</p>
        <form className="settings-password-form" onSubmit={submit} noValidate>
          <PasswordInput id="settings-current-password" label="Current password" name="current-password" value={form.currentPassword} onChange={handleField('currentPassword')} error={errors.currentPassword} autoComplete="current-password" />
          <PasswordInput id="settings-new-password" label="New password" name="new-password" value={form.newPassword} onChange={handleField('newPassword')} error={errors.newPassword} autoComplete="new-password" />
          <PasswordStrengthIndicator value={form.newPassword} />
          <PasswordInput id="settings-confirm-password" label="Confirm new password" name="confirm-new-password" value={form.confirmPassword} onChange={handleField('confirmPassword')} error={errors.confirmPassword} autoComplete="new-password" />
          {notice && <AuthNotice>{notice}</AuthNotice>}
          <div className="settings-dialog__actions"><button type="button" className="settings-dialog__cancel" onClick={close} disabled={busy}>Close</button><button type="submit" className="settings-dialog__submit" disabled={busy}>{busy ? 'Checking…' : 'Update password'}</button></div>
        </form>
      </section>
    </div>,
    document.body,
  );
}
