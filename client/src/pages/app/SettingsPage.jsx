import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AppIcon from '../../components/app/AppIcon.jsx';
import MemberAvatar from '../../components/app/MemberAvatar.jsx';
import ChangePasswordDialog from '../../components/app/ChangePasswordDialog.jsx';
import ResetAndRestartDialog from '../../components/app/ResetAndRestartDialog.jsx';
import { notificationPreferenceGroups } from '../../data/notificationPreferenceGroups.js';
import { ranks } from '../../data/ranks.js';
import { useTaskSchedule } from '../../context/TaskScheduleContext.jsx';
import { useUserPreferences } from '../../context/UserPreferencesContext.jsx';
import { useAccountActions } from '../../context/AccountActionsContext.jsx';
import { getEffectiveReducedMotion, normalizeUserPreferences } from '../../utils/userPreferences.js';
import { createDefaultUserPreferences } from '../../utils/userPreferences.js';
import { getLevelFromTotalXp } from '../../utils/disciplineManager.js';
import '../../styles/settings.css';

const CATEGORIES = [
  { id: 'profile', label: 'Profile', icon: 'profile' },
  { id: 'privacy', label: 'Privacy & Visibility', icon: 'shield' },
  { id: 'appearance', label: 'Appearance', icon: 'spark' },
  { id: 'notifications', label: 'Notification Preferences', icon: 'bell' },
  { id: 'security', label: 'Account & Security', icon: 'settings' },
  { id: 'accessibility', label: 'Accessibility', icon: 'activity' },
];

const AVATAR_OPTIONS = [
  { id: 'initials', label: 'Initials' },
  { id: 'spark', label: 'Signal' },
  { id: 'shield', label: 'Shield' },
  { id: 'activity', label: 'Pulse' },
  { id: 'profile', label: 'Orbit' },
];

const PRIVACY_OPTIONS = [
  { key: 'publicProfile', title: 'Public profile', description: 'Allow your profile to be opened from public member listings.' },
  { key: 'activityMap', title: 'Discipline Activity Map', description: 'Show your one-year activity map on your public profile.' },
  { key: 'personalBest', title: 'Personal Best Records', description: 'Show your best Overall, Discipline and XP placements, and highest Rank achieved.' },
  { key: 'currentRank', title: 'Current Rank', description: 'Show your current Rank and its badge on your public profile.' },
  { key: 'level', title: 'Level', description: 'Show your current Level.' },
  { key: 'progressionStats', title: 'Progression statistics', description: 'Show public progression statistics such as total XP.' },
  { key: 'currentStreak', title: 'Current Discipline Streak', description: 'Show the current Discipline Streak.' },
  { key: 'longestStreak', title: 'Longest Discipline Streak', description: 'Show your longest recorded Discipline Streak.' },
  { key: 'disciplinePointBalance', title: 'Discipline Point balance', description: 'Show your current Discipline Point balance.' },
  { key: 'gracePointBalance', title: 'Grace Point balance', description: 'Show your current Grace Point balance.' },
];

function formatMemberSince(dateKey) {
  if (!dateKey) return 'Unavailable';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${dateKey}T12:00:00Z`));
}

function getSystemReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function useSystemReducedMotion() {
  const [reduced, setReduced] = useState(getSystemReducedMotion);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = (event) => setReduced(event.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

function Toggle({ checked, onChange, title, description, disabled = false, className = '' }) {
  const id = `setting-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <label className={`settings-toggle${disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`} htmlFor={id}>
      <span className="settings-toggle__copy"><strong>{title}</strong>{description && <small>{description}</small>}</span>
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} />
      <span className="settings-toggle__track" aria-hidden="true"><span /></span>
    </label>
  );
}

function SectionHeader({ eyebrow, title, description, icon }) {
  return (
    <header className="settings-section-header">
      <span className="settings-section-header__icon"><AppIcon name={icon} /></span>
      <div><p className="app-eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>
    </header>
  );
}

function ReadOnly({ label, value, note }) {
  return <div className="settings-readonly"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}

