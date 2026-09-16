import { formatDisplayDateTime } from '../utils/appHelpers';

export default function AdminDataStatus({ health }) {
  const labels = {
    live: 'LIVE FIREBASE', offline: 'OFFLINE CACHE', unavailable: 'DATA UNAVAILABLE',
    syncing: 'SYNCING FIREBASE', unknown: 'CONNECTING TO FIREBASE',
  };
  return (
    <div className={`admin-data-status admin-data-status--${health.source}`} role="status" aria-live="polite">
      <strong>{labels[health.source] || labels.unknown}</strong>
      <span>LAST SYNC: {health.lastSyncAt ? formatDisplayDateTime(health.lastSyncAt) : 'Unknown'}</span>
      {health.source === 'offline' && <span>Showing last-known data.</span>}
      {health.source !== 'live' && <span>Admin changes are disabled until live sync succeeds.</span>}
      {health.error && <span>{health.error}</span>}
    </div>
  );
}
