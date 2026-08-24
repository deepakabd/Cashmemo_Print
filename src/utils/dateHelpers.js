// Helper function to convert Excel serial date to JavaScript Date object
export const excelSerialDateToJSDate = (serial) => {
  if (typeof serial !== 'number' || isNaN(serial)) {
    return null;
  }
  const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Excel's epoch is Dec 30, 1899
  const ms = serial * 24 * 60 * 60 * 1000;
  const date = new Date(excelEpoch.getTime() + ms);
  return isNaN(date.getTime()) ? null : date; // Return null if date is invalid
};

// Helper function to format a Date object to DD-MM-YYYY
export const formatDateToDDMMYYYY = (date) => {
  if (!(date instanceof Date)) {
    return '';
  }
  if (isNaN(date.getTime())) {
    return '';
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

export const createValidatedDate = (year, month, day, hour = 0, minute = 0, second = 0) => {
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) || 0,
    Number(minute) || 0,
    Number(second) || 0,
  );
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }
  return date;
};

// Helper function to parse various date string formats
export const parseDateString = (dateString) => {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }

  const trimmedDateString = dateString.trim();
  if (trimmedDateString === '') {
    return null;
  }

  // Attempt 1: DD-MM-YYYY / DD/MM/YYYY / DD,MM,YYYY with optional HH:mm or HH:mm:ss
  let parts = trimmedDateString.match(/^(\d{1,2})[-/,](\d{1,2})[-/,](\d{4})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (parts) {
    const date = createValidatedDate(parts[3], parts[2], parts[1], parts[4], parts[5], parts[6]);
    if (date) return date;
  }

  // Attempt 2: YYYY-MM-DD / YYYY/MM/DD with optional HH:mm or HH:mm:ss
  parts = trimmedDateString.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (parts) {
    const date = createValidatedDate(parts[1], parts[2], parts[3], parts[4], parts[5], parts[6]);
    if (date) return date;
  }

  // Attempt 3: only allow native parsing for unambiguous strings.
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmedDateString) || /[a-zA-Z]/.test(trimmedDateString)) {
    const date = new Date(trimmedDateString);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  const compactParts = trimmedDateString.match(/^(\d{1,2})(\d{1,2})(\d{4})$/);
  if (compactParts) {
    const date = createValidatedDate(compactParts[3], compactParts[2], compactParts[1]);
    if (date) {
      return date;
    }
  }

  if (/^\d+$/.test(trimmedDateString)) {
    const excelValue = Number(trimmedDateString);
    const date = excelSerialDateToJSDate(excelValue);
    if (date) {
      return date;
    }
  }

  // If all attempts fail, return null
  return null;
};

export const getNormalizedRowDate = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value);
  }
  if (typeof value === 'number') {
    return excelSerialDateToJSDate(value);
  }
  if (typeof value === 'string') {
    return parseDateString(value);
  }
  return null;
};

export const getStartOfDay = (value) => {
  const date = getNormalizedRowDate(value);
  if (!date) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

export const getElapsedDays = (value, now = new Date()) => {
  const date = getStartOfDay(value);
  if (!date) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
};

export const formatDisplayDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB');
};

export const formatDisplayDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-GB');
};

export const getRemainingDays = (validTill) => {
  if (!validTill) return null;
  const end = new Date(validTill);
  if (Number.isNaN(end.getTime())) return null;
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};