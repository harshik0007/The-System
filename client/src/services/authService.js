import { invalidateCsrfToken, requestApi } from './apiClient.js';

const query = (value) => new URLSearchParams({ username: value }).toString();

export const authService = Object.freeze({
  currentMember: () => requestApi('/auth/me'),
  capabilities: () => requestApi('/auth/capabilities'),
  accountDeletionStatus: () => requestApi('/auth/account/deletion/status'),
  deleteAccount: (details) => requestApi('/auth/account/delete', { method: 'POST', body: details }),
  usernameAvailability: (username, options) => requestApi(`/auth/username-availability?${query(username)}`, options),
  signUp: (details) => requestApi('/auth/signup', { method: 'POST', body: details }),
  login: (credentials) => requestApi('/auth/login', { method: 'POST', body: credentials }),
  googlePending: () => requestApi('/auth/google/pending'),
  completeGoogleSignup: (details) => requestApi('/auth/google/complete', { method: 'POST', body: details }),
  resetPassword: (details) => requestApi('/auth/reset-password', { method: 'POST', body: details }),
  regenerateRecoveryCodes: (details) => requestApi('/auth/recovery-codes/regenerate', { method: 'POST', body: details }),
  updateIdentity: (details) => requestApi('/auth/profile', { method: 'PATCH', body: details }),
  changePassword: (credentials) => requestApi('/auth/change-password', { method: 'POST', body: credentials }),
  async logout() {
    try { return await requestApi('/auth/logout', { method: 'POST', body: {} }); }
    finally { invalidateCsrfToken(); }
  },
});

export const signOut = async () => {
  await authService.logout();
  return { success: true };
};

export const changePassword = async (credentials) => {
  const result = await authService.changePassword(credentials);
  return { success: true, ...result };
};
