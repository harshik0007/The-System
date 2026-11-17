import { getRankDisciplineConfig } from '../../data/disciplineConfig.js';

export default function RankBenefitSection({ rank }) {
  const benefit = getRankDisciplineConfig(rank.slug);
  return (
    <section className="rank-benefit" aria-labelledby="rank-benefit-title">
      <p className="public-eyebrow">RANK BENEFIT</p>
      <h3 id="rank-benefit-title">Rank {benefit.number} · {benefit.name} rewards</h3>
      <ul className="rank-benefit__list">
        <li><span>Recurring Discipline reward</span><strong>+{benefit.recurringDp.toFixed(2)} DP · every {benefit.cycleDays} qualifying days</strong></li>
        <li><span>One-time Rank-entry DP</span><strong>{benefit.entryDp > 0 ? `+${benefit.entryDp.toFixed(2)} DP once per progression run` : 'No entry reward'}</strong></li>
        <li><span>Daily Rank XP benefit</span><strong>{benefit.dailyXpPercent.toFixed(2)}% of the next-Level XP requirement at reset</strong></li>
        <li><span>One-time Rank-entry XP</span><strong>Pending configuration · no XP awarded</strong></li>
      </ul>
      <p className="rank-benefit__note">Discipline Point rewards share a 4.00 DP cap. Next-Level XP calculations use the current frontend demonstration threshold curve.</p>
    </section>
  );
}
