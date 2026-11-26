import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import RankBadge from './RankBadge.jsx';

/** Reusable one-time presentation. `active` must come from a future earned-state flow. */
export default function RankUnlockReveal({ rank, serialNumber, active = false, onComplete = () => {} }) {
  const dialogRef = useRef(null);
  const continueRef = useRef(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (active && dialog && !dialog.open) {
      dialog.showModal();
      continueRef.current?.focus();
    } else if (!active && dialog?.open) {
      dialog.close();
    }
  }, [active]);

  if (!active) return null;

  const finish = () => {
    if (dialogRef.current?.open) dialogRef.current.close();
  };

  return (
    <dialog
      ref={dialogRef}
      className={`rank-unlock-dialog${reducedMotion ? ' rank-unlock-dialog--still' : ''}`}
      aria-labelledby="rank-unlock-title"
      onClose={onComplete}
    >
      <div className={`rank-unlock-reveal${rank.slug === 'continuum' ? ' rank-unlock-reveal--continuum' : ''}${reducedMotion ? ' is-still' : ''}`}>
        <p className="rank-unlock-reveal__eyebrow">PROGRESSION ACHIEVEMENT</p>
        <h2 id="rank-unlock-title" className="rank-unlock-reveal__title">Rank {rank.number} · {rank.name}</h2>
        <div className="rank-unlock-reveal__badge">
          <RankBadge rank={rank} serialNumber={serialNumber} size="large" presentation="earned" unlocking />
        </div>
        <p className="rank-unlock-reveal__serial" aria-live="polite">{serialNumber || 'SERIAL PENDING'}</p>
        <p className="rank-unlock-reveal__copy" aria-live="polite">Rank badge unlocked.</p>
        <button ref={continueRef} type="button" className="button button--quiet rank-unlock-reveal__continue" onClick={finish}>CONTINUE</button>
      </div>
    </dialog>
  );
}
