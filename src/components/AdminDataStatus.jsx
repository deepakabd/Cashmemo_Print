export default function AdminDataStatus({ health }) {
  const labels = {
    live: 'LIVE FIREBASE', offline: 'OFFLINE CACHE', unavailable: 'DATA UNAVAILABLE',
    syncing: 'SYNCING FIREBASE', unknown: 'CONNECTING TO FIREBASE',
  };
  const syncedAt = new Date(health.lastSyncAt);
  const hasSync = Boolean(health.lastSyncAt) && Number.isFinite(syncedAt.getTime());
  const live = health.source === 'live';
  const syncLabel = hasSync ? new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(syncedAt) + ' IST' : 'No successful sync recorded';
  return (
    <div className={`admin-data-status admin-data-status--${health.source}`} role="status" aria-live="polite">
      <div className="admin-data-status__summary">
        <strong><span className="admin-data-status__dot" aria-hidden="true" />{labels[health.source] || labels.unknown}</strong>
        <span>Last successful sync: <time dateTime={hasSync ? syncedAt.toISOString() : undefined}>{syncLabel}</time></span>
      </div>
      <div className="admin-data-status__details">
        {live && <span>Snapshot confirmed by Firebase at the time above.</span>}
        {health.source === 'offline' && <span>Offline / Cached — showing last-known data; it may be stale.</span>}
        {health.source === 'syncing' && <span>Checking Firebase. Displayed data is not yet confirmed for this refresh.</span>}
        {!live && <span>Admin changes are disabled until live sync succeeds. Approve, Reject, Delete and Restore require live data.</span>}
        {health.error && <span>{health.error}</span>}
      </div>
    </div>
  );
}
