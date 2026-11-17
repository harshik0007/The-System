const line = (d, className = '') => ({ type: 'path', d, className });
const circle = (cx, cy, r, className = '') => ({ type: 'circle', cx, cy, r, className });

export const progressionStages = [
  {
    number: '01', color: '#82b6dc', description: 'A starting point for turning an intention into a deliberate first step.',
    emblem: [circle(50, 50, 29), circle(50, 50, 18, 'thin'), line('M50 9v17M50 74v17M9 50h17m48 0h17'), circle(50, 50, 4, 'core')],
  },
  {
    number: '02', color: '#68c6e6', description: 'A commitment begins to take shape through actions you can return to.',
    emblem: [line('M50 10 62 37 83 50 62 63 50 90 38 63 17 50 38 37 50 10Z'), line('M50 27 56 44 73 50 56 56 50 73 44 56 27 50 44 44 50 27Z', 'thin'), circle(50, 50, 4, 'core')],
  },
  {
    number: '03', color: '#55d8e9', description: 'Repeated effort can make a pattern of progress easier to see.',
    emblem: [line('M12 39c12-17 23-17 38 0s26 17 38 0M12 52c12-17 23-17 38 0s26 17 38 0M12 65c12-17 23-17 38 0s26 17 38 0'), line('M50 12v15m0 46v15', 'thin')],
  },
  {
    number: '04', color: '#72b8ff', description: 'Effort gains direction as your chosen commitments become more focused.',
    emblem: [line('M50 10 84 50 50 90 16 50 50 10Z'), line('M50 25v50M25 50h50M32 32l36 36m0-36L32 68'), line('m50 18 7 7-7 7-7-7 7-7Z', 'thin'), circle(50, 50, 4, 'core')],
  },
  {
    number: '05', color: '#8b9fff', description: 'A higher point of focus, built from the steps that came before it.',
    emblem: [line('M12 78 39 27l11 20 12-34 26 65H12Z'), line('M29 78 50 47l20 31M39 27l8 14 15-28M50 47l-7 31', 'thin'), circle(62, 13, 3.5, 'core')],
  },
  {
    number: '06', color: '#ad9cff', description: 'A sustained practice supported by deliberate choices over time.',
    emblem: [circle(50, 50, 34, 'thin'), line('M50 8 59 39 91 50 59 61 50 92 41 61 9 50 41 39 50 8Z'), line('m50 27 6 17 17 6-17 6-6 17-6-17-17-6 17-6 6-17Z', 'thin'), circle(50, 50, 4, 'core')],
  },
  {
    number: '07', color: '#d2c3ff', description: 'A continuing path, with room to keep learning and moving forward.',
    emblem: [line('M50 9 72 22 85 50 72 78 50 91 28 78 15 50 28 22 50 9Z'), line('M25 50c0-13 10-23 22-23 14 0 18 18 27 18 7 0 12-6 12-13M75 50c0 13-10 23-22 23-14 0-18-18-27-18-7 0-12 6-12 13'), line('M50 9v18m0 46v18', 'thin'), circle(50, 50, 4, 'core')],
  },
];
