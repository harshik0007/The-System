import { Link } from 'react-router-dom';
import AppIcon from './AppIcon.jsx';

const CHECKLIST_ITEMS = [
  { key: 'planCreated', label: 'Create your plan', to: '/app/tasks/create', icon: 'tasks', action: 'Set up Tasks' },
  { key: 'firstTaskCompleted', label: 'Complete your first Task', to: '/app/tasks', icon: 'check', action: 'Open Tasks' },
  { key: 'leaderboardVisited', label: 'See where you stand on the Leaderboard', to: '/app/leaderboard', icon: 'leaderboard', action: 'View Leaderboard' },
];

export default function FirstRunChecklist({ progress }) {
  const completedCount = CHECKLIST_ITEMS.filter((item) => progress[item.key]).length;
  if (completedCount === CHECKLIST_ITEMS.length) return null;

  return <section className="first-run-checklist" aria-labelledby="first-run-checklist-title">
    <div className="first-run-checklist__heading">
      <div><p className="app-eyebrow">YOUR FIRST STEPS</p><h2 id="first-run-checklist-title">A simple start</h2><p>Three small steps to get comfortable with THE SYSTEM.</p></div>
      <span className="first-run-checklist__count" aria-label={`${completedCount} of 3 steps complete`}>{completedCount}<i>/</i>3</span>
    </div>
    <ol className="first-run-checklist__items">
      {CHECKLIST_ITEMS.map((item) => <li key={item.key} className={progress[item.key] ? 'is-complete' : ''}>
        <span className="first-run-checklist__icon"><AppIcon name={progress[item.key] ? 'check' : item.icon} /></span>
        <span className="first-run-checklist__label">{item.label}</span>
        {progress[item.key]
          ? <span className="first-run-checklist__done">Done</span>
          : <Link to={item.to}>{item.action}<AppIcon name="arrow" /></Link>}
      </li>)}
    </ol>
  </section>;
}
