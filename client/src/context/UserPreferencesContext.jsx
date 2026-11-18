import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getEffectiveReducedMotion, normalizeUserPreferences, USER_PREFERENCES_SESSION_KEY } from '../utils/userPreferences.js';

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
  const [preferences, setPreferences] = useState(readPreferences);

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

  const savePreferences = useCallback((nextPreferences) => {
    setPreferences(normalizeUserPreferences(nextPreferences));
  }, []);

  const value = useMemo(() => ({ preferences, savePreferences }), [preferences, savePreferences]);
  return <UserPreferencesContext.Provider value={value}>{children}</UserPreferencesContext.Provider>;
}

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);
  if (!context) throw new Error('useUserPreferences must be used within UserPreferencesProvider.');
  return context;
}
