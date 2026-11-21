import { getCurrentPublicProfileSettings, getLeaderboard, getPublicMemberProfile, saveCurrentPublicProfileSettings } from '../services/leaderboardService.js';
import { ValidationError } from '../utils/httpErrors.js';

function assertNoQuery(request) {
  const unexpected = Object.keys(request.query || {});
  if (unexpected.length) throw new ValidationError('The request contains unsupported query fields.', unexpected.map((field) => ({ field, code: 'FIELD_NOT_ALLOWED' })));
}

export async function getRankings(request, response) {
  assertNoQuery(request);
  response.set('Cache-Control', 'private, no-store');
  response.json(await getLeaderboard({ requesterId: request.user.id }));
}

export async function getPublicProfile(request, response) {
  assertNoQuery(request);
  response.set('Cache-Control', 'private, no-store');
  response.json({ profile: await getPublicMemberProfile({ requesterId: request.user.id, publicHandle: request.params.publicHandle }) });
}

export async function getProfileSettings(request, response) {
  assertNoQuery(request);
  response.set('Cache-Control', 'private, no-store');
  response.json({ settings: await getCurrentPublicProfileSettings(request.user.id) });
}

export async function updateProfileSettings(request, response) {
  assertNoQuery(request);
  response.set('Cache-Control', 'private, no-store');
  response.json({ settings: await saveCurrentPublicProfileSettings(request.user.id, request.body) });
}
