import { useFlashMessages } from '../../context/FlashMessageContext.jsx';
import '../../styles/share-progress.css';

function copyText(value) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value).then(() => true).catch(() => copyTextFallback(value));
  return Promise.resolve(copyTextFallback(value));
}

function copyTextFallback(value) {
  const field = document.createElement('textarea');
  field.value = value;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.append(field);
  field.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch { copied = false; }
  field.remove();
  return copied;
}

export default function ShareProgressActions({ rank, streak = 0 }) {
  const { notifySuccess, notifyError } = useFlashMessages();
  const siteUrl = window.location.origin;
  const inviteText = `I'm building consistency on THE SYSTEM. Join me: ${siteUrl}`;
  const progressText = rank
    ? `I'm Rank ${rank.number} · ${rank.name} with a ${streak}-day streak on THE SYSTEM. Can you beat me?`
    : `I'm building consistency on THE SYSTEM with a ${streak}-day streak. Can you beat me?`;

  async function inviteFriend() {
    const copied = await copyText(inviteText);
    if (copied) notifySuccess('Invite message copied.');
    else notifyError('Copy is unavailable in this browser.');
  }

  async function shareProgress() {
    const shareData = { title: 'My THE SYSTEM progress', text: progressText, url: siteUrl };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        notifySuccess('Share sheet opened.');
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    const copied = await copyText(`${progressText} ${siteUrl}`);
    if (copied) notifySuccess('Progress message copied.');
    else notifyError('Copy is unavailable in this browser.');
  }

  return (
    <section className="share-progress" aria-labelledby="share-progress-heading">
      <div className="share-progress__copy">
        <p className="app-eyebrow">BUILD YOUR CIRCLE</p>
        <h2 id="share-progress-heading">Progress is better together</h2>
        <p>Invite a friend or share your Rank and current streak.</p>
      </div>
      <div className="share-progress__actions">
        <button type="button" className="share-progress__button share-progress__button--primary" onClick={inviteFriend}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm10-6v6m3-3h-6" /></svg>
          Invite a friend
        </button>
        <button type="button" className="share-progress__button" onClick={shareProgress}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.7 10.7 6.6-4.4m-6.6 7 6.6 4.4" /></svg>
          Share my progress
        </button>
      </div>
    </section>
  );
}
