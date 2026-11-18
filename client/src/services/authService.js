// Authentication is not connected in this frontend preview. Keep these calls
// as the single integration seam for a future authenticated API.
export async function changePassword(credentials) {
  void credentials;
  return {
    success: false,
    reason: 'unavailable',
    message: 'Password changes are not connected yet. Your current password was not verified and no password was changed.',
  };
}

export async function signOut() {
  return {
    success: false,
    reason: 'unavailable',
    message: 'Sign out is not connected in this frontend preview. Your demo session remains active and your progress is unchanged.',
  };
}
