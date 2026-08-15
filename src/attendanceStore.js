const getKey = (user = {}) => {
  const identifier = user?.dealerCode || user?.id || user?.dealerName || 'default';
  return `cashmemoAttendance_${String(identifier).trim().replace(/\s+/g, '_')}`;
};

export const loadAttendanceData = (user) => {
  try {
    const data = JSON.parse(localStorage.getItem(getKey(user)) || '{}');
    return {
      employees: Array.isArray(data.employees) ? data.employees : [],
      records: data.records && typeof data.records === 'object' ? data.records : {},
    };
  } catch {
    return { employees: [], records: {} };
  }
};

export const saveAttendanceData = (user, data) => {
  localStorage.setItem(getKey(user), JSON.stringify(data));
};

export const todayKey = () => new Date().toISOString().slice(0, 10);
export const currentTime = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
