import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { addDoc } from 'firebase/firestore';
import { RegisterPanel } from '../src/components/AuthPanels';
import { clearLegacyRegistrationStorage, writeRegistrationRequestsCache } from '../src/utils/registrationStorage';

vi.mock('../src/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(), collection: vi.fn(), serverTimestamp: vi.fn(() => 'server-time'),
}));
vi.mock('../src/auth/userAuth', () => ({ buildPinWritePatch: async () => ({ pin: null, pinHash: 'server-generated-hash' }) }));

beforeEach(() => { addDoc.mockReset(); });

describe('registration browser storage', () => {
  it('starts empty despite a complete legacy form and stays empty when reopened after abandoned input', () => {
    const oldForm = { package: 'Premium', dealerCode: '41012345', dealerName: 'Previous dealer',
      mobile: '9876543210', email: 'previous@example.com', pin: '9876', confirmPin: '9876',
      utr: 'old-payment', date: '2026-09-16' };
    localStorage.setItem('registrationData', JSON.stringify(oldForm));
    localStorage.setItem('registrationRequests', JSON.stringify([{ ...oldForm, id: 'old-request' }]));
    const props = { packageOptions: ['Premium'], packagePricing: {}, paymentUpiId: 'test@upi',
      pushToast: vi.fn(), logRecentActivity: vi.fn(), onClose: vi.fn(), onLogin: vi.fn() };
    const first = render(<RegisterPanel {...props} />);
    for (const name of Object.keys(oldForm)) expect(first.container.querySelector(`[name="${name}"]`).value).toBe('');
    expect(localStorage.getItem('registrationData')).toBeNull();
    fireEvent.change(first.container.querySelector('[name="dealerName"]'), { target: { value: 'New dealer' } });
    fireEvent.change(first.container.querySelector('[name="pin"]'), { target: { value: '1234' } });
    first.unmount();
    const reopened = render(<RegisterPanel {...props} />);
    for (const name of Object.keys(oldForm)) expect(reopened.container.querySelector(`[name="${name}"]`).value).toBe('');
    expect(localStorage.getItem('registrationData')).toBeNull();
    const cached = JSON.parse(localStorage.getItem('registrationRequests'));
    expect(cached[0]).not.toHaveProperty('pin');
    expect(cached[0]).not.toHaveProperty('confirmPin');
  });

  it('removes old form data and cached credentials while retaining request metadata', () => {
    localStorage.setItem('registrationData', JSON.stringify({ pin: '1234', confirmPin: '1234' }));
    localStorage.setItem('registrationRequests', JSON.stringify([
      { id: 'old', dealerCode: '123', pin: '1234', confirmPin: '1234', pinHash: 'hash' },
    ]));
    clearLegacyRegistrationStorage();
    expect(localStorage.getItem('registrationData')).toBeNull();
    expect(JSON.parse(localStorage.getItem('registrationRequests'))).toEqual([{ id: 'old', dealerCode: '123' }]);
  });

  it('never writes credentials, including when storage throws', () => {
    writeRegistrationRequestsCache([{ id: 'request', pin: '1234', confirmPin: '1234' }]);
    expect(JSON.parse(localStorage.getItem('registrationRequests'))).toEqual([{ id: 'request' }]);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage full'); });
    expect(() => writeRegistrationRequestsCache([{ pin: '1234' }])).not.toThrow();
    expect(localStorage.getItem('registrationRequests')).toBeNull();
  });

  it.each([true, false])('keeps PINs out of storage when submission succeeds=%s', async (success) => {
    if (success) addDoc.mockResolvedValue({ id: 'firebase-request' });
    else addDoc.mockRejectedValue(new Error('offline'));
    localStorage.setItem('registrationData', JSON.stringify({ pin: '9876', confirmPin: '9876' }));
    const onClose = vi.fn();
    const pushToast = vi.fn();
    const { container } = render(<RegisterPanel packageOptions={['Premium']} packagePricing={{}}
      paymentUpiId="test@upi" pushToast={pushToast} logRecentActivity={vi.fn()}
      onClose={onClose} onLogin={vi.fn()} />);
    expect(localStorage.getItem('registrationData')).toBeNull();
    expect(screen.getByPlaceholderText('PIN (4 digits)').value).toBe('');
    const values = { package: 'Premium', dealerCode: '123', dealerName: 'Test dealer',
      mobile: '9876543210', email: 'dealer@example.com', pin: '1234', confirmPin: '1234' };
    for (const [name, value] of Object.entries(values)) {
      fireEvent.change(container.querySelector(`[name="${name}"]`), { target: { value } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Register', exact: true }));
    await waitFor(() => expect(pushToast).toHaveBeenCalled());
    expect(localStorage.getItem('registrationData')).toBeNull();
    if (success) {
      const cached = JSON.parse(localStorage.getItem('registrationRequests'));
      expect(cached[0].id).toBe('firebase-request');
      expect(cached[0]).not.toHaveProperty('pin');
      expect(cached[0]).not.toHaveProperty('confirmPin');
      expect(screen.getByPlaceholderText('PIN (4 digits)').value).toBe('');
      expect(screen.getByPlaceholderText('Confirm PIN').value).toBe('');
      expect(onClose).toHaveBeenCalled();
    } else {
      expect(localStorage.getItem('registrationRequests')).toBeNull();
      expect(onClose).not.toHaveBeenCalled();
    }
  });
});
