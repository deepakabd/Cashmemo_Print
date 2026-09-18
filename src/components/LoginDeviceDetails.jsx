const loginTime = (value) => {
  if (!value) return 'Not recorded';
  const date = new Date(typeof value.toDate === 'function' ? value.toDate()
    : typeof value === 'object' && value.seconds != null ? value.seconds * 1000 : value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return `${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(date)} IST (UTC+05:30)`;
};

export default function LoginDeviceDetails({ device, accountName = '' }) {
  const browser = [device.browser, device.browserVersion].filter(Boolean).join(' ');
  const details = [
    ['Account / dealer', device.accountName || accountName],
    ['Device user name (entered)', device.deviceUserName || 'Not provided'],
    ['System user name', 'Unavailable in browser'],
    ['Last login', loginTime(device.lastLoginAt)],
    ['First login', loginTime(device.firstLoginAt)],
    ['Operating system', device.os],
    ['OS / platform version (reported)', device.osVersion],
    ['Browser', browser],
    ['Platform', device.platform],
    ['Architecture', [device.architecture, device.bitness ? `${device.bitness}-bit` : ''].filter(Boolean).join(' / ')],
    ['Model', device.model],
    ['Screen resolution', device.screen],
    ['Device timezone', device.timezone],
    ['Browser language', device.language],
    ['Device ID', device.deviceId],
    ['User agent', device.userAgent],
  ];
  return (
    <div className="admin-device-meta">
      <strong>{device.deviceName || 'Unknown device'}</strong>
      <span>Account: {device.accountName || accountName || 'Not recorded'}</span>
      <span>Device user (entered): {device.deviceUserName || 'Not provided'}</span>
      <span>Last login: {loginTime(device.lastLoginAt)}</span>
      <span>{[browser, device.os || device.platform].filter(Boolean).join(' | ')}</span>
      <details className="admin-device-details">
        <summary>Full login details</summary>
        <dl>{details.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>
        ))}</dl>
      </details>
    </div>
  );
}
