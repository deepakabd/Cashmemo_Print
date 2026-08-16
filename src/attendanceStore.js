import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from './firebase';

const getKey = (user = {}) => {
  const identifier = user?.dealerCode || user?.id || user?.dealerName || 'default';
  return `cashmemoAttendance_${String(identifier).trim().replace(/\s+/g, '_')}`;
};

const getFirestoreAttendanceRef = (user = {}) => {
  const identifier = user?.id || user?.dealerCode || user?.dealerName || 'default';
  return doc(db, 'users', String(identifier).trim().replace(/\s+/g, '_'));
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
  const syncKey = `${getKey(user)}_sync`;
  localStorage.setItem(syncKey, 'pending');
  window.dispatchEvent(new CustomEvent('attendance-sync-status', { detail: { status: 'pending' } }));
  void setDoc(getFirestoreAttendanceRef(user), { attendanceData: { ...normalizeAttendanceData(data), updatedAt: serverTimestamp() } }, { merge: true }).then(() => {
    localStorage.setItem(syncKey, 'synced');
    window.dispatchEvent(new CustomEvent('attendance-sync-status', { detail: { status: 'synced' } }));
  }).catch((error) => {
    console.warn('Attendance cloud save failed; local copy retained.', error);
    window.dispatchEvent(new CustomEvent('attendance-sync-status', { detail: { status: 'offline' } }));
  });
};

export const loadAttendanceDataFromFirebase = async (user) => {
  try {
    const snapshot = await getDoc(getFirestoreAttendanceRef(user));
    if (!snapshot.exists() || !snapshot.data()?.attendanceData) return loadAttendanceData(user);
    const data = normalizeAttendanceData(snapshot.data().attendanceData);
    localStorage.setItem(getKey(user), JSON.stringify(data));
    return data;
  } catch (error) {
    console.warn('Attendance cloud load failed; using local copy.', error);
    return loadAttendanceData(user);
  }
};

export const subscribeAttendanceData = (user, onData, onError) => onSnapshot(
  getFirestoreAttendanceRef(user),
  (snapshot) => {
    const remoteData = snapshot.data()?.attendanceData;
    if (remoteData) {
      if (localStorage.getItem(`${getKey(user)}_sync`) === 'pending') {
        window.dispatchEvent(new CustomEvent('attendance-sync-status', { detail: { status: 'conflict' } }));
        return;
      }
      onData(normalizeAttendanceData(remoteData));
    }
  },
  (error) => {
    console.warn('Attendance realtime sync unavailable; local copy retained.', error);
    onError?.(error);
  },
);

export const uploadAttendanceAsset = async (user, file, folder = 'files') => {
  const identifier = String(user?.id || user?.dealerCode || user?.dealerName || 'default').trim().replace(/\s+/g, '_');
  const safeName = String(file.name || 'upload').replace(/[^a-z0-9._-]/gi, '_');
  const assetRef = ref(storage, `attendance/${identifier}/${folder}/${Date.now()}-${safeName}`);
  await uploadBytes(assetRef, file);
  return getDownloadURL(assetRef);
};

export const compressImageFile = (file, maxDimension = 1200, quality = 0.82) => new Promise((resolve) => {
  if (!file?.type?.startsWith('image/') || typeof URL === 'undefined' || typeof Image === 'undefined') return resolve(file);
  const image = new Image();
  const objectUrl = URL.createObjectURL(file);
  image.onload = () => {
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => { URL.revokeObjectURL(objectUrl); resolve(blob || file); }, 'image/jpeg', quality);
  };
  image.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
  image.src = objectUrl;
});

export const todayKey = () => new Date().toISOString().slice(0, 10);
export const currentTime = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

export const generateEmployeeCode = (employee = {}, dealerCode = 'DEALER', existingEmployees = [], fallbackSequence = 1) => {
  const createdAt = String(employee.id || '').match(/^(\d{13})/);
  const date = createdAt ? new Date(Number(createdAt[1])) : new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  const prefix = `${String(dealerCode).replace(/\s+/g, '').toUpperCase()}${month}${year}`;
  const usedSequences = existingEmployees.map((item) => String(item.employeeCode || '').match(new RegExp(`^${prefix}(\\d{3})$`))?.[1]).filter(Boolean).map(Number);
  // Continue the existing sequence for this dealer/month; otherwise start at
  // the caller-provided fallback (normally 001 for the first employee).
  const sequence = usedSequences.length ? Math.max(...usedSequences, 0) + 1 : Math.max(1, fallbackSequence);
  return `${prefix}${String(sequence).padStart(3, '0')}`;
};
