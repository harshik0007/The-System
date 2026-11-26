export const USER_PREFERENCES_SESSION_KEY = 'the-system-user-preferences-v1';

export function createDefaultUserPreferences() {
  return {
    profile: {
      username: '',
      avatarMark: 'initials',
    },
    privacy: {
      publicProfile: true,
      fullName: true,
      activityMap: true,
      personalBest: true,
      currentRank: true,
      level: true,
      progressionStats: true,
      currentStreak: true,
      longestStreak: true,
      disciplinePointBalance: true,
      gracePointBalance: true,
    },
    appearance: {
      nonessentialAnimations: true,
      reduceDecorativeEffects: false,
      effectQuality: 'balanced',
    },
    accessibility: {
      // null follows the device preference until the member explicitly chooses.
      reduceMotion: null,
    },
  };
}

export function normalizeUserPreferences(value) {
  const defaults = createDefaultUserPreferences();
  if (!value || typeof value !== 'object') return defaults;

  return {
    profile: {
      username: typeof value.profile?.username === 'string' ? value.profile.username : defaults.profile.username,
      avatarMark: ['initials', 'spark', 'shield', 'activity', 'profile'].includes(value.profile?.avatarMark)
        ? value.profile.avatarMark
        : defaults.profile.avatarMark,
    },
    privacy: Object.fromEntries(Object.keys(defaults.privacy).map((key) => [key,
      typeof value.privacy?.[key] === 'boolean' ? value.privacy[key] : defaults.privacy[key],
    ])),
    appearance: {
      ...Object.fromEntries(Object.keys(defaults.appearance).map((key) => [key,
        key === 'effectQuality'
          ? (['high', 'balanced', 'low'].includes(value.appearance?.[key]) ? value.appearance[key] : defaults.appearance[key])
          : typeof value.appearance?.[key] === 'boolean' ? value.appearance[key] : defaults.appearance[key],
      ])),
    },
    accessibility: {
      reduceMotion: typeof value.accessibility?.reduceMotion === 'boolean' ? value.accessibility.reduceMotion : null,
    },
  };
}

export function updatePreferenceGroup(preferences, group, key, value) {
  return normalizeUserPreferences({
    ...preferences,
    [group]: { ...preferences?.[group], [key]: value },
  });
}

export function getEffectiveReducedMotion(preferences, systemPreference) {
  const explicitPreference = preferences?.accessibility?.reduceMotion;
  return explicitPreference === null || explicitPreference === undefined
    ? Boolean(systemPreference)
    : explicitPreference;
}
