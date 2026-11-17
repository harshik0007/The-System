const line = (d, className = '') => ({ type: 'path', d, className });
const circle = (cx, cy, r, className = '') => ({ type: 'circle', cx, cy, r, className });

export const ranks = [
  {
    number: '07', progressionOrder: 1, name: 'Origin', slug: 'origin', colorName: 'Ice Blue', color: '#78C9F2', prefix: 'OR', aura: 'origin', demo: { membersEarned: 42816, exampleSerial: 'OR.18426' }, xpBenefit: { state: 'pending' },
    spectrum: 'linear-gradient(112deg, #78C9F2, #d9f4ff 52%, #78C9F2)',
    shortDescription: 'Every meaningful change begins with a deliberate first step.',
    description: 'Every meaningful change begins with a deliberate first step. This is where your progression starts.',
    emblem: [circle(50, 50, 31, 'thin'), line('M50 12 58 42 88 50 58 58 50 88 42 58 12 50 42 42 50 12Z'), line('M50 25v25l18 10', 'thin'), circle(50, 50, 4, 'core')],
    badge: { frame: 'M90 5 143 27 151 80 139 137 90 183 41 137 29 80 37 27Z', motif: 'M90 43v22l17 10' },
  },
  {
    number: '06', progressionOrder: 2, name: 'Ember', slug: 'ember', colorName: 'Flame Orange', color: '#FF9857', prefix: 'EM', aura: 'ember', demo: { membersEarned: 28204, exampleSerial: 'EM.10284' }, xpBenefit: { state: 'pending' },
    spectrum: 'linear-gradient(112deg, #FF9857, #ffe0ad 52%, #FF9857)',
    shortDescription: 'Small actions begin to form a lasting pattern.',
    description: 'Small actions begin to form a pattern. A commitment becomes something you return to.',
    emblem: [line('M51 12c3 15-10 19-5 32 3-7 10-9 13-17 15 18 18 31 10 44-7 12-24 15-36 6-13-10-10-26-2-37 3 9 7 12 12 14-3-19 11-25 8-42Z'), line('M50 54c8 7 12 14 8 22-3 6-12 8-17 2-5-6 0-14 9-24Z', 'thin')],
    badge: { frame: 'M90 7 112 20 128 17 136 37 152 53 143 75 147 98 129 113 122 138 101 145 90 178 79 145 58 138 51 113 33 98 37 75 28 53 44 37 52 17 68 20Z', motif: 'M90 43c0 12-10 16-9 28 1 8 10 13 17 7 6-5 2-12-2-17-2 8-8 9-8 15' },
  },
  {
    number: '05', progressionOrder: 3, name: 'Surge', slug: 'surge', colorName: 'Turquoise', color: '#54D7C5', prefix: 'SU', aura: 'surge', demo: { membersEarned: 16742, exampleSerial: 'SU.05291' }, xpBenefit: { state: 'pending' },
    spectrum: 'linear-gradient(112deg, #54D7C5, #d5fff6 52%, #54D7C5)',
    shortDescription: 'Repeated effort creates momentum.',
    description: 'Repeated effort creates momentum. Your progress becomes visible through what you keep doing.',
    emblem: [line('M11 36c12-17 23-17 39 0s27 17 39 0M11 50c12-17 23-17 39 0s27 17 39 0M11 64c12-17 23-17 39 0s27 17 39 0'), line('M50 13v12m0 50v12', 'thin')],
    badge: { frame: 'M90 7c14 12 37 8 48 23 11 14 2 31 6 48 5 20-10 38-25 48-11 9-18 25-29 34-11-9-18-25-29-34-15-10-30-28-25-48 4-17-5-34 6-48C53 15 76 19 90 7Z', motif: 'M47 77c12-14 24-14 36 0s24 14 36 0M51 91c10-11 20-11 30 0s20 11 30 0M57 105c8-8 16-8 24 0s16 8 24 0' },
  },
  {
    number: '04', progressionOrder: 4, name: 'Vector', slug: 'vector', colorName: 'Electric Blue', color: '#579EFF', prefix: 'VE', aura: 'vector', demo: { membersEarned: 8359, exampleSerial: 'VE.02114' }, xpBenefit: { state: 'pending' },
    spectrum: 'linear-gradient(112deg, #579EFF, #dcf0ff 52%, #579EFF)',
    shortDescription: 'Focused effort gives your progress direction.',
    description: 'Your effort has direction. Commitments become deliberate, focused and increasingly reliable.',
    emblem: [line('M50 9 86 50 50 91 14 50 50 9Z'), line('M30 50h41m-12-12 12 12-12 12M50 29v42', 'thin'), circle(50, 50, 4, 'core')],
    badge: { frame: 'M90 5 158 74 90 179 22 74Z', motif: 'M90 38v48m-24-24h48m-10-12 12 12-12 12' },
  },
  {
    number: '03', progressionOrder: 5, name: 'Apex', slug: 'apex', colorName: 'Royal Violet', color: '#A38BFF', prefix: 'AP', aura: 'apex', demo: { membersEarned: 3412, exampleSerial: 'AP.00703' }, xpBenefit: { state: 'pending' },
    spectrum: 'linear-gradient(112deg, #A38BFF, #eee8ff 52%, #A38BFF)',
    shortDescription: 'Strong performance becomes dependable.',
    description: 'Strong performance becomes dependable. Progress is sustained across meaningful commitments.',
    emblem: [line('M13 79 38 37 49 53 64 20 88 79H13Z'), line('M29 79 48 53 68 79M38 37l10 16 16-33', 'thin'), line('M37 34 39 25 43 32 51 31 46 37 49 45 41 40 34 45 36 37Z')],
    badge: { frame: 'M90 6 112 31 143 17 139 54 161 72 136 94 147 133 111 128 90 176 69 128 33 133 44 94 19 72 41 54 37 17 68 31Z', motif: 'M47 115 68 72 82 94 99 56 134 115M60 115 88 79 119 115M79 62l11-13 11 13' },
  },
  {
    number: '02', progressionOrder: 6, name: 'Zenith', slug: 'zenith', colorName: 'Radiant Gold', color: '#F2C96B', prefix: 'ZE', aura: 'zenith', demo: { membersEarned: 1106, exampleSerial: 'ZE.01028' }, xpBenefit: { state: 'pending' },
    emblemName: 'SOLAR DIADEM',
    palette: { shadow: '#3B2514', bronze: '#9B692D', main: '#F2C96B', champagne: '#FFE8AF', platinum: '#F5FAFF' },
    spectrum: 'linear-gradient(112deg, #3B2514 0%, #9B692D 32%, #F2C96B 58%, #FFE8AF 78%, #F5FAFF 100%)',
    badgeColors: ['#3B2514', '#9B692D', '#F2C96B', '#FFE8AF', '#F5FAFF'],
    shortDescription: 'Exceptional discipline sets a higher standard.',
    description: 'A high standard is supported by sustained discipline and intentional choices over time.',
    emblem: null,
    badge: { frame: 'M90 5 137 24 157 58 145 94 127 126 90 220 53 126 35 94 23 58 43 24Z', motif: 'M34 76h10m-10 6h7m105-6h-10m10 6h-7M35 131l10-8m90 0 10 8' },
  },
  {
    number: '01', progressionOrder: 7, name: 'Continuum', slug: 'continuum', emblemName: 'INTERLINKED CONVERGENCE SIGIL', badgeTitle: 'THE ULTIMATE ACHIEVEMENT', colorName: 'Crimson Metal', color: '#F0443E', prefix: 'CO', aura: 'continuum', demo: { membersEarned: 284, exampleSerial: 'CO.00034' }, xpBenefit: { state: 'pending' },
    palette: { deep: '#450712', shadow: '#190D18', darkCrimson: '#7F1024', crimson: '#B8203F', scarlet: '#F0443E', highlight: '#FF6670', platinum: '#F5FAFF' },
    spectrum: 'linear-gradient(112deg, #190D18 0%, #450712 16%, #7F1024 34%, #B8203F 55%, #F0443E 76%, #FF6670 91%, #F5FAFF 100%)',
    badgeColors: ['#450712', '#7F1024', '#B8203F', '#F0443E', '#FF6670', '#F5FAFF'],
    shortDescription: 'The highest expression of sustained progress.',
    description: 'The highest Rank in THE SYSTEM, marking a sustained commitment to deliberate work, adaptability and continued progress.',
    emblem: null,
    badge: { frame: 'M90 5 110 22 138 20 145 43 161 58 153 84 155 132 135 159 90 220 45 159 25 132 27 84 19 58 35 43 42 20 70 22Z', motif: 'M32 58h10m-10 6h7m109-6h-10m10 6h-7M29 132l14-10m108 10-14-10' },
  },
];

export const rankDemoDisclosure = 'Demonstration data only — earned-member counts and serials shown here are examples, not live platform statistics or assignments.';

export function getRankDeletionPolicy(rankNumber) {
  return Number(rankNumber) >= 3
    ? 'If an account is deleted, the historical earned-member count and this Rank’s serial positions remain counted. Other Members’ serials do not change, and the deleted Member’s identity and profile are not exposed.'
    : 'If an account is deleted, remove that Member’s badge entry and reduce this Rank’s earned-member count by exactly one. Higher serials within this Rank shift down by one with no gaps. Serial numbers for other Ranks do not change.';
}
