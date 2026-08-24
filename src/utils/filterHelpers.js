export const isEkycNotDoneStatus = (status) => {
  const normalized = String(status || '').toLowerCase().trim();
  return normalized === 'pending' || normalized === 'ekyc not done' || normalized === 'not done';
};

export const normalizeFilterText = (value) => String(value || '')
  .trim()
  .replace(/\s+/g, ' ');

export const normalizeFilterKey = (value) => normalizeFilterText(value).toLowerCase();

export const normalizeMultiValueFilter = (value) => {
  if (Array.isArray(value)) {
    const seen = new Set();
    const nextValues = [];
    value.map((item) => normalizeFilterText(item)).filter(Boolean).forEach((item) => {
      const key = normalizeFilterKey(item);
      if (!seen.has(key) && key !== 'all') {
        seen.add(key);
        nextValues.push(item);
      }
    });
    return nextValues.length > 0 ? nextValues : 'All';
  }
  const normalized = normalizeFilterText(value);
  return normalized && normalizeFilterKey(normalized) !== 'all' ? [normalized] : 'All';
};

export const getMultiValueFilterValues = (value) => (
  Array.isArray(value)
    ? value.map((item) => normalizeFilterText(item)).filter(Boolean)
    : []
);

export const hasMultiValueFilterSelection = (value) => getMultiValueFilterValues(value).length > 0;

export const matchesMultiValueFilter = (filterValue, rowValue) => {
  const selectedValues = getMultiValueFilterValues(filterValue).map(normalizeFilterKey);
  if (selectedValues.length === 0) return true;
  const normalizedRowValue = normalizeFilterKey(String(rowValue || ''));
  return selectedValues.includes(normalizedRowValue);
};

export const formatMultiValueFilterLabel = (prefix, value) => {
  const selectedValues = getMultiValueFilterValues(value);
  if (selectedValues.length === 0) return '';
  if (selectedValues.length === 1) return `${prefix}: ${selectedValues[0]}`;
  return `${prefix}: ${selectedValues[0]} +${selectedValues.length - 1}`;
};

export const isAadhaarNotSeededStatus = (status) => {
  const normalized = String(status || '').toLowerCase().trim();
  return normalized === 'aadhaar not seeded';
};

export const isOnlinePaidStatus = (status) => String(status || '').toLowerCase().trim() === 'paid';

export const isPendingSvRow = (row = {}) => {
  const normalizedOrderType = String(row?.['Order Type'] || '').toLowerCase().trim();
  return normalizedOrderType.includes('pending sv');
};

export const isConsumerStatusMatch = (value, target) => {
  return String(value || '').toLowerCase().trim() === String(target || '').toLowerCase().trim();
};

export const isOrderSourceCategoryMatch = (value, category) => {
  const normalizedValue = String(value || '').toLowerCase().trim();
  const normalizedCategory = String(category || '').toLowerCase().trim();

  if (normalizedCategory === 'distributor manual') {
    return normalizedValue === 'distributor';
  }

  if (normalizedCategory === 'vitran manual') {
    return normalizedValue === 'vitran';
  }

  return normalizedValue === normalizedCategory;
};

export const hasMeaningfulCellValue = (value) => {
  const normalized = String(value ?? '').trim();
  return normalized !== '' && normalized !== '-';
};

export const isRegisteredMobileRow = (row = {}) => (
  hasMeaningfulCellValue(row['Mobile No.']) && hasMeaningfulCellValue(row['Is Reg Mobile'])
);

export const hasValidPendingConsumerNo = (row = {}) => /^\d{6}$/.test(String(row['Consumer No.'] || ''));

export const isCashMemoNotGeneratedRow = (row = {}) => {
  const normalizedStatus = String(row?.['Cash Memo Status'] || '').toLowerCase().trim();
  if (!normalizedStatus || normalizedStatus === '-') return true;
  return ['not generated', 'pending', 'not printed', 'not done', 'no'].some((value) => normalizedStatus.includes(value));
};

export const getReportPercentage = (value, total) => {
  const safeValue = Number(value || 0);
  const safeTotal = Number(total || 0);
  if (safeTotal <= 0) return 0;
  return Math.round((safeValue / safeTotal) * 100);
};

export const sortedUniqueValues = (values) => [...new Set(values
  .map((item) => normalizeFilterText(item))
  .filter(Boolean))]
  .sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true }));

export const normalizeSearchValue = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export const matchesSmartSearch = (row, query, smartSearchFields = []) => {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return true;

  return smartSearchFields.some((field) => normalizeSearchValue(row?.[field]).includes(normalizedQuery));
};