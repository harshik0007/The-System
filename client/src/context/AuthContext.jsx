import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { TASK_SCHEDULE_SESSION_KEY } from '../utils/systemDataReset.js';
import { USER_PREFERENCES_SESSION_KEY } from '../utils/userPreferences.js';
import { authService } from '../services/authService.js';

const AuthContext = createContext(null);
const MEMBER_SESSION_KEY = 'the-system-auth-member-v1';
const PRIVATE_SESSION_KEYS = [TASK_SCHEDULE_SESSION_KEY, USER_PREFERENCES_SESSION_KEY];

function clearPrivateBrowserState() {
  try { for (const key of PRIVATE_SESSION_KEYS) window.sessionStorage.removeItem(key); } catch { /* Server remains authoritative. */ }
}

function saveMemberScope(member) {
  if (typeof window === 'undefined') return;
  let previous = null;
  try { previous = window.sessionStorage.getItem(MEMBER_SESSION_KEY); } catch { /* Continue without persisted scope. */ }
  const next = member?.id || member?.publicHandle || null;
  if (previous !== next) clearPrivateBrowserState();
  try {
    if (next) window.sessionStorage.setItem(MEMBER_SESSION_KEY, next);
    else window.sessionStorage.removeItem(MEMBER_SESSION_KEY);
  } catch { /* Browser storage is not used to authenticate. */ }
}

export function AuthProvider({ children }) {
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restoringSession, setRestoringSession] = useState(true);
  const [error, setError] = useState('');
  const [capabilities, setCapabilities] = useState(null);
  const sequence = useRef(0);

  const commitMember = useCallback((nextMember) => {
    saveMemberScope(nextMember || null);
    setMember(nextMember || null);
    setError('');
  }, []);

  const refresh = useCallback(async () => {
    const requestSequence = ++sequence.current;
    setLoading(true);
    try {
      const result = await authService.currentMember();
      if (requestSequence !== sequence.current) return result.member || null;
      commitMember(result.authenticated ? result.member : null);
      return result.authenticated ? result.member : null;
    } catch (requestError) {
      if (requestSequence === sequence.current) {
        commitMember(null);
        setError(requestError?.message || 'Your account session could not be checked.');
      }
      return null;
    } finally {
      if (requestSequence === sequence.current) {
        setLoading(false);
        setRestoringSession(false);
      }
    }
  }, [commitMember]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    let mounted = true;
    authService.capabilities().then(({ capabilities: result }) => { if (mounted) setCapabilities(result); }).catch(() => { if (mounted) setCapabilities({ localPassword: true, googleSignIn: false }); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      sequence.current += 1;
      commitMember(null);
      setLoading(false);
      setRestoringSession(false);
    };
    window.addEventListener('system:auth-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('system:auth-unauthorized', handleUnauthorized);
  }, [commitMember]);

  const signUp = useCallback(async (details) => {
    const result = await authService.signUp(details);
    if (result.member) commitMember(result.member);
    return result;
  }, [commitMember]);

  const login = useCallback(async (credentials) => {
    const requestSequence = ++sequence.current;
    // The login screen is already interactive, so this is no longer session
    // restoration. Keep global UI such as the custom cursor mounted while the
    // credential request is pending or returning a warning.
    setRestoringSession(false);
    setLoading(true);
    try {
      const result = await authService.login(credentials);
      if (requestSequence === sequence.current) commitMember(result.member);
      return result;
    } finally {
      if (requestSequence === sequence.current) {
        setLoading(false);
        setRestoringSession(false);
      }
    }
  }, [commitMember]);

  const completeGoogleSignup = useCallback(async (details) => {
    const result = await authService.completeGoogleSignup(details);
    if (result.member) commitMember(result.member);
    return result;
  }, [commitMember]);

  const changePassword = useCallback(async (credentials) => {
    const result = await authService.changePassword(credentials);
    if (result.member) commitMember(result.member);
    return result;
  }, [commitMember]);

  const resetPassword = useCallback(async (details) => {
    const result = await authService.resetPassword(details);
    commitMember(null);
    return result;
  }, [commitMember]);

  const regenerateRecoveryCodes = useCallback((details) => authService.regenerateRecoveryCodes(details), []);
  const updateIdentity = useCallback(async (details) => {
    const result = await authService.updateIdentity(details);
    if (result.member) commitMember(result.member);
    return result;
  }, [commitMember]);
  const usernameAvailability = useCallback((username, options) => authService.usernameAvailability(username, options), []);
  const googlePending = useCallback(() => authService.googlePending(), []);

  const logout = useCallback(async () => {
    const requestSequence = ++sequence.current;
    await authService.logout();
    if (requestSequence === sequence.current) commitMember(null);
  }, [commitMember]);

  const deleteAccount = useCallback(async (details) => {
    const requestSequence = ++sequence.current;
    const result = await authService.deleteAccount(details);
    if (requestSequence === sequence.current) commitMember(null);
    return result;
  }, [commitMember]);

  const value = useMemo(() => ({
    member, loading, restoringSession, error, capabilities, refresh, signUp, login, completeGoogleSignup,
    resetPassword, changePassword, regenerateRecoveryCodes, updateIdentity,
    usernameAvailability, googlePending, logout, deleteAccount,
  }), [member, loading, restoringSession, error, capabilities, refresh, signUp, login, completeGoogleSignup,
    resetPassword, changePassword, regenerateRecoveryCodes, updateIdentity,
    usernameAvailability, googlePending, logout, deleteAccount]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
