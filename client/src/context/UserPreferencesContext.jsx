import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { taskApi } from '../services/taskApi.js';
import { getEffectiveReducedMotion, normalizeUserPreferences, USER_PREFERENCES_SESSION_KEY } from '../utils/userPreferences.js';
import { isApplicationPath, isSharedInformationPath } from '../utils/routePaths.js';
import { useAuth } from './AuthContext.jsx';

const UserPreferencesContext = createContext(null);

function readPreferences() {
  if (typeof window === 'undefined') return normalizeUserPreferences(null);
  try {
    const stored = window.sessionStorage.getItem(USER_PREFERENCES_SESSION_KEY);
    return normalizeUserPreferences(stored ? JSON.parse(stored) : null);
  } catch {
    return normalizeUserPreferences(null);
  }
}

export function UserPreferencesProvider({ children }) {
  const { pathname } = useLocation();
  const { member } = useAuth();
  const isApplicationRoute = isApplicationPath(pathname) || Boolean(member && isSharedInformationPath(pathname));
  const memberKey = member?.id || member?.publicHandle || member?.username || null;
  const [ready, setReady] = useState(false);
  const [loadedMemberKey, setLoadedMemberKey] = useState(null);
  const [preferences, setPreferences] = useState(() => {
    const stored = readPreferences();
    return normalizeUserPreferences({
      ...stored,
      profile: { ...stored.profile, username: member?.username || stored.profile.username },
    });
  });

  useEffect(() => {
    if (!member?.username) return;
    setPreferences((current) => normalizeUserPreferences({
      ...current,
      profile: { ...current.profile, username: member.username },
    }));
  }, [member?.username]);

  const savePreferences = useCallback((nextPreferences) => {
    setPreferences(normalizeUserPreferences(nextPreferences));
  }, []);

  const mergePreferences = useCallback((updates) => {
    setPreferences((current) => normalizeUserPreferences({
      ...current,
      ...updates,
      profile: { ...current.profile, ...updates?.profile },
      privacy: { ...current.privacy, ...updates?.privacy },
      appearance: { ...current.appearance, ...updates?.appearance },
      accessibility: { ...current.accessibility, ...updates?.accessibility },
    }));
  }, []);

  const preferencesReady = ready && (!member || loadedMemberKey === memberKey);

  useEffect(() => {
    if (!isApplicationRoute || !member) {
      if (!member) {
        setPreferences(normalizeUserPreferences(null));
        setLoadedMemberKey(null);
      }
      setReady(true);
      return undefined;
    }
    const controller = new AbortController();
    setReady(false);
    if (loadedMemberKey !== memberKey) setLoadedMemberKey(null);
    taskApi.accountSettings({ signal: controller.signal }).then(({ settings }) => {
      savePreferences(normalizeUserPreferences({
        profile: settings.profile,
        privacy: settings.privacy,
        appearance: settings.appearance,
        accessibility: settings.accessibility,
      }));
      setLoadedMemberKey(memberKey);
    }).catch((error) => {
      if (error?.name !== 'AbortError') {
        // Keep the last in-memory/session copy available if account settings
        // cannot be reached; a later app entry will retry the server read.
        setLoadedMemberKey(memberKey);
      }
    }).finally(() => {
      if (!controller.signal.aborted) setReady(true);
    });
    return () => controller.abort();
  }, [isApplicationRoute, memberKey, savePreferences]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(USER_PREFERENCES_SESSION_KEY, JSON.stringify(preferences));
    } catch {
      // The preferences continue to work in memory when session storage is unavailable.
    }
  }, [preferences]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotionPreference = () => {
      const shouldReduceMotion = getEffectiveReducedMotion(preferences, query.matches)
        || !preferences.appearance.nonessentialAnimations;
      document.documentElement.classList.toggle('reduce-nonessential-motion', shouldReduceMotion);
    };
    syncMotionPreference();
    query.addEventListener('change', syncMotionPreference);
    return () => {
      query.removeEventListener('change', syncMotionPreference);
      document.documentElement.classList.remove('reduce-nonessential-motion');
    };
  }, [preferences]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (isApplicationRoute && member && preferencesReady) {
      root.dataset.effectQuality = preferences.appearance.effectQuality || 'balanced';
    } else {
      delete root.dataset.effectQuality;
    }
  }, [isApplicationRoute, member, preferences.appearance.effectQuality, preferencesReady]);

  const value = useMemo(() => ({ preferences, ready: preferencesReady, savePreferences, mergePreferences }), [preferences, preferencesReady, savePreferences, mergePreferences]);
  return <UserPreferencesContext.Provider value={value}>{children}</UserPreferencesContext.Provider>;
}

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);
  if (!context) throw new Error('useUserPreferences must be used within UserPreferencesProvider.');
  return context;
}

// Global decorative UI (page transitions and VOID SHARD) also renders on public
// routes, outside the authenticated preferences provider. These consumers can
// safely fall back to device defaults until member preferences are available.
export function useOptionalUserPreferences() {
  return useContext(UserPreferencesContext);
}
