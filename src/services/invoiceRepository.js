import { auth } from '../firebase';
export const invoiceRequest = async (userId, operation) => {
  if (!auth.currentUser) throw new Error('Sign in to use cloud billing.');
  const request = async (forceRefresh = false) => {
    const token = await auth.currentUser.getIdToken(forceRefresh);
    return fetch('/api/invoice-workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId, ...operation }),
      signal: AbortSignal.timeout(20000),
    });
  };
  let response;
  try {
    response = await request();
    // Firebase sessions can remain open while their cached ID token expires or
    // its custom account claims change. Refresh once before asking for sign-in.
    if (response.status === 401) response = await request(true);
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      const timeoutError = new Error('Cloud billing request timed out. Click Sync Data to retry.');
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  }
  const result = await response.json();
  if (!response.ok) {
    const message = response.status === 401
      ? 'Your login session expired. Sign out and sign in again, then click Sync Data.'
      : result.error || 'Billing operation failed.';
    const error = new Error(message); error.status = response.status; throw error;
  }
  return result;
};
