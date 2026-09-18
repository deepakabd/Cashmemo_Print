import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoginDeviceDetails from '../src/components/LoginDeviceDetails';
import { normalizeLoginDevices } from '../src/utils/adminUiHelpers';

it('shows user identity separately from unavailable OS username and includes precise last-login details', () => {
  const [device] = normalizeLoginDevices([{ deviceId: 'pc', deviceName: 'Office Laptop', accountName: 'HP Agency',
    deviceUserName: 'Deepak', lastLoginAt: '2026-09-18T04:30:12Z', firstLoginAt: '2026-01-01T00:00:00Z',
    browser: 'Chrome', browserVersion: '130.0.1', os: 'Windows', platform: 'Win32',
    screen: '1920x1080', timezone: 'Asia/Kolkata', language: 'en-IN', architecture: 'x86', bitness: '64' }]);
  render(<LoginDeviceDetails device={device} />);
  expect(screen.getByText('Device user (entered): Deepak')).toBeTruthy();
  expect(screen.getByText('System user name').nextElementSibling.textContent).toBe('Unavailable in browser');
  const time = screen.getByText('Last login', { selector: 'dt' }).nextElementSibling.textContent;
  expect(time).toMatch(/18.*2026/);
  expect(time).toContain('10:00:12');
  expect(time).toContain('IST (UTC+05:30)');
  expect(screen.getByText('1920x1080')).toBeTruthy();
  expect(screen.getByText('x86 / 64-bit')).toBeTruthy();
});

it('handles legacy devices and missing details without guessing names or login times', () => {
  const [device] = normalizeLoginDevices([{ deviceId: 'old', platform: 'Win32' }]);
  render(<LoginDeviceDetails device={device} accountName="HP Agency" />);
  expect(screen.getByText('Account: HP Agency')).toBeTruthy();
  expect(screen.getByText('Device user (entered): Not provided')).toBeTruthy();
  expect(screen.getByText('Last login: Not recorded')).toBeTruthy();
});
