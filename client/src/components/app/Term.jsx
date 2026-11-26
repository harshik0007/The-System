import { useEffect, useId, useRef, useState } from 'react';
import '../../styles/terms.css';

const definitions = {
  Forfeit: 'A small action you choose in advance to complete if you miss a Task.',
  'Recovery Quest': 'The Forfeit linked to a missed Task, with 72 hours to complete it.',
  'Grace Point': 'One of your lives. You start with 3 Grace Points.',
  'Discipline Point': 'A reward for consistency that can be exchanged for a Grace Point.',
  'Progression Run': 'Your current stretch of progress, from its start until a reset.',
  IST: 'India Standard Time, used for daily deadlines and schedule dates.',
  XP: 'Experience points earned by completing scheduled Tasks.',
  Rank: 'One of seven milestones, from Origin up to Continuum.',
  Streak: 'Consecutive days with at least 5 scheduled Tasks completed.',
};

const termPattern = /\b(Recovery Quests?|Grace Points?|Discipline Points?|Progression Runs?|Forfeits?|Ranks?|Streaks?|IST|XP)\b/g;

export function TermText({ children }) {
  if (typeof children !== 'string') return children;
  const pieces = [];
  let lastIndex = 0;
  for (const match of children.matchAll(termPattern)) {
    const start = match.index;
    if (start > lastIndex) pieces.push(children.slice(lastIndex, start));
    const label = match[0];
    const normalized = label.endsWith('s') && label !== 'IST' && label !== 'XP' ? label.slice(0, -1) : label;
    pieces.push(<Term key={`${start}-${label}`} term={normalized}>{label}</Term>);
    lastIndex = start + label.length;
  }
  if (!pieces.length) return children;
  if (lastIndex < children.length) pieces.push(children.slice(lastIndex));
  return pieces;
}

export default function Term({ term, children }) {
  const id = useId();
  const rootRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const label = children ?? term;
  const definition = definitions[term] || definitions[term.replace(/s$/, '')];
  const open = hovered || focused || pinned;

  useEffect(() => {
    if (!pinned) return undefined;
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setPinned(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [pinned]);

  if (!definition) return label;

  return (
    <span
      className={`term${open ? ' term--open' : ''}`}
      ref={rootRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setPinned(false);
          setFocused(false);
          event.currentTarget.querySelector('button')?.blur();
        }
      }}
    >
      <button
        className="term__trigger"
        type="button"
        aria-label={`Definition: ${label}`}
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setPinned((value) => !value)}
      >
        {label}
      </button>
      <span className="term__popover" id={id} role="tooltip" aria-hidden={!open}>{definition}</span>
    </span>
  );
}
