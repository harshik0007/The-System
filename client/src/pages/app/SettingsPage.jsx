import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AppIcon from '../../components/app/AppIcon.jsx';
import MemberAvatar from '../../components/app/MemberAvatar.jsx';
import ResetAndRestartDialog from '../../components/app/ResetAndRestartDialog.jsx';
import ChangePasswordDialog from '../../components/app/ChangePasswordDialog.jsx';
import AccountDeletionDialog from '../../components/app/AccountDeletionDialog.jsx';
import ThemeTransitionOverlay from '../../components/app/ThemeTransitionOverlay.jsx';
import ThemePreviewDialog from '../../components/app/ThemePreviewDialog.jsx';
import ThemePreviewVisual from '../../components/app/ThemePreviewVisual.jsx';
import { ranks } from '../../data/ranks.js';
import { APPEARANCE_THEMES, getAppearanceTheme, isAppearanceThemeEligible } from '../../data/appearanceThemes.js';
import { useTaskBackend } from '../../context/TaskBackendContext.jsx';
import { useUserPreferences } from '../../context/UserPreferencesContext.jsx';
import { useAccountActions } from '../../context/AccountActionsContext.jsx';
import { useNotificationCenter } from '../../context/NotificationCenterContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { NOTIFICATION_CATEGORIES } from '../../utils/notificationCenter.js';
import { getEffectiveReducedMotion, normalizeUserPreferences } from '../../utils/userPreferences.js';
import { createIdempotencyKey, taskApi } from '../../services/taskApi.js';
import '../../styles/settings.css';

function AuthenticationMethodsSettings() {
  const navigate = useNavigate();
  const { member, regenerateRecoveryCodes } = useAuth();
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const authMethod = member?.authMethod;

  const run = async (action) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await action();
    } catch (requestError) {
      setError(requestError?.message || 'The account security change could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const regenerate = () => run(async () => {
    const result = await regenerateRecoveryCodes({ currentPassword: recoveryPassword });
    setRecoveryPassword('');
    navigate('/recovery-codes', { replace: false, state: { codes: result.recoveryCodes, next: '/app/settings?category=security' } });
  });

  return (
    <div className="settings-auth-methods">
      <section className="settings-security-card">
        <div>
          <p className="app-eyebrow">SIGN-IN METHODS</p>
          <h3>Account sign-in</h3>
          <p>Each THE SYSTEM account uses one separate sign-in method. Local and Google accounts cannot be linked or combined.</p>
          <div className="settings-auth-methods__status"><span>Method <strong>{authMethod === 'google' ? 'GOOGLE' : authMethod === 'local' ? 'LOCAL' : 'REVIEW REQUIRED'}</strong></span></div>
        </div>
      </section>

      <section className="settings-security-card">
        <div>
          <p className="app-eyebrow">ONE-TIME ACCOUNT RECOVERY</p>
          <h3>{authMethod === 'google' ? 'Google account recovery' : 'Recovery codes'}</h3>
          <p>{authMethod === 'google' ? 'This account signs in with Google only. Recover access through Google account recovery; no local password or recovery codes are attached to this account.' : 'Generate a new set if you have lost the old codes. Generating a set immediately invalidates every previous recovery code. The new codes are shown once.'}</p>
        </div>
        <div className="settings-auth-methods__controls">
          {authMethod === 'local' ? (
            <>
              <label className="settings-field"><span>Confirm your current password</span><input type="password" autoComplete="current-password" value={recoveryPassword} onChange={(event) => setRecoveryPassword(event.target.value)} disabled={busy} /></label>
              <button type="button" className="settings-reset-action" disabled={busy || !recoveryPassword} onClick={regenerate}>Replace recovery codes</button>
            </>
          ) : authMethod === 'google' ? (
            <p className="settings-inline-note">Use the Google account recovery options for the Google identity used to sign in.</p>
          ) : (
            <p className="settings-inline-note">The account sign-in method needs review before recovery options can be changed.</p>
          )}
        </div>
      </section>
      {error && <p className="settings-field__error" role="alert">{error}</p>}
      {status && <p className="settings-inline-note" role="status">{status}</p>}
    </div>
  );
}

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
  { key: 'fullName', title: 'Full name', description: 'Show your First, Middle and Last Name on your Public Profile.' },
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

