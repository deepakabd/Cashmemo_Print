export const sanitizeRegistrationRequests = (requests) => (
  Array.isArray(requests) ? requests.map((request) => {
    const safeRequest = { ...request };
    delete safeRequest.pin;
    delete safeRequest.confirmPin;
    delete safeRequest.pinHash;
    return safeRequest;
  }) : []
);

export const writeRegistrationRequestsCache = (requests) => {
  // Browser storage is optional; an accepted registration must stay successful
  // when storage is unavailable or full.
  try {
    localStorage.removeItem('registrationData');
    localStorage.setItem('registrationRequests', JSON.stringify(sanitizeRegistrationRequests(requests)));
  } catch {
    // If a sanitized replacement cannot be saved, remove the older cache.
    try { localStorage.removeItem('registrationRequests'); } catch { /* Storage unavailable. */ }
  }
};

export const clearLegacyRegistrationStorage = () => {
  try {
    localStorage.removeItem('registrationData');
    const raw = localStorage.getItem('registrationRequests');
    if (raw) {
      let requests;
      try { requests = JSON.parse(raw); } catch {
        localStorage.removeItem('registrationRequests');
        return;
      }
      writeRegistrationRequestsCache(requests);
    }
  } catch { /* No browser cache available. */ }
};
