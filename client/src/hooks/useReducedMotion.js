import { useEffect, useState } from 'react';
import { useOptionalUserPreferences } from '../context/UserPreferencesContext.jsx';
import { getEffectiveReducedMotion } from '../utils/userPreferences.js';

export function useReducedMotion() {
  const context = useOptionalUserPreferences();
  const preferences = context?.preferences;
  const [reduced, setReduced] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = (event) => setReduced(event.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return preferences
    ? getEffectiveReducedMotion(preferences, reduced) || !preferences.appearance.nonessentialAnimations
    : reduced;
}