const notificationDescriptions = {
  tasks: 'Schedule changes, completed Tasks and finalized missed Task records.',
  'recovery-quests': 'Recovery Quest activation, completion, expiry and threshold events.',
  discipline: 'Finalized Discipline days and credited recurring Discipline Point rewards.',
  'rank-xp': 'Level changes, Rank transitions and actual Rank-entry reward credits.',
  'emergency-pause': 'Emergency Pause activation and early or automatic resumption.',
  'monthly-retention': 'The existing 7-day, 48-hour and 24-hour detailed-history expiry reminders.',
};

function NotificationCategorySettings() {
  const { notificationPreferences, preferencesLoading, updateNotificationPreferences } = useNotificationCenter();
  const [savingCategory, setSavingCategory] = useState('');
  const [feedback, setFeedback] = useState('');
  const toggle = async (categoryId, enabled) => {
    setSavingCategory(categoryId);
    setFeedback('');
    try {
      await updateNotificationPreferences({ ...notificationPreferences, [categoryId]: enabled });
      setFeedback(`${NOTIFICATION_CATEGORIES.find(({ id }) => id === categoryId)?.label || 'Category'} preference saved.`);
    } catch (error) {
      setFeedback(error?.message || 'Notification preferences could not be saved. Please retry.');
    } finally {
      setSavingCategory('');
    }
  };
  return (
    <>
      <div className="settings-notification-groups">{NOTIFICATION_CATEGORIES.map((category) => (
        <section className="settings-notification-group" aria-labelledby={`notification-group-${category.id}`} key={category.id}>
          <header><div><h3 id={`notification-group-${category.id}`}>{category.label}</h3><p>{notificationDescriptions[category.id]}</p></div></header>
          <div className="settings-notification-group__items"><Toggle title={`${category.label} notifications`} description="New in-app notifications in this category." checked={notificationPreferences[category.id] !== false} disabled={preferencesLoading || Boolean(savingCategory)} onChange={(checked) => void toggle(category.id, checked)} /></div>
        </section>
      ))}</div>
      {feedback && <p className="settings-inline-note" role="status"><AppIcon name="bell" />{feedback}</p>}
      <p className="settings-inline-note"><AppIcon name="bell" />These controls affect future in-app notifications. Existing notification history remains available. Email and push delivery are not part of this milestone.</p>
    </>
  );
}

