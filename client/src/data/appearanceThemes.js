export const APPEARANCE_THEMES = Object.freeze([
  Object.freeze({
    id: 'dark-navy',
    name: 'Dark Navy',
    requirement: 'Always available',
    requiredRankNumber: null,
    minimumLevel: 0,
    description: 'The original THE SYSTEM appearance, with deep navy layers and cool cyan signals.',
    colors: ['#070B13', '#101C2D', '#69BFFF'],
    transition: Object.freeze({
      accent: '#69BFFF',
      secondary: '#4DE0EF',
      background: '#070B13',
      surface: '#101C2D',
      glow: 'rgb(67 176 238 / 32%)',
      text: '#EDF5FF',
      completion: '#4DE0EF',
      emblem: Object.freeze({
        viewBox: '0 0 40 40',
        paths: Object.freeze([
          'M20 2.8 35 11.4v17.2L20 37.2 5 28.6V11.4L20 2.8Z',
          'M20 8.5 30 14.2v11.6L20 31.5 10 25.8V14.2L20 8.5Z',
          'M20 12.5v15M12.5 20h15m-12.8-5.3 10.6 10.6m0-10.6L14.7 25.3',
        ]),
      }),
    }),
  }),
  Object.freeze({
    id: 'obsidian',
    name: 'Obsidian',
    requirement: 'Rank 05 — Surge or higher',
    requiredRankNumber: 5,
    minimumLevel: 20,
    description: 'A premium graphite finish with charcoal surfaces, precise amber accents and restrained molten light.',
    colors: ['#0B0B0F', '#15171C', '#FF8A3D'],
    transition: Object.freeze({
      accent: '#FF8A3D',
      secondary: '#FFC166',
      background: '#0B0B0F',
      surface: '#211710',
      glow: 'rgb(255 138 61 / 38%)',
      text: '#FFF2E4',
      completion: '#FFE0A3',
      emblem: Object.freeze({
        viewBox: '0 0 40 40',
        paths: Object.freeze([
          'M20 2.8 35 11.4v17.2L20 37.2 5 28.6V11.4L20 2.8Z',
          'M20 8.5 30 14.2v11.6L20 31.5 10 25.8V14.2L20 8.5Z',
          'M20 11v18m-5-13 5 4 5-4m-11 9 6-5 6 5',
        ]),
      }),
    }),
  }),
  Object.freeze({
    id: 'aurora',
    name: 'Aurora',
    requirement: 'Rank 03 — Apex or higher',
    requiredRankNumber: 3,
    minimumLevel: 50,
    description: 'Midnight surfaces, violet atmosphere and clear aurora-teal light for a calm, premium interface.',
    colors: ['#080D1B', '#17213A', '#9270FF'],
    transition: Object.freeze({
      accent: '#9270FF',
      secondary: '#45DCC4',
      background: '#080D1B',
      surface: '#17213A',
      glow: 'rgb(181 162 255 / 38%)',
      text: '#F3F6FF',
      completion: '#8EDFFF',
      emblem: Object.freeze({
        viewBox: '0 0 40 40',
        paths: Object.freeze([
          'M20 2.8 35 11.4v17.2L20 37.2 5 28.6V11.4L20 2.8Z',
          'M10 29C14 20 17 13 20 8',
          'M17 31c3-8 6-14 9-20',
          'M24 31c2-5 4-9 7-13',
          'M9 29h22',
        ]),
      }),
    }),
  }),
  Object.freeze({
    id: 'eclipse',
    name: 'Eclipse',
    requirement: 'Rank 02 — Zenith or higher',
    requiredRankNumber: 2,
    minimumLevel: 75,
    description: 'A lunar-black interface edged in violet corona light, cool silver and quiet cosmic depth.',
    colors: ['#090812', '#201B35', '#A78BFA'],
    transition: Object.freeze({
      accent: '#A78BFA',
      secondary: '#C8C9E0',
      background: '#090812',
      surface: '#201B35',
      glow: 'rgb(167 139 250 / 34%)',
      text: '#F4F2FF',
      completion: '#E7DFFF',
      emblem: Object.freeze({
        viewBox: '0 0 40 40',
        paths: Object.freeze([
          'M20 3a17 17 0 1 0 0 34a17 17 0 0 0 0-34Z',
          'M20 7a13 13 0 1 1 0 26a10 10 0 0 0 0-26Z',
          'M8 20h3m18 0h3M20 3v3m0 28v3',
        ]),
      }),
    }),
  }),
  Object.freeze({
    id: 'galaxion',
    name: 'Galaxion',
    subtitle: 'The Galaxy Within',
    requirement: 'Rank 01 — Continuum',
    requiredRankNumber: 1,
    minimumLevel: 100,
    description: 'The void-black Rank 01 interface, traced with stellar blue, royal violet and quiet champagne light.',
    colors: ['#050507', '#171820', '#527DCD'],
    transition: Object.freeze({
      durationSeconds: 8,
      accent: '#527DCD',
      secondary: '#5540A0',
      background: '#050507',
      surface: '#171820',
      glow: 'rgb(82 125 205 / 30%)',
      text: '#E9E9F1',
      completion: '#D3A477',
      emblem: Object.freeze({
        viewBox: '0 0 64 64',
        paths: Object.freeze([
          'M32 8a24 24 0 1 0 0 48a24 24 0 0 0 0-48Z',
          'M11 31c9-10 33-12 43-2-10 11-34 13-44 3 7-8 29-10 39-2-8 8-25 10-34 3',
          'M32 13a19 19 0 1 0 0 38a19 19 0 0 0 0-38Z',
          'M32 23a9 9 0 1 0 0 18a9 9 0 0 0 0-18Z',
        ]),
      }),
    }),
  }),
]);

export function getAppearanceTheme(themeId) {
  return APPEARANCE_THEMES.find(({ id }) => id === themeId) || APPEARANCE_THEMES[0];
}

export function getNextAppearanceThemeReward(rankNumber) {
  const currentRankNumber = Number(rankNumber);
  if (!Number.isInteger(currentRankNumber) || currentRankNumber < 1 || currentRankNumber > 7) return null;

  const theme = APPEARANCE_THEMES.find(({ requiredRankNumber }) => Number.isInteger(requiredRankNumber) && currentRankNumber > requiredRankNumber);
  if (!theme) return null;

  const totalRankSteps = 7 - theme.requiredRankNumber;
  const completedRankSteps = Math.max(0, 7 - currentRankNumber);
  return {
    theme,
    totalRankSteps,
    completedRankSteps,
    remainingRankSteps: Math.max(0, currentRankNumber - theme.requiredRankNumber),
    progressPercent: totalRankSteps > 0 ? Math.min(100, Math.round((completedRankSteps / totalRankSteps) * 100)) : 0,
  };
}

export function isAppearanceThemeEligible(themeId, level = 0) {
  const theme = APPEARANCE_THEMES.find(({ id }) => id === themeId);
  return Boolean(theme && Number.isInteger(Number(level)) && Number(level) >= theme.minimumLevel);
}
