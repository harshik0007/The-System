import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import AuthCard from '../../components/auth/AuthCard.jsx';
import PrimaryButton from '../../components/auth/PrimaryButton.jsx';
import AuthNotice from '../../components/auth/AuthNotice.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function RecoveryCodesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { member, loading } = useAuth();
  const codes = useMemo(() => Array.isArray(location.state?.codes) ? location.state.codes : [], [location.state]);
  const next = typeof location.state?.next === 'string' && location.state.next.startsWith('/app/') ? location.state.next : '/app/tasks/create';
  const [acknowledged, setAcknowledged] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!loading && !member) navigate('/login', { replace: true, state: { notice: 'Sign in to continue. Recovery codes are only shown immediately after they are generated.' } });
    if (!loading && member && codes.length !== 10) navigate('/app/settings?category=security', { replace: true, state: { notice: 'Recovery codes are only displayed once when generated.' } });
  }, [codes.length, loading, member, navigate]);

  useEffect(() => {
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    if (codes.length === 10 && !acknowledged) window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [acknowledged, codes.length]);

  const copyCodes = async () => {
    try { await navigator.clipboard.writeText(codes.join('\n')); setFeedback('Recovery codes copied. Save them somewhere private.'); }
    catch { setFeedback('Clipboard access is unavailable. Select and copy the codes manually.'); }
  };
  const downloadCodes = () => {
    const blob = new Blob([`THE SYSTEM recovery codes\nAccount: ${member?.username || 'member'}\n\n${codes.join('\n')}\n\nEach code can be used once. Store this file privately.\n`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'the-system-recovery-codes.txt'; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeedback('Recovery code file downloaded. Store it privately.');
  };

  if (loading || !member || codes.length !== 10) return null;
  return <AuthLayout compact><AuthCard eyebrow="THE SYSTEM / SAVE YOUR ACCESS" title="Save your recovery codes" description="These ten codes are shown once. Each code can reset your password one time. They are not sent by email and cannot be retrieved later.">
    <AuthNotice variant="warning">Keep these codes private. Anyone with a code and your account identifier can reset the account password.</AuthNotice>
    <div className="auth-recovery-code-grid" aria-label="Ten one-time recovery codes">{codes.map((code, index) => <code key={`${index}-${code}`}><span>{String(index + 1).padStart(2, '0')}</span>{code}</code>)}</div>
    <div className="auth-recovery-code-actions"><button className="auth-secondary-button" type="button" onClick={copyCodes}>Copy codes</button><button className="auth-secondary-button" type="button" onClick={downloadCodes}>Download codes</button></div>
    {feedback && <p role="status" className="auth-field__hint">{feedback}</p>}
    <div className="auth-checkbox-row"><input id="recovery-saved" type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><label htmlFor="recovery-saved">I have saved these recovery codes in a private place.</label></div>
    <PrimaryButton disabled={!acknowledged} onClick={() => navigate(next, { replace: true })}>Continue to schedule setup</PrimaryButton>
    <p className="auth-switch"><Link to="/app/settings?category=security">Account security</Link></p>
  </AuthCard></AuthLayout>;
}
