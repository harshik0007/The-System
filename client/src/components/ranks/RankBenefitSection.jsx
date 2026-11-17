const pendingBenefit = 'Details pending. No XP amount, multiplier or qualification threshold has been assigned.';

export default function RankBenefitSection({ benefit }) {
  const description = benefit?.state === 'pending' ? pendingBenefit : (benefit?.description || pendingBenefit);

  return (
    <section className="rank-benefit" aria-labelledby="rank-benefit-title">
      <p className="public-eyebrow">RANK BENEFIT</p>
      <h3 id="rank-benefit-title">Rank-specific XP benefit</h3>
      <p>{description}</p>
    </section>
  );
}
