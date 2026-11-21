import ProgressionRun from '../models/ProgressionRun.js';
import User from '../models/User.js';
import { NotFoundError } from '../utils/httpErrors.js';
import { getIstDateKey } from '../utils/ist.js';
import { withMongoTransaction } from './mongoTransaction.js';
import { createFreshProgressionRunWithinSession } from './progressionRunFactory.js';
import { DEFAULT_THEME, getEligibleTheme } from '../utils/themeEntitlements.js';

export async function ensureActiveProgressionRun(userId, transactionSession = null) {
  const ensureInSession = async (session) => {
    const user = await User.findById(userId).session(session);
    if (!user) throw new NotFoundError('The development identity was not found.');

    let run = await ProgressionRun.findOne({ userId, status: 'active' }).sort({ runNumber: -1 }).session(session);
    if (!run) {
      const latest = await ProgressionRun.findOne({ userId }).sort({ runNumber: -1 }).select('runNumber').session(session);
      const startedAt = new Date();
      run = await createFreshProgressionRunWithinSession({ userId, runNumber: (latest?.runNumber || 0) + 1, startedAt, session });
    }

    const selectedTheme = user.appearancePreferences?.theme || DEFAULT_THEME;
    const eligibleTheme = getEligibleTheme(selectedTheme, run.level);
    const updates = {};
    if (String(user.currentProgressionRunId || '') !== String(run._id)) updates.currentProgressionRunId = run._id;
    if (selectedTheme !== eligibleTheme) updates['appearancePreferences.theme'] = eligibleTheme;
    if (Object.keys(updates).length) {
      await User.updateOne({ _id: userId }, { $set: updates }, { session, runValidators: true });
    }
    return run;
  };

  if (transactionSession) return ensureInSession(transactionSession);
  return withMongoTransaction(ensureInSession);
}

export async function getActiveProgressionRun(userId, session) {
  const query = ProgressionRun.findOne({ userId, status: 'active' }).sort({ runNumber: -1 });
  if (session) query.session(session);
  return query;
}
