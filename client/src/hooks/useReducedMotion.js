import { useEffect, useState } from 'react';
import { useUserPreferences } from '../context/UserPreferencesContext.jsx';
import { getEffectiveReducedMotion } from '../utils/userPreferences.js';

export function useReducedMotion() {
  const { preferences } = useUserPreferences();
  const [reduced, setReduced] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = (event) => setReduced(event.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return getEffectiveReducedMotion(preferences, reduced) || !preferences.appearance.nonessentialAnimations;
}
