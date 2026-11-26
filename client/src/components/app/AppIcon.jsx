const icons = {
  dashboard: <><rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/></>,
  tasks: <><path d="m5 12 4 4L19 6"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></>,
  goals: <><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor" stroke="none"/></>,
  recovery: <><path d="M20 11a8 8 0 0 0-14.8-3L3 11"/><path d="M3 5v6h6"/><path d="M4 13a8 8 0 0 0 14.8 3L21 13"/><path d="M21 19v-6h-6"/></>,
  analysis: <><path d="M4 19.5h16"/><rect x="5.5" y="11" width="3.3" height="6.5" rx=".6"/><rect x="10.4" y="7.5" width="3.3" height="10" rx=".6"/><rect x="15.3" y="4.5" width="3.3" height="13" rx=".6"/></>,
  leaderboard: <><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5v2a4 4 0 0 0 4 4m7-6h3v2a4 4 0 0 1-4 4"/><path d="M12 13v4m-4 3h8m-7-3h6v3H9v-3Z"/></>,
  profile: <><circle cx="12" cy="8" r="3.3"/><path d="M5 20a7 7 0 0 1 14 0"/></>,
  settings: <><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  trash: <><path d="M4 7h16M10 11v6m4-6v6M5.5 7l1 13h11l1-13M9 7V4h6v3"/></>,
  check: <><path d="m5 12 4.2 4.2L19 6.5"/></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
  clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></>,
  pause: <><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></>,
  play: <><path d="M7 4.8a1 1 0 0 1 1.5-.86l10.4 7.2a1 1 0 0 1 0 1.72l-10.4 7.2A1 1 0 0 1 7 19.2V4.8Z"/></>,
  spark: <><path d="m12 3 1.7 6.3L20 11l-6.3 1.7L12 19l-1.7-6.3L4 11l6.3-1.7L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></>,
  shield: <><path d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></>,
  activity: <><path d="M3 12h4l2.3-6 4.4 12 2.3-6H21"/></>,
};

export default function AppIcon({ name, className = '', ...props }) {
  return (
    <svg className={`app-icon${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
      {icons[name] || icons.spark}
    </svg>
  );
}
