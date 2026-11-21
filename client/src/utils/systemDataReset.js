// The server owns account progress and reset operations. This legacy key is
// removed when account scope changes so old browser-preview data cannot leak
// into an authenticated session.
export const TASK_SCHEDULE_SESSION_KEY = 'the-system-discipline-demo-v1';
export const RESET_CONFIRMATION_PHRASE = 'RESET';

export function isResetConfirmationReady({ phrase, hasReadWarning, finalConfirmation } = {}) {
  return hasReadWarning === true
    && finalConfirmation === true
    && phrase === RESET_CONFIRMATION_PHRASE;
}
