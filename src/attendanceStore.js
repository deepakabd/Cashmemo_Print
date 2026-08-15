import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const getKey = (user = {}) => {
  const identifier = user?.dealerCode || user?.id || user?.dealerName || 'default';
  return `cashmemoAttendance_${String(identifier).trim().replace(/\s+/g, '_')}`;
};

const getFirestoreAttendanceRef = (user = {}) => {
  const identifier = user?.id || user?.dealerCode || user?.dealerName || 'default';
  return doc(db, 'attendance', String(identifier).trim().replace(/\s+/g, '_'));
};

const normalizeAttendanceData = (data = {}) => ({
  employees: Array.isArray(data.employees) ? data.employees : [],
  records: data.records && typeof data.records === 'object' ? data.records : {},
});

export const loadAttendanceData = (user) => {
  try {
    const data = JSON.parse(localStorage.getItem(getKey(user)) || '{}');
    return normalizeAttendanceData(data);
  } catch {
    return { employees: [], records: {} };
  }
};

export const saveAttendanceData = (user, data) => {
  localStorage.setItem(getKey(user), JSON.stringify(data));
  void setDoc(getFirestoreAttendanceRef(user), { ...normalizeAttendanceData(data), updatedAt: serverTimestamp() }, { merge: true }).catch((error) => {
    console.warn('Attendance cloud save failed; local copy retained.', error);
  });
};

export const loadAttendanceDataFromFirebase = async (user) => {
  try {
    const snapshot = await getDoc(getFirestoreAttendanceRef(user));
    if (!snapshot.exists()) return loadAttendanceData(user);
    const data = normalizeAttendanceData(snapshot.data());
    localStorage.setItem(getKey(user), JSON.stringify(data));
    return data;
  } catch (error) {
    console.warn('Attendance cloud load failed; using local copy.', error);
    return loadAttendanceData(user);
  }
};

export const todayKey = () => new Date().toISOString().slice(0, 10);
export const currentTime = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