function NotificationGroup({ group, values, onChangeGroup, onChangeItem }) {
  const enabledCount = group.items.filter((item) => values[item.id]).length;
  const allEnabled = enabledCount === group.items.length;
  return (
    <section className="settings-notification-group" aria-labelledby={`notification-group-${group.id}`}>
      <header>
        <div><h3 id={`notification-group-${group.id}`}>{group.title}</h3><p>{group.description}</p></div>
        <label className="settings-category-toggle"><input type="checkbox" checked={allEnabled} onChange={() => onChangeGroup(group, !allEnabled)} /><span>{allEnabled ? 'All on' : enabledCount ? `${enabledCount} of ${group.items.length}` : 'All off'}</span></label>
      </header>
      <div className="settings-notification-group__items">
        {group.items.map((item) => <Toggle key={item.id} title={item.label} checked={Boolean(values[item.id])} onChange={(checked) => onChangeItem(item.id, checked)} />)}
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { preferences, savePreferences } = useUserPreferences();
  const { disciplineState, isEmergencyPauseActive, resetSystemProgress } = useTaskSchedule();
  const { requestLogout } = useAccountActions();
  const systemReducedMotion = useSystemReducedMotion();
  const [activeCategory, setActiveCategory] = useState('profile');
  const [draft, setDraft] = useState(() => normalizeUserPreferences(preferences));
  const [nameError, setNameError] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(preferences), [draft, preferences]);
  const currentRank = ranks.find((rank) => rank.slug === disciplineState.currentRankSlug) || ranks[0];

  useEffect(() => setDraft(normalizeUserPreferences(preferences)), [preferences]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warnBeforeLeaving = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warnBeforeInternalNavigation = (event) => {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest('a[href]');
      if (!anchor || anchor.target || anchor.hasAttribute('download') || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = new URL(anchor.href, window.location.href);
      if (target.origin !== window.location.origin || `${target.pathname}${target.search}${target.hash}` === `${location.pathname}${location.search}${location.hash}`) return;
      if (window.confirm('Discard your unsaved settings changes and leave this page?')) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    };
    document.addEventListener('click', warnBeforeInternalNavigation, true);
    return () => document.removeEventListener('click', warnBeforeInternalNavigation, true);
  }, [dirty, location.hash, location.pathname, location.search]);

  const update = (group, key, value) => {
    setStatus('');
    setDraft((current) => ({ ...current, [group]: { ...current[group], [key]: value } }));
  };

  const save = (event) => {
    event.preventDefault();
    if (saving) return;
    if (activeCategory === 'profile') {
      const displayName = draft.profile.displayName.trim();
      if (!displayName) {
        setNameError('Display name cannot be empty.');
        return;
      }
      if (displayName.length < 2 || displayName.length > 40) {
        setNameError('Use a display name between 2 and 40 characters.');
        return;
      }
      setNameError('');
      const nextDraft = normalizeUserPreferences({ ...draft, profile: { ...draft.profile, displayName } });
      setDraft(nextDraft);
      setSaving(true);
      savePreferences(nextDraft);
      setStatus('Saved to this browser session.');
      setSaving(false);
      return;
    }
    setSaving(true);
    savePreferences(draft);
    setStatus('Saved to this browser session.');
    setSaving(false);
  };

  const cancel = () => {
    setDraft(normalizeUserPreferences(preferences));
    setNameError('');
    setStatus('Unsaved changes discarded.');
  };

  const changeCategory = (categoryId) => {
    if (dirty && !window.confirm('Discard your unsaved settings changes?')) return;
    if (dirty) cancel();
    setActiveCategory(categoryId);
    setStatus('');
  };

  const handleNotificationGroup = (group, enabled) => {
    setStatus('');
    setDraft((current) => ({
      ...current,
      notifications: Object.fromEntries([...Object.entries(current.notifications), ...group.items.map(({ id }) => [id, enabled])]),
    }));
  };

  const updateNotification = (key, value) => {
    setStatus('');
    setDraft((current) => ({ ...current, notifications: { ...current.notifications, [key]: value } }));
  };

  const completeReset = () => {
    const result = resetSystemProgress();
    const defaults = createDefaultUserPreferences();
    savePreferences(defaults);
    setDraft(defaults);
    navigate('/app/tasks/create', {
      replace: true,
      state: { systemResetSuccess: true, systemResetPersisted: result.persisted },
    });
  };

  const effectiveReducedMotion = getEffectiveReducedMotion(draft, systemReducedMotion);
  const selectedCategory = CATEGORIES.find(({ id }) => id === activeCategory);

  return (
    <>
    <main className="settings-page" aria-labelledby="settings-title">
      <header className="settings-page__heading">
        <div><p className="app-eyebrow">ACCOUNT CONTROL</p><h1 id="settings-title">Settings</h1><p>Manage your account, personalize your experience and control your preferences.</p></div>
        {dirty && <span className="settings-unsaved"><i />Unsaved changes</span>}
      </header>

      <div className="settings-layout">
        <nav className="settings-nav app-panel" aria-label="Settings categories">
          <p className="settings-nav__label">PREFERENCES</p>
          {CATEGORIES.map((category) => (
            <button key={category.id} type="button" className={`settings-nav__item${activeCategory === category.id ? ' is-active' : ''}`} aria-current={activeCategory === category.id ? 'page' : undefined} onClick={() => changeCategory(category.id)}>
              <AppIcon name={category.icon} /><span>{category.label}</span>
            </button>
          ))}
          <div className="settings-nav__note"><AppIcon name="shield" /><p>Preferences are saved to this browser session. No server account storage is connected.</p></div>
        </nav>

        <section className="settings-content app-panel" aria-labelledby={`settings-category-${activeCategory}`}>
          <form onSubmit={save}>
            <div className="settings-content__topline"><span className="settings-content__category">{selectedCategory.label}</span>{!dirty && <span className="settings-saved-indicator"><i />Saved</span>}</div>

            {activeCategory === 'profile' && <>
              <SectionHeader eyebrow="IDENTITY" title="Profile information" description="Choose how you appear across your profile and community listings." icon="profile" />
              <div className="settings-profile-preview">
                <MemberAvatar name={draft.profile.displayName || 'Member'} mark={draft.profile.avatarMark} className="settings-profile-preview__avatar" />
                <div><span>PROFILE PREVIEW</span><strong>{draft.profile.displayName || 'Your display name'}</strong><small>{dashboardEmail()}</small></div>
              </div>
              <label className="settings-field" htmlFor="settings-display-name"><span>Display name</span><input id="settings-display-name" type="text" autoComplete="nickname" maxLength={40} value={draft.profile.displayName} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? 'settings-display-name-error' : 'settings-display-name-help'} onChange={(event) => { setNameError(''); update('profile', 'displayName', event.target.value); }} /><small id={nameError ? 'settings-display-name-error' : 'settings-display-name-help'} className={nameError ? 'settings-field__error' : ''}>{nameError || '2 to 40 characters. This name appears in your own Profile and leaderboard entry.'}</small></label>
              <fieldset className="settings-avatar-picker"><legend>Avatar mark</legend><p>Choose an existing THE SYSTEM interface mark. No upload is required or implied.</p><div className="settings-avatar-picker__options">{AVATAR_OPTIONS.map(({ id, label }) => <label key={id} className={`settings-avatar-choice${draft.profile.avatarMark === id ? ' is-selected' : ''}`}><input type="radio" name="settings-avatar" value={id} checked={draft.profile.avatarMark === id} onChange={() => update('profile', 'avatarMark', id)} /><MemberAvatar name={draft.profile.displayName || 'Member'} mark={id} /><span>{label}</span></label>)}</div></fieldset>
              <div className="settings-readonly-grid"><ReadOnly label="Account email" value={dashboardEmail()} note="Read-only in this frontend preview." /><ReadOnly label="Member Since" value={formatMemberSince(disciplineState.memberSince)} note="Permanent progression record; editing is unavailable." /><ReadOnly label="Current Rank" value={`${currentRank.number} · ${currentRank.name}`} /><ReadOnly label="Current Level" value={String(getLevelFromTotalXp(disciplineState.totalXp)).padStart(2, '0')} /></div>
              <p className="settings-inline-note"><AppIcon name="activity" />Username and bio are not supported by the current member profile model, so no nonfunctional edit controls are shown.</p>
            </>}

            {activeCategory === 'privacy' && <>
              <SectionHeader eyebrow="PUBLIC PRESENTATION" title="Privacy & visibility" description="Control which supported details appear when someone opens your public Profile. These choices do not change your underlying records or balances." icon="shield" />
              <div className="settings-toggle-list">{PRIVACY_OPTIONS.map(({ key, title, description }) => <Toggle key={key} title={title} description={description} checked={draft.privacy[key]} onChange={(checked) => update('privacy', key, checked)} />)}</div>
              <p className="settings-inline-note"><AppIcon name="shield" />Turning off Public Profile makes your current member profile route unavailable. Your private Member Profile remains visible to you.</p>
            </>}

            {activeCategory === 'appearance' && <>
              <SectionHeader eyebrow="INTERFACE" title="Appearance" description="Keep the approved dark THE SYSTEM visual identity while tuning nonessential effects." icon="spark" />
              <div className="settings-choice-group"><p className="settings-choice-group__title">Theme</p><div className="settings-theme-choice" aria-label="Theme selection"><span className="settings-theme-choice__swatch" /><span><strong>Dark navy</strong><small>THE SYSTEM's default and only theme in this milestone.</small></span><i>ACTIVE</i></div></div>
              <div className="settings-toggle-list">
                <Toggle title="VOID SHARD cursor" description="Show the custom geometric pointer on supported desktop devices." checked={draft.appearance.voidShardCursor} onChange={(checked) => update('appearance', 'voidShardCursor', checked)} />
                <Toggle title="Click ripple" description="Show the short shard ripple on pointer press. This remains separately controlled from the pointer shape." checked={draft.appearance.clickRipple} onChange={(checked) => update('appearance', 'clickRipple', checked)} />
                <Toggle title="Nonessential animations" description="Allow page entrances and decorative interface motion. Functional feedback remains available when off." checked={draft.appearance.nonessentialAnimations} onChange={(checked) => update('appearance', 'nonessentialAnimations', checked)} />
                <Toggle title="Reduce decorative effects" description="Reduce decorative atmosphere particles and lighting. Emergency Pause status remains visible while active." checked={draft.appearance.reduceDecorativeEffects} onChange={(checked) => update('appearance', 'reduceDecorativeEffects', checked)} />
              </div>
              {isEmergencyPauseActive && <p className="settings-status-banner" role="status"><i />Emergency Pause is active. Its crimson status atmosphere remains visible regardless of decorative-effect preferences.</p>}
            </>}

            {activeCategory === 'notifications' && <>
              <SectionHeader eyebrow="FUTURE NOTIFICATION CENTER" title="Notification preferences" description="Choose which future in-app updates you want enabled. These preferences do not create or deliver notifications in this frontend preview." icon="bell" />
              <div className="settings-notification-groups">{notificationPreferenceGroups.map((group) => <NotificationGroup key={group.id} group={group} values={draft.notifications} onChangeGroup={handleNotificationGroup} onChangeItem={updateNotification} />)}</div>
              <p className="settings-inline-note"><AppIcon name="bell" />Email delivery, push notifications, notification history and an inbox are not connected.</p>
            </>}

            {activeCategory === 'security' && <>
              <SectionHeader eyebrow="ACCOUNT STATUS" title="Account & security" description="Review the account details available in this local demonstration session." icon="shield" />
              <div className="settings-readonly-grid settings-readonly-grid--security"><ReadOnly label="Account email" value={dashboardEmail()} /><ReadOnly label="Account status" value="Demonstration account" note="No authenticated server account is connected." /><ReadOnly label="Member Since" value={formatMemberSince(disciplineState.memberSince)} /><ReadOnly label="Current Run Started" value={formatMemberSince(disciplineState.currentRunStartedDate || disciplineState.memberSince)} /><ReadOnly label="Email verification" value="Unavailable in preview" note="Verification status is not stored in the current member model." /></div>
              <div className="settings-security-actions">
                <section className="settings-security-card settings-security-card--password"><div><p className="app-eyebrow">PASSWORD MANAGEMENT</p><h3>Change Password</h3><p>Current password verification and credential updates require the authentication backend. This form will not claim a password change in this preview.</p><Link className="settings-security-card__text-link" to="/forgot-password">Open password recovery preview <AppIcon name="arrow" /></Link></div><button type="button" className="settings-secondary-link" onClick={() => setChangePasswordOpen(true)}>Change password</button></section>
                <section className="settings-security-card settings-security-card--reset"><div><p className="app-eyebrow">PERMANENT PROGRESS RESET</p><h3>Reset &amp; Restart</h3><p>Erase this browser session's THE SYSTEM progress and history while keeping the demonstration account identity and original Member Since date.</p></div><button type="button" className="settings-reset-action" onClick={() => setResetDialogOpen(true)}>Reset &amp; Restart THE SYSTEM</button></section>
                <section className="settings-security-card settings-security-card--logout"><div><p className="app-eyebrow">ACCOUNT SESSION</p><h3>Log Out</h3><p>Sign-out confirmation is shared with the account menu. Logging out will not erase progress.</p></div><button type="button" className="settings-secondary-link" onClick={requestLogout}>Log out</button></section>
              </div>
              <p className="settings-inline-note"><AppIcon name="shield" />The account, authentication, password, email verification and server-side data services are not connected in this frontend preview. Password updates and sign-out cannot be completed yet.</p>
            </>}

            {activeCategory === 'accessibility' && <>
              <SectionHeader eyebrow="COMFORT & CONTROL" title="Accessibility" description="Motion preference follows your device until you choose an explicit setting. Keyboard operation and visible focus are supported throughout this interface." icon="activity" />
              <div className="settings-accessibility-motion"><Toggle title="Reduce Motion" description={systemReducedMotion ? 'Your device requests reduced motion. This setting currently follows that preference.' : 'Reduce nonessential movement across supported application transitions and effects.'} checked={effectiveReducedMotion} onChange={(checked) => update('accessibility', 'reduceMotion', checked)} /><button type="button" className="settings-follow-device" onClick={() => update('accessibility', 'reduceMotion', null)} disabled={draft.accessibility.reduceMotion === null}>Follow device preference</button></div>
              <div className="settings-accessibility-grid"><article><span><AppIcon name="tasks" /></span><div><h3>Keyboard navigation</h3><p>Menus, navigation, forms and settings controls can be operated from the keyboard.</p><strong>SUPPORTED</strong></div></article><article><span><AppIcon name="spark" /></span><div><h3>Visible focus indicators</h3><p>Interactive controls keep a visible focus treatment for keyboard users.</p><strong>SUPPORTED</strong></div></article><article><span><AppIcon name="shield" /></span><div><h3>Readable contrast</h3><p>THE SYSTEM uses its dark navy theme with labeled controls and readable muted text.</p><strong>SUPPORTED</strong></div></article></div>
            </>}

            <footer className="settings-form-footer">
              <p className={status.startsWith('Unsaved') ? 'is-muted' : ''} role="status">{status || (dirty ? 'Changes are not saved yet.' : 'All changes are saved in this session.')}</p>
              <div><button type="button" className="settings-cancel" disabled={!dirty || saving} onClick={cancel}>Cancel</button><button type="submit" className="settings-save" disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save changes'} <AppIcon name="arrow" /></button></div>
            </footer>
          </form>
        </section>
      </div>
    </main>
    <ChangePasswordDialog open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
    <ResetAndRestartDialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)} onConfirm={completeReset} />
    </>
  );
}

function dashboardEmail() {
  return 'demo.member@example.com';
}
