import { describe, expect, it, vi } from 'vitest';
import { getCurrentDeviceInfo, getLoginDeviceName, getLoginSystemInfo, normalizeLoginDevices, upsertLoginDevice } from '../src/utils/adminUiHelpers.js';

describe('login device names', () => {
  it('records entered user names and supported system hints, and retains them through normalization', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
      platform: 'Win32', language: 'en-IN', userAgentData: {
        platform: 'Windows', getHighEntropyValues: vi.fn().mockResolvedValue({
          platformVersion: '15.0.0', architecture: 'x86', bitness: '64', model: '',
          fullVersionList: [{ brand: 'Chromium', version: '130.0.1.1' }, { brand: 'Microsoft Edge', version: '130.0.2849.80' }],
        }),
      },
    });
    try {
      const info = await getCurrentDeviceInfo({ deviceUserName: ' Deepak ' });
      expect(info).toMatchObject({ deviceName: 'Windows PC', deviceUserName: 'Deepak', browser: 'Microsoft Edge',
        browserVersion: '130.0.2849.80', os: 'Windows', osVersion: '15.0.0', architecture: 'x86', bitness: '64', language: 'en-IN' });
      expect(info.timezone).toBeTruthy();
      expect(normalizeLoginDevices([info])[0]).toMatchObject(info);
      expect(info).not.toHaveProperty('systemUserName');
    } finally { vi.unstubAllGlobals(); }
  });

  it('parses legacy system information without inventing a system username', () => {
    const [device] = normalizeLoginDevices([{ deviceId: 'pc', platform: 'Win32',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91' }]);
    expect(device).toMatchObject({ browser: 'Microsoft Edge', browserVersion: '120.0.2210.91', os: 'Windows', deviceUserName: '' });
    expect(getLoginSystemInfo({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1' }))
      .toMatchObject({ browser: 'Safari', browserVersion: '18.0', osVersion: '18.0' });
  });

  it('updates the latest login details while retaining first login and block metadata', () => {
    const devices = upsertLoginDevice([{ deviceId: 'pc', firstLoginAt: '2026-01-01T00:00:00Z',
      blocked: true, blockedAt: '2026-02-01T00:00:00Z' }], { deviceId: 'pc', deviceUserName: 'Deepak',
      accountName: 'HP Agency', os: 'Windows', browserVersion: '130.0.1' }, '2026-09-18T04:30:12Z');
    expect(normalizeLoginDevices(devices)[0]).toMatchObject({ firstLoginAt: '2026-01-01T00:00:00Z',
      lastLoginAt: '2026-09-18T04:30:12Z', deviceUserName: 'Deepak', accountName: 'HP Agency',
      blocked: true, blockedAt: '2026-02-01T00:00:00Z', os: 'Windows', browserVersion: '130.0.1' });
  });

  it('falls back within 700ms if system hint collection stalls', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { userAgent: 'Chrome/130.0', platform: 'Win32',
      userAgentData: { getHighEntropyValues: () => new Promise(() => {}) } });
    try {
      const pending = getCurrentDeviceInfo();
      await vi.advanceTimersByTimeAsync(700);
      expect(await pending).toMatchObject({ deviceName: 'Windows PC', browserVersion: '130.0' });
    } finally { vi.useRealTimers(); vi.unstubAllGlobals(); }
  });

  it('upgrades legacy browser labels to readable device names', () => {
    expect(normalizeLoginDevices([{ deviceId: 'pc', deviceName: 'Chrome on Win32', platform: 'Win32' }])[0].deviceName).toBe('Windows PC');
    expect(getLoginDeviceName({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' })).toBe('iPhone');
    expect(getLoginDeviceName({ userAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit Mobile' })).toBe('Android Phone');
  });

  it('preserves custom names and uses model hints when available', async () => {
    expect(getLoginDeviceName({ deviceName: 'Office Laptop', platform: 'Win32' })).toBe('Office Laptop');
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 10; K) Chrome/120 Mobile',
      userAgentData: { mobile: true, getHighEntropyValues: vi.fn().mockResolvedValue({ model: 'Pixel 8', platform: 'Android' }) },
    });
    try {
      const info = await getCurrentDeviceInfo();
      expect(info.deviceName).toBe('Pixel 8');
      expect(info.browser).toBe('Chrome');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('still records the device if model access is denied', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Chrome/120', platform: 'Win32',
      userAgentData: { getHighEntropyValues: vi.fn().mockRejectedValue(new Error('Unavailable')) },
    });
    try {
      expect((await getCurrentDeviceInfo()).deviceName).toBe('Windows PC');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
