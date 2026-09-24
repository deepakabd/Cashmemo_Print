import { auth } from '../firebase';

const request = async (body) => {
  if (!auth.currentUser) throw new Error('Sign in to access cloud pending bookings.');
  const token = await auth.currentUser.getIdToken();
  const response = await fetch('/api/pending-bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Cloud pending-booking request failed.');
  return result;
};

export const savePendingBookingsToCloudflare = (userId, rows, metadata) => (
  request({ mode: 'save', userId, rows, metadata })
);

export const loadPendingBookingsFromCloudflare = async (userId) => {
  if (!auth.currentUser || !userId) return null;
  const result = await request({ mode: 'load', userId });
  return result.snapshot || null;
};
