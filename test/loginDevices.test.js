import { describe, expect, it, vi } from 'vitest';
import { getCurrentDeviceInfo, getLoginDeviceName, normalizeLoginDevices } from '../src/utils/adminUiHelpers.js';

describe('login device names', () => {
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
