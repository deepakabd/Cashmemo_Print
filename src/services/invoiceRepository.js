import { auth } from '../firebase';
export const invoiceRequest = async (userId, operation) => {
  if (!auth.currentUser) throw new Error('Sign in to use cloud billing.');
  const token = await auth.currentUser.getIdToken();
  const response = await fetch('/api/invoice-workspace', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ userId, ...operation }) });
  const result = await response.json();
  if (!response.ok) { const error = new Error(result.error || 'Billing operation failed.'); error.status = response.status; throw error; }
  return result;
};
