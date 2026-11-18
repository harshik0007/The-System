import AppIcon from './AppIcon.jsx';

const MARKS = {
  spark: 'spark',
  shield: 'shield',
  activity: 'activity',
  profile: 'profile',
};

export default function MemberAvatar({ name = 'Member', mark = 'initials', className = '', ...props }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'M';
  const icon = MARKS[mark];

  return (
    <span className={`member-avatar member-avatar--${mark}${className ? ` ${className}` : ''}`} aria-hidden="true" {...props}>
      {icon ? <AppIcon name={icon} /> : initials}
    </span>
  );
}
