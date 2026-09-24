import { auth } from '../firebase';

export const saveRatesToCloudflare = async (userId, rates) => {
  if (!auth.currentUser) throw new Error('Sign in to save cloud rates.');
  const token = await auth.currentUser.getIdToken();
  const response = await fetch('/api/rates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mode: 'save', userId, rates }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Cloud rate save failed.');
  return result;
};

export const loadRatesFromCloudflare = async (userId) => {
  if (!auth.currentUser || !userId) return [];
  const token = await auth.currentUser.getIdToken();
  const response = await fetch('/api/rates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mode: 'load', userId }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Cloud rate load failed.');
  return Array.isArray(result.rates) ? result.rates : [];
};
