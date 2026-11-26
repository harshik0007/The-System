const INTRO_KEY = 'the-system:quick-start-intro-seen:v1';
const PROGRESS_KEY = 'the-system:first-run-progress:v1';

const EMPTY_PROGRESS = Object.freeze({
  planCreated: false,
  firstTaskCompleted: false,
  leaderboardVisited: false,
});

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function hasSeenQuickStartIntro() {
  return readStorage(INTRO_KEY) === 'true';
}

export function markQuickStartIntroSeen() {
  try {
    window.localStorage.setItem(INTRO_KEY, 'true');
  } catch {
    // The intro remains dismissible for this visit when storage is unavailable.
  }
}

export function getFirstRunProgress() {
  try {
    const saved = JSON.parse(readStorage(PROGRESS_KEY) || '{}');
    return {
      planCreated: Boolean(saved.planCreated),
      firstTaskCompleted: Boolean(saved.firstTaskCompleted),
      leaderboardVisited: Boolean(saved.leaderboardVisited),
    };
  } catch {
    return { ...EMPTY_PROGRESS };
  }
}

export function updateFirstRunProgress(updates) {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({ ...getFirstRunProgress(), ...updates }));
  } catch {
    // Checklist progress is a local convenience; the product state is unchanged.
  }
}