export default function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { preferences, savePreferences, mergePreferences } = useUserPreferences();
  const { member, updateIdentity, deleteAccount } = useAuth();
  const hasLocalPassword = member?.authProviders?.localPassword === true || member?.authMethod === 'local';
  const { emergencyPause, progression, refresh, refreshRecovery } = useTaskBackend();
  const { requestLogout } = useAccountActions();
  const systemReducedMotion = useSystemReducedMotion();
  const [activeCategory, setActiveCategory] = useState(() => {
    const requested = new URLSearchParams(location.search).get('category');
    return CATEGORIES.some((item) => item.id === requested) ? requested : 'profile';
  });
  const [draft, setDraft] = useState(() => normalizeUserPreferences(preferences));
  const [accountSettings, setAccountSettings] = useState(null);
  const [identityDraft, setIdentityDraft] = useState({ username: '', firstName: '', middleName: '', lastName: '' });
  const [accountSettingsError, setAccountSettingsError] = useState('');
  const [resetPreview, setResetPreview] = useState(null);
  const [resetPreviewLoading, setResetPreviewLoading] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [nameError, setNameError] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [themeApplying, setThemeApplying] = useState('');
  const themeApplyingRef = useRef(false);
  const [themePreview, setThemePreview] = useState('');
  const themePreviewTriggerRef = useRef(null);
  const closeThemePreview = useCallback(() => setThemePreview(''), []);
  const [themeFeedback, setThemeFeedback] = useState(null);
  const [themeTransition, setThemeTransition] = useState(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const resetIdempotencyKey = useRef('');
  const lastPreferencesRef = useRef(preferences);
  const identityChanged = Boolean(accountSettings?.profile && ['username', 'firstName', 'middleName', 'lastName'].some((key) => (identityDraft[key] || '') !== (accountSettings.profile[key] || '')));
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(preferences) || identityChanged, [draft, preferences, identityChanged]);
  const currentRank = ranks.find((rank) => rank.slug === accountSettings?.progression?.currentRank?.slug || rank.slug === progression?.progression?.currentRankSlug) || ranks[0];

  useEffect(() => {
    const controller = new AbortController();
    let entitlementController = null;
    taskApi.accountSettings({ signal: controller.signal }).then(({ settings }) => {
      setAccountSettings(settings);
      setIdentityDraft({ username: settings.profile.username || '', firstName: settings.profile.firstName || '', middleName: settings.profile.middleName || '', lastName: settings.profile.lastName || '' });
      setAccountSettingsError('');
    }).catch((error) => {
      if (error?.name !== 'AbortError') setAccountSettingsError(error?.message || 'Account settings could not be loaded.');
    });
    const refreshEntitlements = () => {
      entitlementController?.abort();
      entitlementController = new AbortController();
      taskApi.accountSettings({ signal: entitlementController.signal }).then(({ settings }) => {
        setAccountSettings(settings);
        setAccountSettingsError('');
      }).catch((error) => {
        if (error?.name !== 'AbortError') setAccountSettingsError(error?.message || 'Theme eligibility could not be refreshed.');
      });
    };
    window.addEventListener('system:progression-theme-state-changed', refreshEntitlements);
    return () => {
      controller.abort();
      entitlementController?.abort();
      window.removeEventListener('system:progression-theme-state-changed', refreshEntitlements);
    };
  }, []);

  useEffect(() => {
    const previous = lastPreferencesRef.current;
    lastPreferencesRef.current = preferences;
    const withoutTheme = (value) => ({ ...value, appearance: { ...value.appearance, theme: null } });
    if (JSON.stringify(withoutTheme(previous)) === JSON.stringify(withoutTheme(preferences))) {
      setDraft((current) => normalizeUserPreferences({ ...current, appearance: { ...current.appearance, theme: preferences.appearance.theme } }));
    } else {
      setDraft(normalizeUserPreferences(preferences));
    }
  }, [preferences]);

  const applyTheme = async (theme) => {
    if (themeApplyingRef.current || themeApplying || themeTransition || !isAppearanceThemeEligible(theme.id, accountSettings?.progression?.level ?? 0)) return;
    const previousTheme = preferences.appearance.theme;
    const transitionKey = `${theme.id}-${Date.now()}`;
    themeApplyingRef.current = true;
    setThemeApplying(theme.id);
    setThemeFeedback(null);
    try {
      const response = await taskApi.updateAccountPreferences({ appearance: { theme: theme.id } });
      const savedTheme = response.settings?.appearance?.theme;
      if (savedTheme !== theme.id) throw new Error('The server did not confirm this theme selection. Your existing theme remains active.');
      // Keep the old appearance in place until the backend has confirmed the
      // selection. The shared foreground overlay owns the visual transition.
      mergePreferences({ appearance: response.settings.appearance });
      setAccountSettings(response.settings);
      setDraft((current) => ({ ...current, appearance: { ...current.appearance, theme: savedTheme } }));
      const savedAt = performance.now();
      setThemeTransition({ id: theme.id, key: transitionKey, startedAt: savedAt, saved: true, savedAt });
      setThemeFeedback({ type: 'status', text: `${theme.name} is saved to your account.` });
    } catch (error) {
      // The active preference was not changed before server confirmation.
      // Restore the draft too in case another settings update arrived in flight.
      setDraft((current) => ({ ...current, appearance: { ...current.appearance, theme: previousTheme } }));
      setThemeTransition(null);
      setThemeFeedback({ type: 'error', text: error?.message || 'Theme could not be saved. Your existing theme remains active.' });
    } finally {
      themeApplyingRef.current = false;
      setThemeApplying('');
    }
  };

  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('category');
    if (CATEGORIES.some((item) => item.id === requested)) setActiveCategory(requested);
  }, [location.search]);

  const deletionCallbackState = new URLSearchParams(location.search).get('accountDeletion');
  useEffect(() => {
    if (deletionCallbackState === 'verified' || deletionCallbackState === 'reauth-failed') {
      setActiveCategory('security');
      setDeleteAccountOpen(true);
    }
  }, [deletionCallbackState]);

  const closeDeleteAccount = useCallback(() => setDeleteAccountOpen(false), []);
  const confirmDeleteAccount = useCallback(async (details) => {
    await deleteAccount(details);
    navigate('/login', { replace: true, state: { accountDeleted: true } });
  }, [deleteAccount, navigate]);

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

  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    let valuesToSave = draft;
    if (activeCategory === 'profile') {
      const username = identityDraft.username.trim();
      if (!/^[A-Za-z][A-Za-z0-9_]{2,23}$/.test(username)) {
        setNameError('Use a unique username with 3–24 letters, numbers or underscores, starting with a letter.');
        return;
      }
      if (!identityDraft.firstName.trim() || !identityDraft.lastName.trim()) {
        setNameError('First name and last name are required.');
        return;
      }
      setNameError('');
      valuesToSave = normalizeUserPreferences({ ...draft, profile: { ...draft.profile, username } });
      setDraft(valuesToSave);
    }
    setSaving(true);
    try {
      if (activeCategory === 'profile' || activeCategory === 'privacy') {
        if (activeCategory === 'profile' && identityChanged) {
          const { member } = await updateIdentity({ ...identityDraft, username: identityDraft.username.trim(), firstName: identityDraft.firstName.trim(), middleName: identityDraft.middleName.trim(), lastName: identityDraft.lastName.trim() });
          setAccountSettings((current) => ({ ...current, profile: { ...current.profile, username: member.username, firstName: member.firstName, middleName: member.middleName, lastName: member.lastName } }));
          setIdentityDraft({ username: member.username, firstName: member.firstName, middleName: member.middleName, lastName: member.lastName });
        }
        await taskApi.savePublicProfileSettings({
          avatarMark: valuesToSave.profile.avatarMark,
          privacy: valuesToSave.privacy,
        });
        savePreferences(valuesToSave);
        setStatus('Profile and visibility saved to this member account.');
      } else if (activeCategory === 'appearance' || activeCategory === 'accessibility') {
        const response = await taskApi.updateAccountPreferences({ [activeCategory]: valuesToSave[activeCategory] });
        valuesToSave = normalizeUserPreferences({ ...valuesToSave, appearance: response.settings.appearance, accessibility: response.settings.accessibility });
        setAccountSettings(response.settings);
        savePreferences(valuesToSave);
        setStatus('Preferences saved to this member account.');
      } else {
        savePreferences(valuesToSave);
        setStatus('Settings saved.');
      }
    } catch (saveError) {
      setStatus(saveError?.message || 'Settings could not be saved. Please retry.');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(normalizeUserPreferences(preferences));
    if (accountSettings?.profile) setIdentityDraft({ username: accountSettings.profile.username || '', firstName: accountSettings.profile.firstName || '', middleName: accountSettings.profile.middleName || '', lastName: accountSettings.profile.lastName || '' });
    setNameError('');
    setStatus('Unsaved changes discarded.');
  };

  const changeCategory = (categoryId) => {
    if (dirty && !window.confirm('Discard your unsaved settings changes?')) return;
    if (dirty) cancel();
    setActiveCategory(categoryId);
    setStatus('');
  };

  const openResetDialog = async () => {
    setResetDialogOpen(true);
    setResetPreview(null);
    setResetError('');
    setResetPreviewLoading(true);
    try {
      const response = await taskApi.manualResetPreview();
      setResetPreview(response.preview);
    } catch (error) {
      setResetError(error?.message || 'Reset details could not be loaded. Please close this dialog and retry.');
    } finally {
      setResetPreviewLoading(false);
    }
  };

  const completeReset = async ({ confirmationPhrase, expectedRunNumber }) => {
    if (resetSubmitting) return;
    setResetSubmitting(true);
    setResetError('');
    resetIdempotencyKey.current ||= createIdempotencyKey();
    try {
      const { reset } = await taskApi.manualResetAndRestart(confirmationPhrase, expectedRunNumber, resetIdempotencyKey.current);
      resetIdempotencyKey.current = '';
      setResetDialogOpen(false);
      await Promise.all([refresh(), refreshRecovery()]);
      navigate('/app/tasks/create', {
        replace: true,
        state: { manualProgressionReset: true, resetCount: reset.resetCount },
      });
    } catch (error) {
      if (error?.code === 'RESET_PREVIEW_STALE') resetIdempotencyKey.current = '';
      setResetError(error?.message || 'Reset & Restart could not be completed. Your current progression is unchanged.');
    } finally {
      setResetSubmitting(false);
    }
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
          <div className="settings-nav__note"><AppIcon name="shield" /><p>Profile, privacy, appearance and accessibility choices are stored with the member account. Notification categories use the shared M27 preference service.</p></div>
        </nav>

        <section className="settings-content app-panel" aria-labelledby={`settings-category-${activeCategory}`}>
          <form onSubmit={save}>
            <div className="settings-content__topline"><span className="settings-content__category">{selectedCategory.label}</span>{!dirty && <span className="settings-saved-indicator"><i />Saved</span>}</div>

            {activeCategory === 'profile' && <>
              <SectionHeader eyebrow="IDENTITY" title="Profile information" description="Choose how you appear across your profile and community listings." icon="profile" />
              <div className="settings-profile-preview">
                <MemberAvatar name={identityDraft.username || 'Member'} mark={draft.profile.avatarMark} className="settings-profile-preview__avatar" />
                <div><span>PROFILE PREVIEW</span><strong>{identityDraft.username || 'Your username'}</strong><small>{[identityDraft.firstName, identityDraft.middleName, identityDraft.lastName].filter(Boolean).join(' ')}</small></div>
              </div>
              <div className="settings-identity-grid">
                <label className="settings-field"><span>Username</span><input type="text" autoComplete="username" maxLength={24} value={identityDraft.username} onChange={(event) => { setNameError(''); setIdentityDraft((value) => ({ ...value, username: event.target.value })); }} /><small>Unique public identity; 3–24 letters, digits or underscores.</small></label>
                <label className="settings-field"><span>First Name</span><input type="text" autoComplete="given-name" maxLength={80} value={identityDraft.firstName} onChange={(event) => setIdentityDraft((value) => ({ ...value, firstName: event.target.value }))} /></label>
                <label className="settings-field"><span>Middle Name (optional)</span><input type="text" autoComplete="additional-name" maxLength={80} value={identityDraft.middleName} onChange={(event) => setIdentityDraft((value) => ({ ...value, middleName: event.target.value }))} /></label>
                <label className="settings-field"><span>Last Name</span><input type="text" autoComplete="family-name" maxLength={80} value={identityDraft.lastName} onChange={(event) => setIdentityDraft((value) => ({ ...value, lastName: event.target.value }))} /></label>
              </div>
              {nameError && <p className="settings-field__error" role="alert">{nameError}</p>}
              <fieldset className="settings-avatar-picker"><legend>Avatar mark</legend><p>Choose an existing THE SYSTEM interface mark. No upload is required or implied.</p><div className="settings-avatar-picker__options">{AVATAR_OPTIONS.map(({ id, label }) => <label key={id} className={`settings-avatar-choice${draft.profile.avatarMark === id ? ' is-selected' : ''}`}><input type="radio" name="settings-avatar" value={id} checked={draft.profile.avatarMark === id} onChange={() => update('profile', 'avatarMark', id)} /><MemberAvatar name={identityDraft.username || 'Member'} mark={id} /><span>{label}</span></label>)}</div></fieldset>
              <div className="settings-readonly-grid"><ReadOnly label="Sign-in email" value={accountSettings?.profile?.email || 'Unavailable'} /><ReadOnly label="Member Since" value={formatMemberSince(accountSettings?.account?.memberSince)} note="Permanent account date; it cannot be reset or edited." /><ReadOnly label="Current Rank" value={`${currentRank.number} · ${currentRank.name}`} /><ReadOnly label="Current Level" value={String(accountSettings?.progression?.level ?? progression?.progression?.level ?? 0).padStart(2, '0')} /></div>
            </>}

            {activeCategory === 'privacy' && <>
              <SectionHeader eyebrow="PUBLIC PRESENTATION" title="Privacy & visibility" description="Control which supported details appear when someone opens your public Profile. These choices do not change your underlying records or balances." icon="shield" />
              <div className="settings-toggle-list">{PRIVACY_OPTIONS.map(({ key, title, description }) => <Toggle key={key} title={title} description={description} checked={draft.privacy[key]} onChange={(checked) => update('privacy', key, checked)} />)}</div>
              <p className="settings-inline-note"><AppIcon name="shield" />Turning off Public Profile makes your current member profile route unavailable. Your private Member Profile remains visible to you.</p>
            </>}

            {activeCategory === 'appearance' && <>
              <SectionHeader eyebrow="INTERFACE" title="Appearance" description="Choose a visual identity available at your current Rank." icon="spark" />
              <div className="settings-choice-group">
                <p className="settings-choice-group__title">Rank-based themes</p>
                <p className="settings-theme-intro">Obsidian unlocks at Rank 05 — Surge, Aurora at Rank 03 — Apex, Eclipse at Rank 02 — Zenith, and Galaxion exclusively at Rank 01 — Continuum. The server verifies and saves your current selection.</p>
                <div className="settings-theme-grid" aria-label="Available interface themes">
                  {APPEARANCE_THEMES.map((theme) => {
                    const unlocked = isAppearanceThemeEligible(theme.id, accountSettings?.progression?.level ?? 0);
                    const active = preferences.appearance.theme === theme.id;
                    return (
                      <article className={`settings-theme-card${active ? ' is-active' : ''}${!unlocked ? ' is-locked' : ''}`} data-theme-preview={theme.id} key={theme.id}>
                        <ThemePreviewVisual theme={theme} />
                        <div className="settings-theme-card__heading"><div><h3>{theme.name}</h3><p>{theme.description}</p></div>{active && <span className="settings-theme-card__active">ACTIVE</span>}</div>
                        <p className={`settings-theme-card__requirement${unlocked ? ' is-unlocked' : ''}`}><span>{theme.minimumLevel === 0 ? 'Always available' : theme.requirement}</span><strong>{unlocked ? 'UNLOCKED' : 'LOCKED'}</strong></p>
                        <div className="settings-theme-card__actions">
                          <button type="button" className="settings-theme-card__preview-button" aria-haspopup="dialog" aria-expanded={themePreview === theme.id} aria-controls={themePreview === theme.id ? 'theme-preview-dialog' : undefined} onClick={(event) => { themePreviewTriggerRef.current = event.currentTarget; setThemePreview(theme.id); }}>Preview</button>
                          <button
                            type="button"
                            className={`settings-theme-card__apply-button${theme.id === 'galaxion' ? ' settings-theme-card__apply-button--rank-one' : theme.id === 'eclipse' ? ' settings-theme-card__apply-button--eclipse' : ''}`}
                            disabled={!unlocked || Boolean(themeApplying) || Boolean(themeTransition) || active}
                            onClick={() => void applyTheme(theme)}
                          >
                            {theme.id === 'galaxion' ? <>
                              <svg className="settings-theme-card__rank-one-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.5 14.6 9l6.9 3-6.9 2.8-2.6 6.7-2.7-6.7L2.5 12l6.8-3 2.7-6.5Z" /></svg>
                              <span>{themeApplying === theme.id ? 'Securing…' : active ? 'Rank 01 equipped' : !unlocked ? 'Rank 01 required' : 'Ascend to Galaxion'}</span>
                              <small aria-hidden="true">01</small>
                            </> : themeApplying === theme.id ? 'Saving…' : active ? 'Active theme' : !unlocked ? 'Locked' : 'Apply theme'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {themeFeedback && <p className={`settings-theme-feedback is-${themeFeedback.type}`} role={themeFeedback.type === 'error' ? 'alert' : 'status'}>{themeFeedback.text}</p>}
              </div>
              <div className="settings-toggle-list">
                <Toggle title="Click effects" description="Show the selected theme’s visual feedback when you click." checked={draft.appearance.clickRipple} onChange={(checked) => update('appearance', 'clickRipple', checked)} />
                <Toggle title="Nonessential animations" description="Allow page entrances and decorative interface motion. Functional feedback remains available when off." checked={draft.appearance.nonessentialAnimations} onChange={(checked) => update('appearance', 'nonessentialAnimations', checked)} />
                <Toggle title="Reduce decorative effects" description="Reduce decorative atmosphere particles and lighting. Emergency Pause status remains visible while active." checked={draft.appearance.reduceDecorativeEffects} onChange={(checked) => update('appearance', 'reduceDecorativeEffects', checked)} />
              </div>
              <label className="settings-effect-quality">
                <span><strong>Visual effect quality</strong><small>Choose how many decorative layers run across themes. Lower settings reduce particle density and expensive shadows.</small></span>
                <select value={draft.appearance.effectQuality} onChange={(event) => update('appearance', 'effectQuality', event.target.value)}>
                  <option value="high">High · full detail</option>
                  <option value="balanced">Balanced · recommended</option>
                  <option value="low">Low · lighter effects</option>
                </select>
              </label>
              {emergencyPause?.isActive && <p className="settings-status-banner" role="status"><i />Emergency Pause is active. Its dates and controls remain available; decorative effects follow your theme and motion preferences.</p>}
            </>}

            {activeCategory === 'notifications' && <>
              <SectionHeader eyebrow="IN-APP UPDATES" title="Notification preferences" description="Choose which future server-recorded in-app updates you want to receive. Changes are saved to your account immediately." icon="bell" />
              <NotificationCategorySettings />
            </>}

            {activeCategory === 'security' && <>
              <SectionHeader eyebrow="ACCOUNT STATUS" title="Account information" description="Review permanent account dates and the current server-managed progression state." icon="shield" />
              <div className="settings-readonly-grid settings-readonly-grid--security"><ReadOnly label="Account status" value={accountSettings?.account?.status || 'Loading'} note="Account identity is resolved by the server." /><ReadOnly label="Account created" value={accountSettings?.account?.createdAt ? formatMemberSince(accountSettings.account.createdAt.slice(0, 10)) : 'Loading'} /><ReadOnly label="Member Since" value={formatMemberSince(accountSettings?.account?.memberSince)} /><ReadOnly label="Current Run Started" value={formatMemberSince(accountSettings?.progression?.startedOn)} /><ReadOnly label="Reset Count" value={accountSettings?.account?.resetCount ?? progression?.resetCount ?? '—'} note="Manual Reset & Restart does not increase this count." /></div>
              <div className="settings-security-actions">
                {hasLocalPassword && <section className="settings-security-card settings-security-card--password"><div><p className="app-eyebrow">ACCOUNT SECURITY</p><h3>Credential management</h3><p>Change your password after confirming the current one. If you forget it, use one of your saved one-time recovery codes.</p><Link className="settings-security-card__text-link" to="/forgot-password">Recover access with a code <AppIcon name="arrow" /></Link></div><button type="button" className="settings-reset-action" onClick={() => setChangePasswordOpen(true)}>Change password</button></section>}
                <AuthenticationMethodsSettings />
                <section className="settings-security-card settings-security-card--reset"><div><p className="app-eyebrow">PERMANENT PROGRESS RESET</p><h3>Reset &amp; Restart</h3><p>Start a new progression run while preserving your permanent account identity, settings, Reset Count, Lifetime Longest Streak and historical monthly summaries.</p></div><button type="button" className="settings-reset-action" onClick={openResetDialog}>Reset &amp; Restart THE SYSTEM</button></section>
                <section className="settings-security-card settings-security-card--logout"><div><p className="app-eyebrow">ACCOUNT SESSION</p><h3>Log Out</h3><p>Sign-out confirmation is shared with the account menu. Logging out will not erase progress.</p></div><button type="button" className="settings-secondary-link" onClick={requestLogout}>Log out</button></section>
                <section className="settings-security-card settings-security-card--delete"><div><p className="app-eyebrow">DANGER ZONE</p><h3>Delete Account</h3><p>Permanently delete this THE SYSTEM account and data owned exclusively by it. Local accounts must verify their current password; Google accounts must complete fresh Google verification.</p></div><button type="button" className="settings-delete-action" onClick={() => setDeleteAccountOpen(true)}>Delete account</button></section>
              </div>
    <p className="settings-inline-note"><AppIcon name="shield" />THE SYSTEM does not send email recovery codes. Save your one-time recovery codes privately; each code works once.</p>
            </>}

            {activeCategory === 'accessibility' && <>
              <SectionHeader eyebrow="COMFORT & CONTROL" title="Accessibility" description="Motion preference follows your device until you choose an explicit setting. Keyboard operation and visible focus are supported throughout this interface." icon="activity" />
              <div className="settings-accessibility-motion"><Toggle title="Reduce Motion" description={systemReducedMotion ? 'Your device requests reduced motion. This setting currently follows that preference.' : 'Reduce nonessential movement across supported application transitions and effects.'} checked={effectiveReducedMotion} onChange={(checked) => update('accessibility', 'reduceMotion', checked)} /><button type="button" className="settings-follow-device" onClick={() => update('accessibility', 'reduceMotion', null)} disabled={draft.accessibility.reduceMotion === null}>Follow device preference</button></div>
              <div className="settings-accessibility-grid"><article><span><AppIcon name="tasks" /></span><div><h3>Keyboard navigation</h3><p>Menus, navigation, forms and settings controls can be operated from the keyboard.</p><strong>SUPPORTED</strong></div></article><article><span><AppIcon name="spark" /></span><div><h3>Visible focus indicators</h3><p>Interactive controls keep a visible focus treatment for keyboard users.</p><strong>SUPPORTED</strong></div></article><article><span><AppIcon name="shield" /></span><div><h3>Readable contrast</h3><p>THE SYSTEM uses your selected theme with labeled controls and readable muted text.</p><strong>SUPPORTED</strong></div></article></div>
            </>}

            <footer className="settings-form-footer">
              <p className={status.startsWith('Unsaved') ? 'is-muted' : ''} role="status">{status || (dirty ? 'Changes are not saved yet.' : accountSettingsError || 'Profile, privacy and supported preferences are saved with this member account.')}</p>
              <div><button type="button" className="settings-cancel" disabled={!dirty || saving} onClick={cancel}>Cancel</button><button type="submit" className="settings-save" disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save changes'} <AppIcon name="arrow" /></button></div>
            </footer>
          </form>
        </section>
      </div>
    </main>
    <ResetAndRestartDialog open={resetDialogOpen} onClose={() => { if (!resetSubmitting) setResetDialogOpen(false); }} onConfirm={completeReset} preview={resetPreview} loading={resetPreviewLoading} submitting={resetSubmitting} error={resetError} />
    {hasLocalPassword && <ChangePasswordDialog open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />}
    <AccountDeletionDialog open={deleteAccountOpen} authMethod={member?.authMethod} initialNotice={deletionCallbackState || ''} onClose={closeDeleteAccount} onConfirm={confirmDeleteAccount} />
      {themePreview && (() => {
        const previewTheme = getAppearanceTheme(themePreview);
        const previewUnlocked = isAppearanceThemeEligible(previewTheme.id, accountSettings?.progression?.level ?? 0);
        return <ThemePreviewDialog
          theme={previewTheme}
          unlocked={previewUnlocked}
          active={preferences.appearance.theme === previewTheme.id}
          returnFocusRef={themePreviewTriggerRef}
          onClose={closeThemePreview}
        />;
      })()}
      {themeTransition && <ThemeTransitionOverlay
        theme={getAppearanceTheme(themeTransition.id)}
        startedAt={themeTransition.startedAt}
        saved={themeTransition.saved}
        savedAt={themeTransition.savedAt}
        reducedMotion={effectiveReducedMotion || !draft.appearance.nonessentialAnimations}
        onComplete={() => setThemeTransition((current) => current?.key === themeTransition.key ? null : current)}
      />}
    </>
  );
}
