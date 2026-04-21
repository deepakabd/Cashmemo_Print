﻿import { useState, useEffect, useMemo, useRef } from 'react';
import { lazy, Suspense, useCallback } from 'react';
import FileUpload from './FileUpload';
import RateUpdatePage from './RateUpdatePage';
import UserMenuDropdown from './components/UserMenuDropdown';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { addDoc, arrayUnion, collection, deleteDoc, doc, getDocs, getDoc, setDoc, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';

import './App.css';
import {
  buildPrintDataHtml,
} from './utils/printSelection';
import { useAdminData } from './hooks/useAdminData';
import { useApprovalQueue } from './hooks/useApprovalQueue';
import { useCashmemoSelection } from './hooks/useCashmemoSelection';
import { useParsedDataFilters } from './hooks/useParsedDataFilters';

const LazyInvoicePage = lazy(() => import('./InvoicePage'));

// Helper function to convert Excel serial date to JavaScript Date object
const excelSerialDateToJSDate = (serial) => {
  if (typeof serial !== 'number' || isNaN(serial)) {
    return null;
  }
  const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Excel's epoch is Dec 30, 1899
  const ms = serial * 24 * 60 * 60 * 1000;
  const date = new Date(excelEpoch.getTime() + ms);
  return isNaN(date.getTime()) ? null : date; // Return null if date is invalid
};

// Helper function to format a Date object to DD-MM-YYYY


const formatDateToDDMMYYYY = (date) => {
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

const readImageFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  if (!(file instanceof File)) {
    reject(new Error('Invalid file.'));
    return;
  }
  const reader = new FileReader();
  reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
  reader.onerror = () => reject(new Error('Image read failed.'));
  reader.readAsDataURL(file);
});

const createValidatedDate = (year, month, day, hour = 0, minute = 0, second = 0) => {
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
const parseDateString = (dateString) => {
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

const getNormalizedRowDate = (value) => {
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

const getStartOfDay = (value) => {
  const date = getNormalizedRowDate(value);
  if (!date) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const getElapsedDays = (value, now = new Date()) => {
  const date = getStartOfDay(value);
  if (!date) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
};

const isEkycNotDoneStatus = (status) => {
  const normalized = String(status || '').toLowerCase().trim();
  return normalized === 'pending' || normalized === 'ekyc not done' || normalized === 'not done';
};

const isOnlinePaidStatus = (status) => String(status || '').toLowerCase().trim() === 'paid';

const isPendingSvRow = (row = {}) => {
  const normalizedOrderType = String(row?.['Order Type'] || '').toLowerCase().trim();
  return normalizedOrderType.includes('pending sv');
};

const isConsumerStatusMatch = (value, target) => {
  return String(value || '').toLowerCase().trim() === String(target || '').toLowerCase().trim();
};

const sortedUniqueValues = (values) => [...new Set(values.filter(Boolean))]
  .sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true }));

const getCashMemoPerPage = (pageType) => {
  if (pageType === '2 Cashmemo/Page') return 2;
  if (pageType === '4 Cashmemo/Page') return 4;
  return 3;
};

const CASHMEMO_PAGE_TYPES = ['2 Cashmemo/Page', '3 Cashmemo/Page', '4 Cashmemo/Page'];

const CASHMEMO_LABEL_OPTIONS = [
  { key: 'consumerName', label: 'Consumer Name', group: 'Distributor Copy' },
  { key: 'consumerNoLpgId', label: 'Consumer No / LPG ID', group: 'Distributor Copy' },
  { key: 'address', label: 'Address', group: 'Distributor Copy' },
  { key: 'mobileNo', label: 'Mobile No.', group: 'Common Details' },
  { key: 'deliveryArea', label: 'Delivery Area', group: 'Distributor Copy' },
  { key: 'deliveryStaff', label: 'Delivery Staff', group: 'Distributor Copy' },
  { key: 'productHsnQty', label: 'Product / HSN / Qty', group: 'Distributor Copy' },
  { key: 'orderNoAndDate', label: 'Order No. & Order Date', group: 'Distributor Copy' },
  { key: 'cashMemoNoAndDate', label: 'Cash Memo No. & Date', group: 'Distributor Copy' },
  { key: 'basePrice', label: 'Base Price (Rs.)', group: 'Amount Details' },
  { key: 'dlvryCharges', label: 'Dlvry Charges (Rs.)', group: 'Amount Details' },
  { key: 'cashCarryRebate', label: 'C & C Rebate (Rs.)', group: 'Amount Details' },
  { key: 'cgst', label: 'CGST (2.50%)(Rs.)', group: 'Amount Details' },
  { key: 'sgst', label: 'SGST (2.50%)(Rs.)', group: 'Amount Details' },
  { key: 'totalAmount', label: 'Total Amount (Rs.)', group: 'Amount Details' },
  { key: 'eKyc', label: 'E-KYC', group: 'Common Details' },
  { key: 'payment', label: 'Payment', group: 'Common Details' },
  { key: 'taxConsumerName', label: 'Tax Consumer Name', group: 'Tax Invoice' },
  { key: 'taxConsumerNo', label: 'Tax Consumer No.', group: 'Tax Invoice' },
  { key: 'taxLpgId', label: 'Tax LPG ID', group: 'Tax Invoice' },
  { key: 'taxAddress', label: 'Tax Address', group: 'Tax Invoice' },
  { key: 'category', label: 'Category', group: 'Tax Invoice' },
  { key: 'productHsn', label: 'Product/ HSN', group: 'Tax Invoice' },
  { key: 'connectionQty', label: 'Connection/ Qty', group: 'Tax Invoice' },
  { key: 'bookingSource', label: 'Booking Source', group: 'Tax Invoice' },
  { key: 'orderNo', label: 'Order No.', group: 'Tax Invoice' },
  { key: 'orderDate', label: 'Order Date', group: 'Tax Invoice' },
  { key: 'cashMemoNo', label: 'CashMemo No.', group: 'Tax Invoice' },
  { key: 'cashMemoDate', label: 'CashMemo Date', group: 'Tax Invoice' },
  { key: 'deliveryCharges', label: 'Delivery Charges (Rs.)', group: 'Tax Invoice' },
  { key: 'taxableAmount', label: 'Taxable Amount (Rs.)', group: 'Tax Invoice' },
  { key: 'advanceOnline', label: 'Advance (Online) (Rs.)', group: 'Tax Invoice' },
  { key: 'netPayable', label: 'Net Payable (Rs.)', group: 'Tax Invoice' },
];

const DEFAULT_HIDDEN_LABELS_BY_PAGE_TYPE = {
  '4 Cashmemo/Page': new Set(['deliveryStaff', 'productHsnQty', 'dlvryCharges', 'cashCarryRebate', 'category', 'productHsn', 'connectionQty', 'deliveryCharges', 'taxableAmount']),
};

const createDefaultCashMemoLabelSettings = () => {
  const settings = {};
  CASHMEMO_PAGE_TYPES.forEach((type) => {
    const hiddenLabels = DEFAULT_HIDDEN_LABELS_BY_PAGE_TYPE[type] || new Set();
    settings[type] = CASHMEMO_LABEL_OPTIONS.reduce((acc, item) => {
      acc[item.key] = !hiddenLabels.has(item.key);
      return acc;
    }, {});
  });
  return settings;
};

const mergeCashMemoLabelSettings = (savedSettings = {}) => {
  const defaults = createDefaultCashMemoLabelSettings();
  CASHMEMO_PAGE_TYPES.forEach((type) => {
    defaults[type] = {
      ...defaults[type],
      ...(savedSettings?.[type] || {}),
    };
  });
  return defaults;
};

const getCashMemoLabelSettingsStorageKey = (dealerCode = '') => (
  dealerCode ? `cashMemoLabelSettings_${String(dealerCode).trim()}` : 'cashMemoLabelSettings'
);

const USER_SESSION_STORAGE_KEY = 'cashmemoUserSession';
const APPROVAL_REPLIES_STORAGE_KEY = 'approvalReplies';
const FILTER_PRESET_STORAGE_KEY_PREFIX = 'cashmemoFilterPresets_';
const RECENT_ACTIVITY_STORAGE_KEY_PREFIX = 'cashmemoRecentActivity_';

const getPlanUpgradeReplyStorageKey = ({ userId = '', dealerCode = '', dealerName = '' } = {}) => {
  const userKey = String(userId || dealerCode || dealerName || '').trim();
  return userKey ? `planUpgrade-${userKey}` : 'planUpgrade';
};

const PACKAGE_OPTIONS = [
  'Demo Package - 7 Days',
  'Premium Package - 30 Days',
  'Enterprise Package - 365 Days',
  'Enterprise Package with (हिंदी) - 365 Days',
];

const PACKAGE_PRICING = {
  'Demo Package - 7 Days': 'Free',
  'Premium Package - 30 Days': 'Rs. 3000',
  'Enterprise Package - 365 Days': 'Rs. 7500',
  'Enterprise Package with (हिंदी) - 365 Days': 'Rs. 10000',
  'Premium Package with (हिंदी) - 365 Days': 'Rs. 10000',
  'Premium Package (हिंदी) - 365 Days': 'Rs. 10000',
};

const PAYMENT_UPI_ID = '8002074620@ybl';
const HINDI_ENTERPRISE_PACKAGE_NAMES = [
  'Enterprise Package with (हिंदी) - 365 Days',
  'Premium Package with (हिंदी) - 365 Days',
  'Premium Package (हिंदी) - 365 Days',
];

const getPackageValidityDays = (packageName = '') => {
  const normalized = String(packageName || '').toLowerCase();
  if (normalized.includes('demo')) return 7;
  if (
    normalized.includes('enterprise package with (हिंदी)') ||
    normalized.includes('premium package with (हिंदी)') ||
    normalized.includes('premium package (हिंदी)')
  ) return 365;
  if (normalized.includes('premium')) return 30;
  if (normalized.includes('enterprise')) return 365;
  return 0;
};

const isHindiEnterprisePackage = (packageName = '') => HINDI_ENTERPRISE_PACKAGE_NAMES.includes(packageName);
const isEnterpriseHindiPackage = (packageName = '') => String(packageName || '').trim() === 'Enterprise Package with (हिंदी) - 365 Days';

const computeValidityDates = (packageName = '', baseDate = new Date()) => {
  const days = getPackageValidityDays(packageName);
  const validFrom = new Date(baseDate);
  const validTill = new Date(baseDate);
  if (days > 0) {
    validTill.setDate(validTill.getDate() + days);
  }
  return {
    packageDays: days,
    validFrom: validFrom.toISOString(),
    validTill: validTill.toISOString(),
  };
};

const isUserExpired = (user) => {
  const validTillRaw = user?.validTill;
  if (!validTillRaw) return false;
  const validTillDate = new Date(validTillRaw);
  if (Number.isNaN(validTillDate.getTime())) return false;
  return new Date().getTime() > validTillDate.getTime();
};

const formatDisplayDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB');
};

const formatDisplayDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-GB');
};

const getRemainingDays = (validTill) => {
  if (!validTill) return null;
  const end = new Date(validTill);
  if (Number.isNaN(end.getTime())) return null;
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

const formatPackageNameForNavbar = (packageName = '') => {
  const name = String(packageName || '')
    .trim()
    .replace('Premium Package with (हिंदी)', 'Enterprise Package with (हिंदी)')
    .replace('Premium Package (हिंदी)', 'Enterprise Package with (हिंदी)');
  if (!name) return 'N/A';
  return name.replace(/\s*-\s*\d+\s*Days?\s*$/i, '').trim();
};

const formatPackageOptionLabel = (packageName = '') => {
  const days = getPackageValidityDays(packageName);
  const validityText = days > 0 ? `${days} ${days === 1 ? 'Day' : 'Days'}` : 'N/A';
  return `${formatPackageNameForNavbar(packageName)} - ${PACKAGE_PRICING[packageName] || '-'} - Validity: ${validityText}`;
};

const getDictionaryDocId = (englishWord = '') => (
  encodeURIComponent(String(englishWord || '').trim().toLowerCase()).replace(/\./g, '%2E') || `word-${Date.now()}`
);

const getExistingDictionaryEntry = (dictionary = {}, englishWord = '') => {
  const normalized = String(englishWord || '').trim().toLowerCase();
  if (!normalized) return null;
  const existingKey = Object.keys(dictionary || {}).find((key) => String(key || '').trim().toLowerCase() === normalized);
  if (!existingKey) return null;
  return {
    englishWord: existingKey,
    hindiTranslation: dictionary[existingKey],
  };
};

const PLAN_UPGRADE_OPTIONS = PACKAGE_OPTIONS.filter((pkg) => !pkg.toLowerCase().includes('demo'));

const normalizePendingTypeLabel = (type) => {
  const raw = String(type || '').toLowerCase().trim();
  if (raw === 'profile' || raw === 'profiledata') return 'profile';
  if (raw === 'bank' || raw === 'bankdetails' || raw === 'bankdetailsdata') return 'bank';
  if (raw === 'rates' || raw === 'rate' || raw === 'ratesdata') return 'rates';
  if (raw === 'header' || raw === 'hindiheader' || raw === 'hindiheaderdata') return 'header';
  if (raw === 'planupgrade' || raw === 'plan' || raw === 'package') return 'plan upgrade';
  if (raw === 'deliveryarea' || raw === 'delivery area') return 'Delivery Area';
  if (raw === 'deliverystaff' || raw === 'delivery staff') return 'Delivery Staff';
  return raw;
};

const headerMapping = {
  uniqueconsumerid: 'UniqueConsumerId',
  consumerno: 'Consumer No.',
  consumername: 'Consumer Name',
  naturecode_desc: 'Consumer Nature',
  packagecode_desc: 'Consumer Package',
  consumertype: 'Consumer Type',
  orderno: 'Order No.',
  orderstatus: 'Order Status',
  orderdate: 'Order Date',
  ordersource: 'Order Source',
  ordertype: 'Order Type',
  cashmemono: 'Cash Memo No.',
  cashmemostatus: 'Cash Memo Status',
  cashmemodate: 'Cash Memo Date',
  orderquantity: 'Order Qty.',
  consumedsubsidyqty: 'Consumed Subsidy Qty',
  areaname: 'Delivery Area',
  deliveryman: 'Delivery Man',
  refillpaymentstatus: 'Online Refill Payment status',
  ivrsbookingnumber: 'IVR Booking No.',
  mobileno: 'Mobile No.',
  bookingdonethroughregisteremobile: 'Is Reg Mobile',
  consumeraddress: 'Address',
  isrefillport: 'IsRefillPort',
  ekycstatus: 'EKYC Status',
};

const normalizeData = (data) => {
  return data.map(row => {
    const newRow = {};
    for (const key in row) {
      if (Object.prototype.hasOwnProperty.call(row, key)) {
        const cleanedKey = key.trim().replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
        const newKey = headerMapping[cleanedKey] || key.trim();
        newRow[newKey] = row[key];
      }
    }
    if (!newRow['LPG ID'] && newRow.UniqueConsumerId) {
      newRow['LPG ID'] = newRow.UniqueConsumerId;
    }
    return newRow;
  });
};








function App() {
  const fileInputRef = useRef(null);
  const [translationDictionary, setTranslationDictionary] = useState({});
  const [toastItems, setToastItems] = useState([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [savedFilterPresets, setSavedFilterPresets] = useState([]);
  const [userPinVisible, setUserPinVisible] = useState(false);
  const [recentActivities, setRecentActivities] = useState([]);
  const [isUserLoginSubmitting, setIsUserLoginSubmitting] = useState(false);
  const [isAdminLoginSubmitting, setIsAdminLoginSubmitting] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfileUpdate, setShowProfileUpdate] = useState(false);
  const [showRateUpdate, setShowRateUpdate] = useState(false);
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [userProfileInitialSection, setUserProfileInitialSection] = useState('overview');
  const [showContactForm, setShowContactForm] = useState(false);
  const [showDictionaryForm, setShowDictionaryForm] = useState(false);
  const [dictionaryFormMode, setDictionaryFormMode] = useState('default');
  const [showHomeInfo, setShowHomeInfo] = useState(false);
  const [showAboutInfo, setShowAboutInfo] = useState(true);
  const [showInvoicePage, setShowInvoicePage] = useState(false);
  const [showLabelUpdate, setShowLabelUpdate] = useState(false);
  const [showHeaderUpdate, setShowHeaderUpdate] = useState(false);
  const [showUpgradePlan, setShowUpgradePlan] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showUserLogin, setShowUserLogin] = useState(false);
  const [adminLoginId, setAdminLoginId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [userDealerCode, setUserDealerCode] = useState('');
  const [userPin, setUserPin] = useState('');
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [dealerWelcome, setDealerWelcome] = useState('');
  const [sampleDataLoaded, setSampleDataLoaded] = useState(false);
  const [sampleDataLoading, setSampleDataLoading] = useState(false);
  const [sampleDataAttempted, setSampleDataAttempted] = useState(false);
  const [adminFlashMessage, setAdminFlashMessage] = useState(null);

  const pushToast = useCallback((message, tone = 'info') => {
    if (!message) return;
    const toastId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToastItems((prev) => [...prev, { id: toastId, message, tone }]);
    window.setTimeout(() => {
      setToastItems((prev) => prev.filter((item) => item.id !== toastId));
    }, 3600);
  }, []);

  const handleReUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const getRecentActivityStorageKey = (dealerCode = '') => (
    `${RECENT_ACTIVITY_STORAGE_KEY_PREFIX}${String(dealerCode || 'guest').trim() || 'guest'}`
  );
  const logRecentActivity = useCallback((message, dealerCodeOverride = '') => {
    if (!message) return;
    const dealerCode = String(dealerCodeOverride || loggedInUser?.dealerCode || 'guest').trim() || 'guest';
    const nextEntry = {
      id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      message,
      createdAt: new Date().toISOString(),
    };
    setRecentActivities((prev) => {
      const next = [nextEntry, ...prev].slice(0, 8);
      try {
        localStorage.setItem(getRecentActivityStorageKey(dealerCode), JSON.stringify(next));
      } catch {
        void 0;
      }
      return next;
    });
  }, [loggedInUser?.dealerCode]);
  const isPlanExpired = Boolean(
    isLoggedIn &&
    loggedInUser &&
    (String(loggedInUser?.status || '').toLowerCase() === 'expired' || isUserExpired(loggedInUser))
  );

  const isTestUser = String(loggedInUser?.dealerCode || '').trim() === '41099999'
    && String(loggedInUser?.pin || '').trim() === '0000';

  const getPendingDictionaryRequestCount = (user) => (
    Array.isArray(user?.pendingDictionaryRequests)
      ? user.pendingDictionaryRequests.filter((req) => String(req?.status || 'pending').toLowerCase() === 'pending').length
      : 0
  );

  const readFeedbackDataFromStorage = () => {
    try {
      const raw = localStorage.getItem('feedbackData');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const readFeedbackRepliesFromStorage = () => {
    try {
      const raw = localStorage.getItem('feedbackReplies');
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const readFeedbackReplyReadStatusFromStorage = () => {
    try {
      const raw = localStorage.getItem('feedbackRepliesRead');
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const persistFeedbackReplyReadStatus = (nextStatus) => {
    try {
      localStorage.setItem('feedbackRepliesRead', JSON.stringify(nextStatus || {}));
    } catch (error) {
      void error;
    }
  };

  const readApprovalRepliesFromStorage = () => {
    try {
      const raw = localStorage.getItem(APPROVAL_REPLIES_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const getUserContactReplies = () => {
    if (!loggedInUser) return [];
    const feedbackData = readFeedbackDataFromStorage();
    const replyMap = readFeedbackRepliesFromStorage();
    const replyReadStatus = readFeedbackReplyReadStatusFromStorage();
    return feedbackData
      .filter((item) => item.userId === loggedInUser?.id || item.dealerCode === loggedInUser?.dealerCode)
      .map((item) => {
        const idKey = item.id || item.clientFeedbackId || '';
        const reply = replyMap[idKey] || '';
        const read = Boolean(replyReadStatus[idKey]);
        return { ...item, reply, read, replyId: idKey };
      })
      .filter((item) => item.reply);
  };

  const markUserContactRepliesAsRead = () => {
    if (!loggedInUser) return;
    const replies = getUserContactReplies();
    if (replies.length === 0) return;
    const readStatus = readFeedbackReplyReadStatusFromStorage();
    const nextStatus = { ...readStatus };
    replies.forEach((item) => {
      if (item.replyId) nextStatus[item.replyId] = true;
    });
    persistFeedbackReplyReadStatus(nextStatus);
  };

  const contactReplyItems = getUserContactReplies();
  const contactReplyCount = contactReplyItems.filter((item) => !item.read).length;
  const ADMIN_CONTACTS = {
    email: 'deepak.youvi@gmail.com',
    whatsapp: 'https://wa.me/918789358400',
  };

  const userMenuRef = useRef(null);
  const userMenuButtonRef = useRef(null);
  const firstUserMenuActionRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setShowUserMenu(false);
        window.requestAnimationFrame(() => {
          userMenuButtonRef.current?.focus();
        });
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (showUserMenu) {
      firstUserMenuActionRef.current?.focus();
    }
  }, [showUserMenu]);

  useEffect(() => {
    const loadDict = async () => {
      if (!isLoggedIn && !showAdminPanel) return;
      try {
        let nextDictionary = {};
        const docSnap = await getDoc(doc(db, 'settings', 'translationDictionary'));
        if (docSnap.exists()) {
          nextDictionary = docSnap.data() || {};
        }
        try {
          const dictRowsSnap = await getDocs(collection(db, 'translationDictionary'));
          dictRowsSnap.docs.forEach((item) => {
            const data = item.data() || {};
            const englishWord = String(data.englishWord || '').trim();
            const hindiTranslation = String(data.hindiTranslation || '').trim();
            if (englishWord && hindiTranslation) {
              nextDictionary[englishWord] = hindiTranslation;
            }
          });
        } catch {
          // User-document fallback below still lets admin see the request.
        }
        setTranslationDictionary(nextDictionary);
      } catch (err) {
        console.error('Failed to load dictionary', err);
      }
    };
    loadDict();
  }, [isLoggedIn, showAdminPanel]);

  const readUsersData = () => {
    try {
      const raw = localStorage.getItem('usersData');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeUsersData = (users) => {
    localStorage.setItem('usersData', JSON.stringify(users));
  };

  const persistUserSession = (user) => {
    if (!user) return;
    localStorage.setItem(USER_SESSION_STORAGE_KEY, JSON.stringify({
      id: user.id || '',
      dealerCode: user.dealerCode || '',
    }));
  };

  const clearUserSession = () => {
    localStorage.removeItem(USER_SESSION_STORAGE_KEY);
  };

  const updateUserInStore = (userId, updater, dealerCode = '') => {
    if (!userId && !dealerCode) return null;
    const users = readUsersData();
    let idx = users.findIndex((u) => u.id === userId);
    if (idx < 0 && dealerCode) {
      idx = users.findIndex((u) => String(u?.dealerCode || '').trim() === String(dealerCode).trim());
    }
    if (idx < 0) return null;
    const nextUser = updater(users[idx]);
    const nextUsers = [...users];
    nextUsers[idx] = nextUser;
    writeUsersData(nextUsers);
    setLoggedInUser((prev) => {
      if (!prev) return prev;
      if (prev?.id === userId) return nextUser;
      if (dealerCode && String(prev?.dealerCode || '').trim() === String(dealerCode).trim()) return nextUser;
      return prev;
    });
    return nextUser;
  };

  const updateUserInFirebase = async (userId, patch, dealerCode = '') => {
    const payload = { ...patch, updatedAt: serverTimestamp() };

    if (userId) {
      try {
        await updateDoc(doc(db, 'users', userId), payload);
        return userId;
      } catch (e) { void e; }
    }

    if (dealerCode) {
      const snap = await getDocs(query(collection(db, 'users'), where('dealerCode', '==', String(dealerCode).trim())));
      if (!snap.empty) {
        const resolvedId = snap.docs[0].id;
        await updateDoc(doc(db, 'users', resolvedId), payload);
        return resolvedId;
      }
    }

    throw new Error('USER_DOC_NOT_FOUND');
  };

  const submitUpdateApprovalRequest = async ({ type, payload, localKey, successMessage }) => {
    if (!loggedInUser?.id) {
      pushToast('Please login first.', 'error');
      return false;
    }
    if (localKey) {
      localStorage.setItem(localKey, JSON.stringify(payload));
    }
    try {
      const nextApprovalStatus = { ...(loggedInUser.approvalStatus || {}), [type]: 'pending' };
      let approvalSaved = false;

      try {
        const approvalsSnap = await getDocs(query(collection(db, 'updateApprovals'), where('userId', '==', loggedInUser.id)));
        const existingPending = approvalsSnap.docs.find((d) => d.data()?.type === type && d.data()?.status === 'pending');
        if (existingPending) {
          await updateDoc(doc(db, 'updateApprovals', existingPending.id), {
            payload,
            dealerCode: loggedInUser.dealerCode || '',
            dealerName: loggedInUser.dealerName || '',
            status: 'pending',
            updatedAt: serverTimestamp(),
          });
        } else {
          await addDoc(collection(db, 'updateApprovals'), {
            userId: loggedInUser.id,
            dealerCode: loggedInUser.dealerCode || '',
            dealerName: loggedInUser.dealerName || '',
            type,
            payload,
            status: 'pending',
            requestedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        approvalSaved = true;
      } catch (e) { void e; }

    const pendingUpdatePatch = {
      approvalStatus: nextApprovalStatus,
      [`pendingUpdates.${type}`]: {
        status: 'pending',
        payload,
        requestedAt: new Date().toISOString(),
        adminReply: '',
        adminReplyAt: '',
      },
      lastApprovalStorage: approvalSaved ? 'collection' : 'userDoc',
    };
      const resolvedId = await updateUserInFirebase(loggedInUser.id, pendingUpdatePatch, loggedInUser.dealerCode);
      updateUserInStore(
        resolvedId,
        (u) => ({
          ...u,
          approvalStatus: nextApprovalStatus,
          pendingUpdates: {
            ...(u.pendingUpdates || {}),
            [type]: {
              status: 'pending',
              payload,
              requestedAt: new Date().toISOString(),
              adminReply: '',
              adminReplyAt: '',
            },
          },
          id: resolvedId,
        }),
        loggedInUser.dealerCode
      );
      pushToast(successMessage || 'Your request is pending with admin for approval.', 'success');
      return true;
    } catch {
      pushToast('Request submit failed. Check Firebase permissions.', 'error');
      return false;
    }
  };

  const ProfileUpdateForm = ({ onClose }) => {
    const [formData, setFormData] = useState({
      distributorCode: '',
      distributorName: '',
      contact: '',
      email: '',
      gst: '',
      address: '',
      photoDataUrl: '',
    });
    const [errors, setErrors] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    useEffect(() => {
      if (loggedInUser?.profileData) {
        setFormData((prev) => ({ ...prev, ...loggedInUser.profileData }));
      }
    }, []);
    const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      setErrors((prev) => ({ ...prev, [name]: '' }));
    };
    const handlePhotoChange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        pushToast('Please choose an image file.', 'error');
        return;
      }
      if (file.size > 1024 * 1024) {
        pushToast('Profile photo must be under 1 MB.', 'error');
        return;
      }
      try {
        const photoDataUrl = await readImageFileAsDataUrl(file);
        setFormData((prev) => ({ ...prev, photoDataUrl }));
      } catch {
        pushToast('Photo upload failed. Please try another image.', 'error');
      }
    };
    const handlePhotoRemove = () => {
      setFormData((prev) => ({ ...prev, photoDataUrl: '' }));
    };
    const validateProfileForm = () => {
      const nextErrors = {};
      if (!formData.distributorCode.trim()) nextErrors.distributorCode = 'Distributor code is required.';
      if (!formData.distributorName.trim()) nextErrors.distributorName = 'Distributor name is required.';
      if (!/^\d{10}$/.test(formData.contact.trim())) nextErrors.contact = 'Enter a valid 10-digit contact number.';
      if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) nextErrors.email = 'Enter a valid email address.';
      if (!formData.gst.trim()) nextErrors.gst = 'GST is required.';
      if (!formData.address.trim()) nextErrors.address = 'Address is required.';
      setErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    };
    const handleSave = async () => {
      if (!validateProfileForm()) return;
      setIsSaving(true);
      const ok = await submitUpdateApprovalRequest({
        type: 'profile',
        payload: formData,
        localKey: 'profileData',
        successMessage: 'Profile update request submitted. Your request is pending with admin for approval.',
      });
      setIsSaving(false);
      if (ok) {
        logRecentActivity('Submitted profile update request');
        onClose();
      }
    };
    return (
      <div className="placeholder-container">
        <h2>Profile Update</h2>
        <div className="profile-form">
          <span className="profile-label">Profile Photo</span>
          <div className="profile-photo-field">
            {formData.photoDataUrl ? (
              <img className="profile-photo-preview" src={formData.photoDataUrl} alt="Profile preview" />
            ) : (
              <div className="profile-photo-placeholder">No photo selected</div>
            )}
            <div className="profile-photo-actions">
              <input className="form-input" type="file" accept="image/*" onChange={handlePhotoChange} />
              {formData.photoDataUrl && (
                <button type="button" className="profile-photo-remove" onClick={handlePhotoRemove}>Remove Photo</button>
              )}
            </div>
          </div>
          <span className="profile-label">Distributor Code</span>
          <div>
            <input className={`form-input${errors.distributorCode ? ' form-input--error' : ''}`} name="distributorCode" type="text" value={formData.distributorCode} onChange={handleChange} />
            {errors.distributorCode && <div className="form-error">{errors.distributorCode}</div>}
          </div>
          <span className="profile-label">Distributor Name</span>
          <div>
            <input className={`form-input${errors.distributorName ? ' form-input--error' : ''}`} name="distributorName" type="text" value={formData.distributorName} onChange={handleChange} />
            {errors.distributorName && <div className="form-error">{errors.distributorName}</div>}
          </div>
          <span className="profile-label">Contact</span>
          <div>
            <input className={`form-input${errors.contact ? ' form-input--error' : ''}`} name="contact" type="text" value={formData.contact} onChange={handleChange} />
            {errors.contact && <div className="form-error">{errors.contact}</div>}
          </div>
          <span className="profile-label">Email</span>
          <div>
            <input className={`form-input${errors.email ? ' form-input--error' : ''}`} name="email" type="email" value={formData.email} onChange={handleChange} />
            {errors.email && <div className="form-error">{errors.email}</div>}
          </div>
          <span className="profile-label">GST</span>
          <div>
            <input className={`form-input${errors.gst ? ' form-input--error' : ''}`} name="gst" type="text" value={formData.gst} onChange={handleChange} />
            {errors.gst && <div className="form-error">{errors.gst}</div>}
          </div>
          <span className="profile-label">Address</span>
          <div>
            <textarea className={`form-textarea${errors.address ? ' form-input--error' : ''}`} name="address" rows="3" value={formData.address} onChange={handleChange} />
            {errors.address && <div className="form-error">{errors.address}</div>}
          </div>
        </div>
        <div className="form-actions">
          <button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</button>
          <button onClick={onClose} disabled={isSaving}>Close</button>
        </div>
      </div>
    );
  };

  const BankDetailsForm = ({ onClose }) => {
    const defaultBankDetails = {
      bankName: '',
      branch: '',
      accountNo: '',
      ifsc: '',
    };
    const [formData, setFormData] = useState(defaultBankDetails);
    const [errors, setErrors] = useState({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
      if (loggedInUser?.bankDetailsData) {
        setFormData((prev) => ({ ...prev, ...loggedInUser.bankDetailsData }));
      }
    }, []);

    const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      setErrors((prev) => ({ ...prev, [name]: '' }));
    };

    const validateBankForm = () => {
      const nextErrors = {};
      if (!formData.bankName.trim()) nextErrors.bankName = 'Bank name is required.';
      if (!formData.branch.trim()) nextErrors.branch = 'Branch is required.';
      if (!/^\d{8,20}$/.test(formData.accountNo.trim())) nextErrors.accountNo = 'Enter a valid account number.';
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(formData.ifsc.trim())) nextErrors.ifsc = 'Enter a valid IFSC code.';
      setErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    };

    const handleSave = async () => {
      if (!validateBankForm()) return;
      setIsSaving(true);
      const ok = await submitUpdateApprovalRequest({
        type: 'bank',
        payload: formData,
        localKey: 'bankDetailsData',
        successMessage: 'Bank details update request submitted. Your request is pending with admin for approval.',
      });
      setIsSaving(false);
      if (ok) {
        logRecentActivity('Submitted bank details update request');
        onClose();
      }
    };

    return (
      <div className="placeholder-container">
        <h2>Bank Details</h2>
        <div className="profile-form">
          <span className="profile-label">Bank Name</span>
          <div>
            <input className={`form-input${errors.bankName ? ' form-input--error' : ''}`} name="bankName" type="text" value={formData.bankName} onChange={handleChange} />
            {errors.bankName && <div className="form-error">{errors.bankName}</div>}
          </div>
          <span className="profile-label">Branch</span>
          <div>
            <input className={`form-input${errors.branch ? ' form-input--error' : ''}`} name="branch" type="text" value={formData.branch} onChange={handleChange} />
            {errors.branch && <div className="form-error">{errors.branch}</div>}
          </div>
          <span className="profile-label">Account No</span>
          <div>
            <input className={`form-input${errors.accountNo ? ' form-input--error' : ''}`} name="accountNo" type="text" value={formData.accountNo} onChange={handleChange} />
            {errors.accountNo && <div className="form-error">{errors.accountNo}</div>}
          </div>
          <span className="profile-label">IFSC Code</span>
          <div>
            <input className={`form-input${errors.ifsc ? ' form-input--error' : ''}`} name="ifsc" type="text" value={formData.ifsc} onChange={handleChange} />
            {errors.ifsc && <div className="form-error">{errors.ifsc}</div>}
          </div>
        </div>
        <div className="form-actions">
          <button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</button>
          <button onClick={onClose} disabled={isSaving}>Close</button>
        </div>
      </div>
    );
  };

  const HeaderUpdateForm = ({ onClose }) => {
    const [formData, setFormData] = useState({
      distributorName: '',
      address: '',
      email: '',
      gstn: '',
      telephone: '',
    });
    const [errors, setErrors] = useState({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
      if (loggedInUser?.hindiHeaderData) {
        setFormData((prev) => ({ ...prev, ...loggedInUser.hindiHeaderData }));
      }
    }, []);

    const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      setErrors((prev) => ({ ...prev, [name]: '' }));
    };

    const validateHeaderForm = () => {
      const nextErrors = {};
      if (!formData.distributorName.trim()) nextErrors.distributorName = 'Distributor name is required.';
      if (!formData.address.trim()) nextErrors.address = 'Address is required.';
      if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) nextErrors.email = 'Enter a valid email address.';
      if (!formData.gstn.trim()) nextErrors.gstn = 'GSTN is required.';
      if (!/^\d{10}$/.test(formData.telephone.trim())) nextErrors.telephone = 'Enter a valid 10-digit telephone number.';
      setErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    };

    const handleSave = async () => {
      if (!validateHeaderForm()) return;
      setIsSaving(true);
      const ok = await submitUpdateApprovalRequest({
        type: 'header',
        payload: formData,
        localKey: 'hindiHeaderData',
        successMessage: 'Header details update request submitted. Your request is pending with admin for approval.',
      });
      setIsSaving(false);
      if (ok) {
        logRecentActivity('Submitted header update request');
        onClose();
      }
    };

    return (
      <div className="placeholder-container">
        <h2>Header Update (Hindi / Local)</h2>
        <div className="profile-form">
          <span className="profile-label">Distributor Name</span>
          <div>
            <input className={`form-input${errors.distributorName ? ' form-input--error' : ''}`} name="distributorName" type="text" value={formData.distributorName} onChange={handleChange} placeholder="उदा: MAHADEV HP GAS..." />
            {errors.distributorName && <div className="form-error">{errors.distributorName}</div>}
          </div>
          <span className="profile-label">Address</span>
          <div>
            <textarea className={`form-textarea${errors.address ? ' form-input--error' : ''}`} name="address" rows="3" value={formData.address} onChange={handleChange} placeholder="उदा: ATHARI, RUNNISAIDPUR..." />
            {errors.address && <div className="form-error">{errors.address}</div>}
          </div>
          <span className="profile-label">Email</span>
          <div>
            <input className={`form-input${errors.email ? ' form-input--error' : ''}`} name="email" type="text" value={formData.email} onChange={handleChange} placeholder="उदा: mahadev.sitamarhi@gmail.com" />
            {errors.email && <div className="form-error">{errors.email}</div>}
          </div>
          <span className="profile-label">GSTN</span>
          <div>
            <input className={`form-input${errors.gstn ? ' form-input--error' : ''}`} name="gstn" type="text" value={formData.gstn} onChange={handleChange} placeholder="उदा: 10ABBFM6137E1ZU" />
            {errors.gstn && <div className="form-error">{errors.gstn}</div>}
          </div>
          <span className="profile-label">Telephone</span>
          <div>
            <input className={`form-input${errors.telephone ? ' form-input--error' : ''}`} name="telephone" type="text" value={formData.telephone} onChange={handleChange} placeholder="उदा: 7070236555" />
            {errors.telephone && <div className="form-error">{errors.telephone}</div>}
          </div>
        </div>
        <div className="form-actions">
          <button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</button>
          <button onClick={onClose} disabled={isSaving}>Close</button>
        </div>
      </div>
    );
  };

  // Placeholder Component for Rate Update
  // const RateUpdatePlaceholder = () => (
  //   <div className="placeholder-container">
  //     <h2>Rate Update Section</h2>
  //     <p>This is where the rate update functionality will be implemented.</p>
  //     <button onClick={() => setShowRateUpdate(false)}>Close</button>
  //   </div>
  // );

  const handleLogin = () => {
    hideAllViews();
    setShowUserLogin(true);
    setShowUserMenu(false);
  };

  const handleUserLoginSubmit = async () => {
    const dealerCode = userDealerCode.trim();
    const pin = userPin.trim();
    if (!dealerCode || !pin) {
      pushToast('Dealer Code aur PIN required hai.', 'error');
      return;
    }

    setIsUserLoginSubmitting(true);
    let firestoreUser = null;
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('dealerCode', '==', dealerCode));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docData = snap.docs[0].data();
        const status = String(docData?.status || 'active').toLowerCase();
        if (String(docData?.pin || '') === pin) {
          firestoreUser = {
            id: snap.docs[0].id,
            dealerCode: docData.dealerCode || dealerCode,
            dealerName: docData.dealerName || '',
            mobile: docData.mobile || '',
            email: docData.email || '',
            package: docData.package || '',
            packageDays: docData.packageDays || 0,
            validFrom: docData.validFrom || '',
            validTill: docData.validTill || '',
            pin: docData.pin || '',
            role: docData.role || 'operator',
            status: docData.status || 'active',
            approvalStatus: docData.approvalStatus || {},
            pendingUpdates: docData.pendingUpdates || {},
            dictionaryPendingCount: Number(docData.dictionaryPendingCount || 0),
            profileData: docData.profileData || null,
            bankDetailsData: docData.bankDetailsData || null,
            ratesData: Array.isArray(docData.ratesData) ? docData.ratesData : [],
            cashMemoLabelSettings: mergeCashMemoLabelSettings(docData.cashMemoLabelSettings || {}),
          };
          if (status !== 'active') {
            firestoreUser.status = status;
          }
        }
      }
    } catch {
      pushToast('Firebase login check failed. Please try again.', 'error');
      setIsUserLoginSubmitting(false);
      return;
    }

    if (!firestoreUser) {
      pushToast('Invalid Dealer Code / PIN ya account disabled hai.', 'error');
      setIsUserLoginSubmitting(false);
      return;
    }

    if (firestoreUser.status === 'pending') {
      pushToast('Your registration is pending with admin approval.', 'info');
      setIsUserLoginSubmitting(false);
      return;
    }

    if (firestoreUser.status === 'disabled') {
      pushToast('Your account is disabled. Please contact admin.', 'error');
      setIsUserLoginSubmitting(false);
      return;
    }

    if (isUserExpired(firestoreUser)) {
      try {
        await updateDoc(doc(db, 'users', firestoreUser.id), {
          status: 'expired',
          updatedAt: serverTimestamp(),
        });
      } catch (e) { void e; }
      firestoreUser.status = 'expired';
    }

    let users = readUsersData();
    const existingIdx = users.findIndex((u) => String(u?.dealerCode || '').trim() === dealerCode);
    const localUser = existingIdx >= 0
      ? { ...users[existingIdx], ...firestoreUser, id: firestoreUser.id }
      : {
        ...firestoreUser,
        id: firestoreUser.id,
        createdAt: new Date().toISOString(),
      };
    if (existingIdx >= 0) {
      users[existingIdx] = localUser;
    } else {
      users = [...users, localUser];
    }
    writeUsersData(users);

    let cachedLabelSettings = {};
    try {
      cachedLabelSettings = JSON.parse(localStorage.getItem(getCashMemoLabelSettingsStorageKey(firestoreUser.dealerCode)) || '{}');
    } catch {
      cachedLabelSettings = {};
    }
    const userLabelSettings = mergeCashMemoLabelSettings(firestoreUser.cashMemoLabelSettings || cachedLabelSettings);
    localUser.cashMemoLabelSettings = userLabelSettings;
    const syncedUsers = readUsersData().map((user) => (
      user.id === localUser.id ? { ...user, cashMemoLabelSettings: userLabelSettings } : user
    ));
    writeUsersData(syncedUsers);
    localStorage.setItem(getCashMemoLabelSettingsStorageKey(firestoreUser.dealerCode), JSON.stringify(userLabelSettings));
    setCashMemoLabelSettings(userLabelSettings);
    setLabelDraftSettings(mergeCashMemoLabelSettings(userLabelSettings));
    setLoggedInUser(localUser);
    setIsLoggedIn(true);
    setSampleDataLoaded(false);
    setSampleDataLoading(false);
    setSampleDataAttempted(false);
    persistUserSession(localUser);
    setShowUserLogin(false);
    setShowAboutInfo(true);
    setUserDealerCode('');
    setUserPin('');
    setUserPinVisible(false);
    if (String(localUser.status || '').toLowerCase() === 'expired') {
      const replyMap = readApprovalRepliesFromStorage();
      const pendingPlanUpgrade = localUser?.pendingUpdates?.planUpgrade || {};
      const storedReplyKey = getPlanUpgradeReplyStorageKey({
        userId: localUser?.id,
        dealerCode: localUser?.dealerCode,
        dealerName: localUser?.dealerName,
      });
      const latestReply = String(
        pendingPlanUpgrade?.adminReply
        || replyMap[storedReplyKey]
        || ''
      ).trim();
      if (latestReply) {
        setAdminFlashMessage({
          message: latestReply,
          approvalId: storedReplyKey,
        });
      } else {
        setAdminFlashMessage(null);
      }
      pushToast('Logged in successfully. Plan expired, please contact admin or renew plan.', 'info');
    } else {
      setAdminFlashMessage(null);
      pushToast('Logged in successfully!', 'success');
    }
    logRecentActivity('Logged in successfully', localUser?.dealerCode);
    setIsUserLoginSubmitting(false);
  };

  const handleLogout = () => {
    hideAllViews();
    clearUserSession();
    setIsLoggedIn(false);
    setShowUserMenu(false);
    setLoggedInUser(null);
    setSampleDataLoaded(false);
    setSampleDataLoading(false);
    setSampleDataAttempted(false);
    setShowAboutInfo(true);
    pushToast('Logged out successfully!', 'success');
    logRecentActivity('Logged out');
  };

  const handleLogoutWithConfirm = () => {
    if (!window.confirm('Are you sure you want to log out from this account?')) return;
    handleLogout();
  };

  const hideAllViews = () => {
    setShowHomeInfo(false);
    setShowAboutInfo(false);
    setShowInvoicePage(false);
    setShowLabelUpdate(false);
    setShowHeaderUpdate(false);
    setShowUpgradePlan(false);
    setShowDictionaryForm(false);
    setShowContactForm(false);
    setShowUserProfile(false);
    setShowRegisterForm(false);
    setShowProfileUpdate(false);
    setShowRateUpdate(false);
    setShowBankDetails(false);
    setShowParsedData(false);
    setShowAdminPanel(false);
    setShowAdminLogin(false);
    setShowUserLogin(false);
  };

  const navigateToHome = () => {
    hideAllViews();
    setShowHomeInfo(true);
    setShowUserMenu(false);
  };

  const handleProfileUpdate = () => {
    hideAllViews();
    setShowProfileUpdate(true);
    setShowUserMenu(false);
  };

  const handleRateUpdate = () => {
    hideAllViews();
    setShowRateUpdate(true);
    setShowUserMenu(false);
  };
  const handleLabelUpdate = () => {
    hideAllViews();
    setLabelDraftSettings(mergeCashMemoLabelSettings(cashMemoLabelSettings));
    setShowLabelUpdate(true);
    setShowUserMenu(false);
  };
  const handleHeaderUpdate = () => {
    hideAllViews();
    setShowHeaderUpdate(true);
    setShowUserMenu(false);
  };
  const handleBankDetails = () => {
    hideAllViews();
    setShowBankDetails(true);
    setShowUserMenu(false);
  };
  const handleRegister = () => {
    hideAllViews();
    setShowRegisterForm(true);
    setShowUserMenu(false);
  };
  const handleUserProfile = () => {
    hideAllViews();
    setUserProfileInitialSection('overview');
    setShowUserProfile(true);
    setShowUserMenu(false);
  };

  const handleRequestHistoryOpen = () => {
    hideAllViews();
    setUserProfileInitialSection('history');
    setShowUserProfile(true);
    setShowUserMenu(false);
  };

  const handleShowData = () => {
    if (!showParsedData) {
      hideAllViews();
      setShowParsedData(true);
    } else {
      navigateToHome();
    }
  };

  useEffect(() => {
    try {
      const rawSession = localStorage.getItem(USER_SESSION_STORAGE_KEY);
      if (!rawSession) return;

      const session = JSON.parse(rawSession);
      const users = readUsersData();
      const matchedUser = users.find((user) =>
        (session?.id && user?.id === session.id) ||
        (session?.dealerCode && String(user?.dealerCode || '').trim() === String(session.dealerCode).trim())
      );

      if (!matchedUser) {
        clearUserSession();
        return;
      }

      const restoredUser = {
        ...matchedUser,
        status: isUserExpired(matchedUser) ? 'expired' : matchedUser.status,
        cashMemoLabelSettings: mergeCashMemoLabelSettings(matchedUser.cashMemoLabelSettings || {}),
      };

      setLoggedInUser(restoredUser);
      setCashMemoLabelSettings(restoredUser.cashMemoLabelSettings);
      setLabelDraftSettings(mergeCashMemoLabelSettings(restoredUser.cashMemoLabelSettings));
      setIsLoggedIn(true);
      setShowAboutInfo(false);
      setShowHomeInfo(true);
    } catch {
      clearUserSession();
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      let text = '';
      const userName = loggedInUser?.dealerName || '';
      const userCode = loggedInUser?.dealerCode || '';
      if (userName || userCode) {
        text = userName && userCode ? `${userName} (${userCode})` : (userName || userCode);
      }
      setDealerWelcome(text || '');
    } else {
      setDealerWelcome('');
    }
  }, [isLoggedIn, showProfileUpdate, loggedInUser]);

  const handleHomeOpen = () => {
    navigateToHome();
  };

  const handleAboutOpen = () => {
    hideAllViews();
    setShowAboutInfo(true);
    setShowUserMenu(false);
  };

  const handleInvoiceOpen = () => {
    hideAllViews();
    setShowInvoicePage(true);
    setShowUserMenu(false);
  };

  const handleContactOpen = () => {
    hideAllViews();
    markUserContactRepliesAsRead();
    setShowContactForm(true);
    setShowUserMenu(false);
  };

  const handleDictionaryOpen = () => {
    hideAllViews();
    setDictionaryFormMode('default');
    setShowDictionaryForm(true);
    setShowUserMenu(false);
  };

  const handleDeliveryAreaUpdate = () => {
    hideAllViews();
    setDictionaryFormMode('deliveryArea');
    setShowDictionaryForm(true);
    setShowUserMenu(false);
  };

  const handleDeliveryStaffUpdate = () => {
    hideAllViews();
    setDictionaryFormMode('deliveryStaff');
    setShowDictionaryForm(true);
    setShowUserMenu(false);
  };

  const handleUpgradePlanOpen = () => {
    hideAllViews();
    setShowUpgradePlan(true);
    setShowUserMenu(false);
  };

  const handleAdminLoginOpen = () => {
    hideAllViews();
    setShowAdminLogin(true);
    setShowUserMenu(false);
  };

  const handleAdminLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) { void e; }
    hideAllViews();
    setShowAboutInfo(true);
    setAdminLoginId('');
    setAdminPassword('');
    pushToast('Admin logged out successfully!', 'success');
  };

  const handleAdminLoginSubmit = async () => {
    const loginId = adminLoginId.trim().toLowerCase();
    const password = adminPassword.trim();
    if (!loginId || !password) {
      pushToast('Admin Email and Password required.', 'error');
      return;
    }
    setIsAdminLoginSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, loginId, password);
      setShowAdminLogin(false);
      setShowAdminPanel(true);
      setAdminLoginId('');
      setAdminPassword('');
      pushToast('Admin login successful.', 'success');
    } catch {
      pushToast('Admin login failed. Check Firebase Authentication credentials.', 'error');
    }
    setIsAdminLoginSubmitting(false);
  };

  const RegisterForm = ({ onClose }) => {
    const [form, setForm] = useState({
      package: '',
      dealerCode: '',
      dealerName: '',
      mobile: '',
      email: '',
      pin: '',
      confirmPin: '',
      utr: '',
      date: '',
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fixedPackages = PACKAGE_OPTIONS;
    const onChange = (e) => {
      const { name, value } = e.target;
      setForm(prev => ({ ...prev, [name]: value }));
      setErrors((prev) => ({ ...prev, [name]: '' }));
    };
    const validateRegisterForm = () => {
      const nextErrors = {};
      if (!form.package) nextErrors.package = 'Please select a package.';
      if (!form.dealerCode.trim()) nextErrors.dealerCode = 'Dealer code is required.';
      if (!form.dealerName.trim()) nextErrors.dealerName = 'Dealer name is required.';
      if (!/^\d{10}$/.test(form.mobile.trim())) nextErrors.mobile = 'Enter a valid 10-digit mobile number.';
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) nextErrors.email = 'Enter a valid email address.';
      if (!/^\d{4}$/.test(form.pin.trim())) nextErrors.pin = 'PIN must be exactly 4 digits.';
      if (form.pin !== form.confirmPin) nextErrors.confirmPin = 'PIN aur Confirm PIN match nahi kar rahe.';
      setErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    };
    const onSubmit = async () => {
      if (!validateRegisterForm()) return;
      setIsSubmitting(true);
      const request = {
        id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        package: form.package,
        dealerCode: form.dealerCode,
        dealerName: form.dealerName,
        mobile: form.mobile,
        email: form.email,
        pin: form.pin,
        utr: form.utr,
        date: form.date,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      let requestRef = null;
      try {
        const usersRef = collection(db, 'users');
        const existingQuery = query(usersRef, where('dealerCode', '==', form.dealerCode.trim()));
        const existing = await getDocs(existingQuery);
        if (!existing.empty) {
          pushToast('You already have a registered account. If you forgot your PIN, contact admin.', 'info');
          setIsSubmitting(false);
          return;
        }

        requestRef = await addDoc(collection(db, 'registrationRequests'), {
          ...request,
          createdAt: serverTimestamp(),
        });

        const validity = computeValidityDates(form.package);
        await addDoc(usersRef, {
          dealerCode: form.dealerCode.trim(),
          dealerName: form.dealerName.trim(),
          mobile: form.mobile.trim(),
          email: form.email.trim(),
          pin: form.pin.trim(),
          package: form.package,
          packageDays: validity.packageDays,
          validFrom: validity.validFrom,
          validTill: validity.validTill,
          role: 'operator',
          status: 'pending',
          createdAt: serverTimestamp(),
        });
      } catch {
        pushToast('Registration save to Firebase failed. Check Firebase config.', 'error');
        setIsSubmitting(false);
        return;
      }
      const requestToStore = { ...request, id: requestRef.id };
      try {
        const existing = localStorage.getItem('registrationRequests');
        const arr = existing ? JSON.parse(existing) : [];
        const next = Array.isArray(arr) ? arr : [];
        next.push(requestToStore);
        localStorage.setItem('registrationRequests', JSON.stringify(next));
      } catch {
        localStorage.setItem('registrationRequests', JSON.stringify([requestToStore]));
      }
      localStorage.setItem('registrationData', JSON.stringify(form));
      pushToast('Registration request submitted!', 'success');
      logRecentActivity('Submitted registration request', form.dealerCode);
      setIsSubmitting(false);
      onClose();
    };
    return (
      <div className="placeholder-container">
        <h2 className="register-title">रजिस्टर करें</h2>
        <div className="register-form">
          <div>
            <select name="package" value={form.package} onChange={onChange} className={`form-input${errors.package ? ' form-input--error' : ''}`}>
            <option value="">पैकेज चुनें</option>
            {fixedPackages.map((opt, i) => (
              <option key={i} value={opt}>{`${opt} - ${PACKAGE_PRICING[opt] || '-'}`}</option>
            ))}
            </select>
            {errors.package && <div className="form-error">{errors.package}</div>}
          </div>
          <div>
            <input name="dealerCode" className={`form-input${errors.dealerCode ? ' form-input--error' : ''}`} placeholder="डीलर कोड (8-अंक)" value={form.dealerCode} onChange={onChange} maxLength={8} />
            {errors.dealerCode && <div className="form-error">{errors.dealerCode}</div>}
          </div>
          <div>
            <input name="dealerName" className={`form-input${errors.dealerName ? ' form-input--error' : ''}`} placeholder="डीलर का नाम" value={form.dealerName} onChange={onChange} />
            {errors.dealerName && <div className="form-error">{errors.dealerName}</div>}
          </div>
          <div>
            <input name="mobile" className={`form-input${errors.mobile ? ' form-input--error' : ''}`} placeholder="मोबाइल नंबर (10-अंक)" value={form.mobile} onChange={onChange} maxLength={10} />
            {errors.mobile && <div className="form-error">{errors.mobile}</div>}
          </div>
          <div>
            <input name="email" className={`form-input${errors.email ? ' form-input--error' : ''}`} placeholder="ईमेल आईडी" type="email" value={form.email} onChange={onChange} />
            {errors.email && <div className="form-error">{errors.email}</div>}
          </div>
          <div>
            <input name="pin" className={`form-input${errors.pin ? ' form-input--error' : ''}`} placeholder="पिन (4-अंक)" type="password" value={form.pin} onChange={onChange} maxLength={4} />
            {errors.pin && <div className="form-error">{errors.pin}</div>}
          </div>
          <div>
            <input name="confirmPin" className={`form-input${errors.confirmPin ? ' form-input--error' : ''}`} placeholder="पिन की पुष्टि करें" type="password" value={form.confirmPin} onChange={onChange} maxLength={4} />
            {errors.confirmPin && <div className="form-error">{errors.confirmPin}</div>}
          </div>
          <input name="utr" className="form-input" placeholder="UTR नंबर" value={form.utr} onChange={onChange} />
          <input name="date" className="form-input" placeholder="तिथि चुनें" type="date" value={form.date} onChange={onChange} />
          <div className="upi-note">UPI ID for Payment: {PAYMENT_UPI_ID}</div>
        </div>
        <div className="form-actions">
          <button onClick={onSubmit} disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'रजिस्टर करें'}</button>
          <button onClick={onClose} disabled={isSubmitting}>Close</button>
        </div>
      </div>
    );
  };

  const UserProfile = ({ onClose, initialSection = 'overview' }) => {
    const [data, setData] = useState(null);
    useEffect(() => {
      if (loggedInUser?.profileData) {
        setData(loggedInUser.profileData);
      } else {
        setData(null);
      }
    }, [loggedInUser]);

    const currentPackage = loggedInUser?.package || '-';
    const validity = loggedInUser?.validTill ? formatDisplayDate(loggedInUser.validTill) : '-';
    const profilePhotoDataUrl = data?.photoDataUrl || '';
    const summaryItems = [
      { label: 'Distributor Name', value: loggedInUser?.profileData?.distributorName || '-' },
      { label: 'Bank Details', value: loggedInUser?.bankDetailsData?.bankName ? 'Available' : 'Missing' },
      { label: 'Header', value: loggedInUser?.hindiHeaderData?.distributorName ? 'Available' : 'Missing' },
      { label: 'Rates', value: Array.isArray(loggedInUser?.ratesData) && loggedInUser.ratesData.length > 0 ? `${loggedInUser.ratesData.length} rows` : 'Missing' },
    ];
    const requestHistoryRows = Object.entries(loggedInUser?.pendingUpdates || {})
      .map(([type, info]) => {
        const normalizedType = normalizePendingTypeLabel(type);
        const status = String(info?.status || loggedInUser?.approvalStatus?.[type] || '').toLowerCase() || 'draft';
        const mostRecentAt = info?.approvedAt || info?.rejectedAt || info?.adminReplyAt || info?.requestedAt || '';
        return {
          type: normalizedType,
          status,
          requestedAt: info?.requestedAt || '',
          lastUpdatedAt: mostRecentAt,
          adminReply: String(info?.adminReply || '').trim(),
        };
      })
      .sort((a, b) => new Date(b.lastUpdatedAt || b.requestedAt || 0).getTime() - new Date(a.lastUpdatedAt || a.requestedAt || 0).getTime());

    useEffect(() => {
      if (initialSection !== 'history') return;
      const historyBlock = document.getElementById('user-request-history');
      historyBlock?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [initialSection]);

    return (
      <div className="placeholder-container">
        <h2>User Profile</h2>
        {profilePhotoDataUrl && (
          <div className="user-profile-photo-wrap">
            <img className="user-profile-photo" src={profilePhotoDataUrl} alt="User profile" />
          </div>
        )}
        <div className="home-account-grid user-profile-summary-grid">
          {summaryItems.map((item) => (
            <div key={item.label} className="home-account-item">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
        <div className="profile-form">
          <span className="profile-label">Current Package</span>
          <span>{currentPackage}</span>
          <span className="profile-label">Package Validity</span>
          <span>{validity}</span>
          {data && (
            <>
              <span className="profile-label">Distributor Code</span>
              <span>{data.distributorCode || '-'}</span>
              <span className="profile-label">Distributor Name</span>
              <span>{data.distributorName || '-'}</span>
              <span className="profile-label">Contact</span>
              <span>{data.contact || '-'}</span>
              <span className="profile-label">Email</span>
              <span>{data.email || '-'}</span>
              <span className="profile-label">GST</span>
              <span>{data.gst || '-'}</span>
              <span className="profile-label">Address</span>
              <span>{data.address || '-'}</span>
            </>
          )}
        </div>
        {!data && (
          <div style={{ marginTop: '15px' }}>No additional profile details found. Please update your profile.</div>
        )}
        <div id="user-request-history" className="user-profile-history">
          <h3>Request History</h3>
          {requestHistoryRows.length === 0 ? (
            <div className="user-profile-history-empty">No update requests submitted yet.</div>
          ) : (
            <div className="user-profile-history-list">
              {requestHistoryRows.map((item) => (
                <div key={`${item.type}-${item.requestedAt}-${item.lastUpdatedAt}`} className="user-profile-history-item">
                  <strong>{item.type}</strong>
                  <span>Status: {item.status || '-'}</span>
                  <span>Requested: {formatDisplayDate(item.requestedAt) || '-'}</span>
                  <span>Last Update: {formatDisplayDate(item.lastUpdatedAt) || '-'}</span>
                  {item.adminReply && <span>Admin Reply: {item.adminReply}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="form-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  };

  const ContactForm = ({ onClose }) => {
    const [form, setForm] = useState({
      name: '',
      mobile: '',
      email: '',
      feedback: '',
    });
    const [showAdminChatPopup, setShowAdminChatPopup] = useState(false);
    const [activeReplyItem, setActiveReplyItem] = useState(null);
    const [adminReplyMessage, setAdminReplyMessage] = useState('');
    const [localFeedbackEntries, setLocalFeedbackEntries] = useState(() => readFeedbackDataFromStorage());

    useEffect(() => {
      setForm((prev) => ({
        ...prev,
        name: loggedInUser?.dealerName || '',
        mobile: loggedInUser?.mobile || '',
        email: loggedInUser?.email || '',
      }));
    }, []);

    const storedFeedbackReplies = readFeedbackRepliesFromStorage();
    const userReplies = useMemo(() => loggedInUser
      ? localFeedbackEntries
          .filter((item) => item.userId === loggedInUser?.id || item.dealerCode === loggedInUser?.dealerCode)
          .map((item) => {
            const idKey = item.id || item.clientFeedbackId || '';
            return { ...item, reply: storedFeedbackReplies[idKey] || '', replyId: idKey };
          })
          .filter((item) => item.reply)
      : [], [localFeedbackEntries, storedFeedbackReplies]);

    useEffect(() => {
      if (!showAdminChatPopup) return;
      if (userReplies.length > 0) {
        setActiveReplyItem((prev) => prev || userReplies[0]);
      }
    }, [showAdminChatPopup, userReplies]);

    const handleOpenAdminChat = () => {
      setShowAdminChatPopup(true);
    };

    const handleCloseAdminChat = () => {
      setShowAdminChatPopup(false);
      setAdminReplyMessage('');
    };

    const submitAdminChatReply = async () => {
      if (!adminReplyMessage.trim()) {
        alert('Please type your message before sending.');
        return;
      }
      if (!loggedInUser && (!form.name.trim() || !form.mobile.trim())) {
        alert('Name and mobile number are required to send a chat message.');
        return;
      }
      const key = 'feedbackData';
      const feedbackEntry = {
        clientFeedbackId: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId: loggedInUser?.id || '',
        name: loggedInUser?.dealerName || form.name.trim() || '',
        mobile: loggedInUser?.mobile || form.mobile.trim() || '',
        dealerCode: loggedInUser?.dealerCode || '',
        dealerName: loggedInUser?.dealerName || form.name.trim() || '',
        email: loggedInUser?.email || form.email.trim() || '',
        text: adminReplyMessage.trim(),
        parentFeedbackId: activeReplyItem?.id || activeReplyItem?.clientFeedbackId || '',
        read: false,
        createdAt: new Date().toISOString(),
      };
      let anySaved = false;
      try {
        await addDoc(collection(db, 'feedback'), {
          ...feedbackEntry,
          createdAt: serverTimestamp(),
        });
        anySaved = true;
      } catch (e) { void e; }
      if (loggedInUser?.id) {
        try {
          const resolvedId = await updateUserInFirebase(loggedInUser.id, { feedbackEntries: arrayUnion(feedbackEntry) }, loggedInUser.dealerCode);
          updateUserInStore(
            resolvedId,
            (u) => ({ ...u, feedbackEntries: [...(Array.isArray(u?.feedbackEntries) ? u.feedbackEntries : []), feedbackEntry] }),
            loggedInUser.dealerCode
          );
          anySaved = true;
        } catch (e) { void e; }
      }
      try {
        const existing = localStorage.getItem(key);
        const arr = existing ? JSON.parse(existing) : [];
        const next = Array.isArray(arr) ? arr : [];
        next.push({ ...feedbackEntry, source: 'local' });
        localStorage.setItem(key, JSON.stringify(next));
        setLocalFeedbackEntries(next);
        anySaved = true;
      } catch (e) { void e; }

      if (anySaved) {
        alert('Your chat message has been sent. Admin will reply shortly.');
        setAdminReplyMessage('');
      } else {
        alert('Unable to send your chat message. Please try again.');
      }
    };

    const handleChange = (e) => {
      const { name, value } = e.target;
      setForm((prev) => ({ ...prev, [name]: value }));
    };

    const submitFeedback = async () => {
      if (!form.name.trim() || !form.mobile.trim() || !form.email.trim() || !form.feedback.trim()) {
        alert('Name, Mobile, Email and Feedback are required.');
        return;
      }
      const key = 'feedbackData';
      const feedbackEntry = {
        clientFeedbackId: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId: loggedInUser?.id || '',
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        dealerCode: loggedInUser?.dealerCode || '',
        dealerName: loggedInUser?.dealerName || form.name.trim(),
        email: form.email.trim(),
        text: form.feedback.trim(),
        read: false,
        createdAt: new Date().toISOString(),
      };
      let anySaved = false;
      try {
        await addDoc(collection(db, 'feedback'), {
          ...feedbackEntry,
          createdAt: serverTimestamp(),
        });
        anySaved = true;
      } catch (e) { void e; }
      if (loggedInUser?.id) {
        try {
          const resolvedId = await updateUserInFirebase(loggedInUser.id, { feedbackEntries: arrayUnion(feedbackEntry) }, loggedInUser.dealerCode);
          updateUserInStore(
            resolvedId,
            (u) => ({ ...u, feedbackEntries: [...(Array.isArray(u?.feedbackEntries) ? u.feedbackEntries : []), feedbackEntry] }),
            loggedInUser.dealerCode
          );
          anySaved = true;
        } catch (e) { void e; }
      }
      try {
        const existing = localStorage.getItem(key);
        const arr = existing ? JSON.parse(existing) : [];
        const next = Array.isArray(arr) ? arr : [];
        next.push({ ...feedbackEntry, source: 'local' });
        localStorage.setItem(key, JSON.stringify(next));
        anySaved = true;
      } catch (error) {
        void error;
      }

      if (anySaved) {
        alert('Feedback submitted. Thank you!');
        onClose();
      } else {
        alert('Unable to save feedback.');
      }
    };
    return (
      <div className="placeholder-container">
        <h2>Contact Us</h2>
        <div className="contact-us-links">
          <a className="contact-us-link" href="mailto:deepak.youvi@gmail.com" aria-label="Email Us">
            <span className="contact-us-icon">📧</span> Email Us
          </a>
          <a className="contact-us-link" href="https://wa.me/918789358400" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp Us">
            <span className="contact-us-icon">💬</span> WhatsApp Us
          </a>
          {loggedInUser && (
            <button type="button" className="contact-us-link" onClick={handleOpenAdminChat}>
              <span className="contact-us-icon">💬</span> Open Admin Replies Chat
            </button>
          )}
        </div>
        {showAdminChatPopup && (
          <div className="admin-chat-popup-overlay" role="dialog" aria-modal="true">
            <div className="admin-chat-popup">
              <div className="admin-chat-popup-header">
                <h3>Admin Chat</h3>
                <button type="button" className="admin-chat-popup-close" onClick={handleCloseAdminChat}>Close</button>
              </div>
              <div className="admin-chat-popup-body">
                <div className="admin-chat-sidebar">
                  <h4>Conversations</h4>
                  {userReplies.length === 0 ? (
                    <p>No admin replies yet. Send a message below to start chat with admin.</p>
                  ) : (
                    <ul className="admin-chat-thread-list">
                      {userReplies.map((replyItem) => (
                        <li key={replyItem.id || replyItem.clientFeedbackId || `${replyItem.dealerCode}-${Math.random()}`}>
                          <button
                            type="button"
                            className={`admin-chat-thread-button ${activeReplyItem?.replyId === replyItem.replyId ? 'active' : ''}`}
                            onClick={() => setActiveReplyItem(replyItem)}
                          >
                            <strong>{replyItem.text?.slice(0, 40) || 'Your feedback'}</strong>
                            <small>{(replyItem.reply || '').slice(0, 40)}</small>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="admin-chat-content">
                  {activeReplyItem ? (
                    <>
                      <div className="admin-chat-conversation">
                        <div className="admin-chat-message user-message">
                          <strong>You:</strong>
                          <p>{activeReplyItem.text || activeReplyItem.feedback || 'No message content.'}</p>
                        </div>
                        <div className="admin-chat-message admin-message">
                          <strong>Admin:</strong>
                          <p>{activeReplyItem.reply}</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="admin-chat-empty">
                      <p>Select a reply thread or type a new message below to chat with admin.</p>
                    </div>
                  )}
                  <textarea
                    className="form-input"
                    rows="4"
                    value={adminReplyMessage}
                    onChange={(e) => setAdminReplyMessage(e.target.value)}
                    placeholder="Type your message to admin here..."
                  />
                  <div className="admin-chat-actions">
                    <button type="button" className="form-button" onClick={submitAdminChatReply}>Send</button>
                    <button type="button" className="form-button secondary" onClick={handleCloseAdminChat}>Close</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="profile-form">
          <span className="profile-label">Name</span>
          <input
            className="form-input"
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            placeholder="Enter your name"
          />
          <span className="profile-label">Mobile</span>
          <input
            className="form-input"
            name="mobile"
            type="text"
            value={form.mobile}
            onChange={handleChange}
            placeholder="Enter mobile number"
          />
          <span className="profile-label">Email</span>
          <input
            className="form-input"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Enter email"
          />
          <span className="profile-label">Feedback</span>
          <textarea
            className="form-textarea"
            name="feedback"
            rows="5"
            value={form.feedback}
            onChange={handleChange}
            placeholder="Kindly provide your feedback or Suggestion here"
          />
        </div>
        <div className="form-actions">
          <button onClick={submitFeedback}>Submit</button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  };

  const DictionaryRequestForm = ({ mode = 'default', onClose }) => {
    const [form, setForm] = useState({ englishWord: '', hindiTranslation: '' });
    const [entries, setEntries] = useState([{ englishWord: '', hindiTranslation: '' }]);
    const pendingCount = getPendingDictionaryRequestCount(loggedInUser);
    const isDeliveryAreaMode = mode === 'deliveryArea';
    const isDeliveryStaffMode = mode === 'deliveryStaff';
    const title = isDeliveryAreaMode ? 'Delivery Area Update' : isDeliveryStaffMode ? 'Delivery Staff Update' : 'Dictionary';
    const englishPlaceholder = isDeliveryAreaMode ? 'e.g. Khera Bazar' : isDeliveryStaffMode ? 'e.g. Rajesh' : 'e.g. Mr.';
    const hindiPlaceholder = isDeliveryAreaMode ? 'उदा: खेरा बाजार' : isDeliveryStaffMode ? 'उदा: राजेश' : 'उदाहरण: श्री';
    const [showApprovedList, setShowApprovedList] = useState(false);
    const approvedItems = isDeliveryAreaMode ? deliveryAreaUpdates : isDeliveryStaffMode ? deliveryStaffUpdates : [];
    const approvedListTitle = isDeliveryAreaMode ? 'Approved Delivery Areas' : 'Approved Delivery Staff';

    const editApprovedItem = (item) => {
      setEntries([{ englishWord: item.englishWord || item.english || '', hindiTranslation: item.hindiTranslation || item.hindi || '' }]);
      setShowApprovedList(false);
    };

    useEffect(() => {
      if (isDeliveryAreaMode || isDeliveryStaffMode) {
        setEntries(Array.from({ length: 5 }, () => ({ englishWord: '', hindiTranslation: '' })));
      } else {
        setEntries([{ englishWord: '', hindiTranslation: '' }]);
        setForm({ englishWord: '', hindiTranslation: '' });
      }
      setShowApprovedList(false);
    }, [mode, isDeliveryAreaMode, isDeliveryStaffMode]);

    const updateEntry = (index, field, value) => {
      setEntries((prev) => prev.map((entry, entryIndex) => (
        entryIndex === index
          ? { ...entry, [field]: value }
          : entry
      )));
    };

    const addEntry = () => {
      setEntries((prev) => [...prev, { englishWord: '', hindiTranslation: '' }]);
    };

    const removeEntry = (index) => {
      setEntries((prev) => prev.filter((_, entryIndex) => entryIndex !== index));
    };

    const handleChange = (e) => {
      const { name, value } = e.target;
      setForm((prev) => ({ ...prev, [name]: value }));
    };

    const submitDictionaryRequest = async () => {
      const type = isDeliveryAreaMode ? 'deliveryArea' : isDeliveryStaffMode ? 'deliveryStaff' : 'dictionary';
      const successMessage = isDeliveryAreaMode
        ? 'Delivery area update request submitted. Your request is pending with admin for approval.'
        : isDeliveryStaffMode
        ? 'Delivery staff update request submitted. Your request is pending with admin for approval.'
        : 'Dictionary request submitted. Your request is pending with admin for approval.';

      if (!loggedInUser?.id) {
        alert('Please login first.');
        return;
      }

      if (isDeliveryAreaMode || isDeliveryStaffMode) {
        const normalizedEntries = entries.map((entry) => ({
          englishWord: String(entry.englishWord || '').trim(),
          hindiTranslation: String(entry.hindiTranslation || '').trim(),
        })).filter((entry) => entry.englishWord || entry.hindiTranslation);

        if (normalizedEntries.length === 0 || normalizedEntries.some((entry) => !entry.englishWord || !entry.hindiTranslation)) {
          alert('Har row mein English aur Hindi dono values bharen.');
          return;
        }

        const ok = await submitUpdateApprovalRequest({
          type,
          payload: normalizedEntries,
          localKey: type === 'deliveryArea' ? 'deliveryAreaUpdates' : 'deliveryStaffUpdates',
          successMessage,
        });
        if (ok) {
          setEntries([{ englishWord: '', hindiTranslation: '' }]);
          onClose();
        }
        return;
      }

      const englishWord = form.englishWord.trim();
      const hindiTranslation = form.hindiTranslation.trim();
      if (!englishWord || !hindiTranslation) {
        alert('English word aur Hindi translation required hai.');
        return;
      }

      const nextPendingCount = pendingCount + 1;
      const clientRequestId = `dict-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const payload = {
        clientRequestId,
        englishWord,
        hindiTranslation,
        requestedBy: loggedInUser?.dealerCode || '',
        requestedAt: new Date().toISOString(),
      };

      let approvalId = '';
      let approvalSaved = false;
      try {
        try {
          const approvalRef = await addDoc(collection(db, 'updateApprovals'), {
            userId: loggedInUser.id,
            dealerCode: loggedInUser.dealerCode || '',
            dealerName: loggedInUser.dealerName || '',
            type: 'dictionary',
            payload,
            status: 'pending',
            requestedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          approvalId = approvalRef.id;
          approvalSaved = true;
        } catch (e) { void e; }

        try {
          await updateDoc(doc(db, 'users', loggedInUser.id), {
            dictionaryPendingCount: nextPendingCount,
            pendingDictionaryRequests: arrayUnion({
              id: clientRequestId,
              approvalId,
              status: 'pending',
              payload,
              dealerCode: loggedInUser.dealerCode || '',
              dealerName: loggedInUser.dealerName || '',
              requestedAt: payload.requestedAt,
            }),
            updatedAt: serverTimestamp(),
          });
        } catch {
          if (!approvalSaved) throw new Error('DICTIONARY_REQUEST_NOT_SAVED');
        }

        updateUserInStore(
          loggedInUser.id,
          (user) => ({
            ...user,
            dictionaryPendingCount: nextPendingCount,
            pendingDictionaryRequests: [
              ...(Array.isArray(user.pendingDictionaryRequests) ? user.pendingDictionaryRequests : []),
              {
                id: clientRequestId,
                approvalId,
                status: 'pending',
                payload,
                dealerCode: loggedInUser.dealerCode || '',
                dealerName: loggedInUser.dealerName || '',
                requestedAt: payload.requestedAt,
              },
            ],
          }),
          loggedInUser.dealerCode
        );
        setForm({ englishWord: '', hindiTranslation: '' });
        alert('Dictionary request submitted. Your request is pending with admin for approval.');
      } catch {
        alert('Dictionary request submit failed. Check Firebase permissions.');
      }
    };

    return (
      <div className="placeholder-container dictionary-request-panel">
        <h2>{title}</h2>
        {mode === 'default' ? (
          <div className="dictionary-pending-count">{pendingCount} request pending</div>
        ) : null}
        {(isDeliveryAreaMode || isDeliveryStaffMode) && (
          <div className="dictionary-approved-toggle">
            <button
              type="button"
              className="dictionary-approved-toggle-button"
              onClick={() => setShowApprovedList((prev) => !prev)}
            >
              {approvedListTitle}
            </button>
            {showApprovedList && (
              <div className="dictionary-approved-list">
                {approvedItems.length > 0 ? (
                  <table className="dictionary-approved-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{isDeliveryAreaMode ? 'Approved Area' : 'Approved Staff'}</th>
                        <th>Hindi Translation</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvedItems.map((item, index) => (
                        <tr key={`${mode}-approved-${index}`}>
                          <td>{index + 1}</td>
                          <td>{String(item.englishWord || item.english || '').trim() || '-'}</td>
                          <td>{String(item.hindiTranslation || item.hindi || '').trim() || '-'}</td>
                          <td className="dictionary-approved-actions">
                            <button
                              type="button"
                              className="dictionary-approved-action"
                              onClick={() => editApprovedItem(item)}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="dictionary-approved-empty">No approved items found yet.</div>
                )}
              </div>
            )}
          </div>
        )}
        <div className="profile-form">
          {isDeliveryAreaMode || isDeliveryStaffMode ? (
            <>
              <div className="dictionary-multi-header">
                <span>Sr.</span>
                <span>{isDeliveryAreaMode ? 'English Area' : 'English Staff'}</span>
                <span>Hindi Translation</span>
                <span>Action</span>
              </div>
              {entries.map((entry, index) => (
                <div key={index} className="dictionary-multi-entry">
                  <span>{index + 1}</span>
                  <input
                    className="form-input"
                    value={entry.englishWord}
                    onChange={(e) => updateEntry(index, 'englishWord', e.target.value)}
                    placeholder={englishPlaceholder}
                  />
                  <input
                    className="form-input"
                    value={entry.hindiTranslation}
                    onChange={(e) => updateEntry(index, 'hindiTranslation', e.target.value)}
                    placeholder={hindiPlaceholder}
                  />
                  <button
                    type="button"
                    className="dictionary-row-remove"
                    onClick={() => removeEntry(index)}
                    disabled={entries.length <= 1}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className="dictionary-request-add-row" onClick={addEntry}>
                Add Another Row
              </button>
            </>
          ) : (
            <>
              <span className="profile-label">English Word</span>
              <input
                className="form-input"
                name="englishWord"
                value={form.englishWord}
                onChange={handleChange}
                placeholder={englishPlaceholder}
              />
              <span className="profile-label">Hindi Translation</span>
              <input
                className="form-input"
                name="hindiTranslation"
                value={form.hindiTranslation}
                onChange={handleChange}
                placeholder={hindiPlaceholder}
              />
            </>
          )}
        </div>
        <div className="form-actions">
          <button onClick={submitDictionaryRequest}>Send Request</button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  };

  const UpgradePlanForm = ({ onClose }) => {
    const hasPendingUpgrade = String(loggedInUser?.pendingUpdates?.planUpgrade?.status || '').toLowerCase() === 'pending'
      || String(loggedInUser?.approvalStatus?.planUpgrade || '').toLowerCase() === 'pending';
    const [selectedPackage, setSelectedPackage] = useState(PLAN_UPGRADE_OPTIONS[0] || '');
    const [paymentDetails, setPaymentDetails] = useState({
      utr: '',
      paymentDate: '',
      paymentNote: '',
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handlePaymentDetailsChange = (e) => {
      const { name, value } = e.target;
      setPaymentDetails((prev) => ({ ...prev, [name]: value }));
      setErrors((prev) => ({ ...prev, [name]: '', selectedPackage: '' }));
    };

    const submitUpgradeRequest = async () => {
      const nextErrors = {};
      if (!selectedPackage) nextErrors.selectedPackage = 'Please select a plan.';
      if (!paymentDetails.utr.trim()) nextErrors.utr = 'UTR number is required.';
      if (!paymentDetails.paymentDate) nextErrors.paymentDate = 'Payment date is required.';
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) return;
      setIsSubmitting(true);
      const payload = {
        package: selectedPackage,
        packagePrice: PACKAGE_PRICING[selectedPackage] || '',
        currentPackage: loggedInUser?.package || '',
        currentValidTill: loggedInUser?.validTill || '',
        paymentUpiId: PAYMENT_UPI_ID,
        paymentUtr: paymentDetails.utr.trim(),
        paymentDate: paymentDetails.paymentDate,
        paymentNote: paymentDetails.paymentNote.trim(),
        requestedAt: new Date().toISOString(),
      };
      const ok = await submitUpdateApprovalRequest({
        type: 'planUpgrade',
        payload,
        successMessage: 'Plan upgrade request submitted. Your request is pending with admin for approval.',
      });
      setIsSubmitting(false);
      if (ok) {
        logRecentActivity('Submitted plan upgrade request');
        onClose();
      }
    };

    return (
      <div className="placeholder-container upgrade-plan-panel">
        <h2>Upgrade Plan</h2>
        <div className="profile-form">
          <span className="profile-label">Current Package</span>
          <span>{formatPackageNameForNavbar(loggedInUser?.package)}</span>
          <span className="profile-label">Expired On</span>
          <span>{formatDisplayDate(loggedInUser?.validTill)}</span>
          <span className="profile-label">Choose New Plan</span>
          <select
            className={`form-input${errors.selectedPackage ? ' form-input--error' : ''}`}
            value={selectedPackage}
            onChange={(e) => {
              setSelectedPackage(e.target.value);
              setErrors((prev) => ({ ...prev, selectedPackage: '' }));
            }}
            disabled={hasPendingUpgrade || isSubmitting}
          >
            {PLAN_UPGRADE_OPTIONS.map((pkg) => (
              <option key={pkg} value={pkg}>
                {formatPackageOptionLabel(pkg)}
              </option>
            ))}
          </select>
          {errors.selectedPackage ? <div className="form-error">{errors.selectedPackage}</div> : <span />}
          <span className="profile-label">Payment UPI ID</span>
          <span className="upgrade-plan-upi">{PAYMENT_UPI_ID}</span>
          <span className="profile-label">UTR Number</span>
          <div>
            <input
              className={`form-input${errors.utr ? ' form-input--error' : ''}`}
              name="utr"
              value={paymentDetails.utr}
              onChange={handlePaymentDetailsChange}
              placeholder="Enter UTR / Transaction ID"
              disabled={hasPendingUpgrade || isSubmitting}
            />
            {errors.utr && <div className="form-error">{errors.utr}</div>}
          </div>
          <span className="profile-label">Payment Date</span>
          <div>
            <input
              className={`form-input${errors.paymentDate ? ' form-input--error' : ''}`}
              name="paymentDate"
              type="date"
              value={paymentDetails.paymentDate}
              onChange={handlePaymentDetailsChange}
              disabled={hasPendingUpgrade || isSubmitting}
            />
            {errors.paymentDate && <div className="form-error">{errors.paymentDate}</div>}
          </div>
          <span className="profile-label">Payment Remark</span>
          <textarea
            className="form-textarea"
            name="paymentNote"
            value={paymentDetails.paymentNote}
            onChange={handlePaymentDetailsChange}
            placeholder="Optional payment note"
            disabled={hasPendingUpgrade || isSubmitting}
          />
        </div>
        {hasPendingUpgrade && (
          <p className="upgrade-plan-pending">Your plan upgrade request is already pending with admin.</p>
        )}
        <div className="form-actions">
          <button onClick={submitUpgradeRequest} disabled={hasPendingUpgrade || isSubmitting}>{isSubmitting ? 'Submitting...' : 'Send Request'}</button>
          <button onClick={onClose} disabled={isSubmitting}>Close</button>
        </div>
      </div>
    );
  };

  const AdminPanel = ({ onClose, onAdminLogout }) => {
    const adminImportRef = useRef(null);
    const dictionaryImportRef = useRef(null);
    const [adminItemsPerPage] = useState(10);
    const [adminRoleMode, setAdminRoleMode] = useState(() => localStorage.getItem('adminRoleMode') || 'super-admin');
    const {
      requests,
      setRequests,
      users,
      setUsers,
      feedback,
      setFeedback,
      updateApprovals,
      setUpdateApprovals,
      activeAdminTab,
      setActiveAdminTab,
      adminSearchTerm,
      setAdminSearchTerm,
      adminDateRange,
      setAdminDateRange,
      adminSubFilter,
      setAdminSubFilter,
      adminCurrentPage,
      setAdminCurrentPage,
      viewRequest,
      setViewRequest,
      viewApproval,
      setViewApproval,
      detailView,
      setDetailView,
      auditTrail,
      setAuditTrail,
      adminNotes,
      setAdminNotes,
      feedbackMetaOverrides,
      setFeedbackMetaOverrides,
      feedbackReplies,
      setFeedbackReplies,
      approvalReplies,
      setApprovalReplies,
      savedAdminViews,
      setSavedAdminViews,
      deletedUsersBin,
      setDeletedUsersBin,
      adminNotifications,
      setAdminNotifications,
      adminDataHealth,
      setAdminDataHealth,
      hiddenApprovalIds,
      setHiddenApprovalIds,
      registrationStatusOverrides,
      setRegistrationStatusOverrides,
      confirmAdminAction,
      paginateAdminRows,
    } = useAdminData();
    const {
      selectedRequestIds,
      selectedApprovalIds,
      selectedUserTokens,
      toggleRequestSelection,
      toggleApprovalSelection,
      toggleUserSelection,
      setSelectedRequestIds,
      setSelectedApprovalIds,
      setSelectedUserTokens,
      clearSelectedRequestIds,
      clearSelectedApprovalIds,
      clearSelectedUserTokens,
      clearAllSelections,
    } = useApprovalQueue();
    const [newUser, setNewUser] = useState({
      dealerCode: '',
      dealerName: '',
      mobile: '',
      email: '',
      package: '',
      pin: '',
      role: 'operator',
    });
    const [editingUserId, setEditingUserId] = useState('');
    const [dictionaryApprovalEdits, setDictionaryApprovalEdits] = useState({});
    const [dictionaryRequestView, setDictionaryRequestView] = useState('new');
    const [activeAdminFeedback, setActiveAdminFeedback] = useState(null);
    const [adminReplyDraft, setAdminReplyDraft] = useState('');
    const [showAdminReplyPopup, setShowAdminReplyPopup] = useState(false);
    const [editUser, setEditUser] = useState({
      dealerCode: '',
      dealerName: '',
      mobile: '',
      email: '',
      package: '',
      validFrom: '',
      validTill: '',
      pin: '',
      role: 'operator',
      status: 'active',
      profileData: {
        distributorCode: '',
        distributorName: '',
        contact: '',
        email: '',
        gst: '',
        address: '',
        photoDataUrl: '',
      },
      bankDetailsData: {
        bankName: '',
        branch: '',
        accountNo: '',
        ifsc: '',
      },
    });
    const [showApprovalReplyPopup, setShowApprovalReplyPopup] = useState(false);
    const [activeApprovalReply, setActiveApprovalReply] = useState(null);
    const [approvalReplyDraft, setApprovalReplyDraft] = useState('');
    const [allFeedbackEntries, setAllFeedbackEntries] = useState([]);

    const getConversationKey = (item) => {
      if (!item) return '';
      return item.userId || item.dealerCode || item.email || item.clientFeedbackId || item.id || '';
    };

    const getConversationHistory = (item) => {
      const conversationKey = getConversationKey(item);
      if (!conversationKey) return [];
      return allFeedbackEntries
        .filter((entry) => getConversationKey(entry) === conversationKey)
        .sort((a, b) => new Date(a.createdAt || a.date || '').getTime() - new Date(b.createdAt || b.date || '').getTime());
    };

    const openAdminReplyPopup = (item) => {
      if (!item) return;
      const currentReply = feedbackReplies?.[item.id] || feedbackReplies?.[item.clientFeedbackId] || '';
      setActiveAdminFeedback(item);
      setAdminReplyDraft(currentReply);
      setShowAdminReplyPopup(true);
    };

    const closeAdminReplyPopup = () => {
      setShowAdminReplyPopup(false);
      setActiveAdminFeedback(null);
      setAdminReplyDraft('');
    };

    const submitAdminReply = () => {
      if (!activeAdminFeedback) return;
      if (!adminReplyDraft.trim()) {
        alert('Please enter a reply before saving.');
        return;
      }
      const replyKey = activeAdminFeedback.id || activeAdminFeedback.clientFeedbackId || '';
      const nextReplies = {
        ...feedbackReplies,
        [replyKey]: adminReplyDraft.trim(),
      };
      persistFeedbackReplies(nextReplies);
      logAdminActivity('feedback_reply_saved', { id: replyKey, dealerCode: activeAdminFeedback.dealerCode || '' });
      closeAdminReplyPopup();
    };

    const getApprovalReplyKey = (approval) => {
      if (!approval) return '';
      const approvalType = normalizeApprovalType(approval.type);
      if (approvalType === 'planUpgrade') {
        return getPlanUpgradeReplyStorageKey({
          userId: approval.userId,
          dealerCode: approval.dealerCode,
          dealerName: approval.dealerName,
        });
      }
      return approval.id || approval.approvalId || approval.clientRequestId || `${approval.type}-${approval.userId || approval.dealerCode || approval.dealerName || ''}`;
    };

    const getApprovalReplyMessage = (approval) => {
      if (!approval) return '';
      const replyKey = getApprovalReplyKey(approval);
      return String(
        approvalReplies?.[replyKey]
        || approval?.payload?.adminReply
        || approval?.adminReply
        || approval?.pendingReply
        || ''
      ).trim();
    };

    const openApprovalReplyPopup = (item) => {
      if (!item) return;
      const replyKey = getApprovalReplyKey(item);
      const currentReply = getApprovalReplyMessage(item);
      setActiveApprovalReply({ ...item, replyKey, pendingReply: currentReply });
      setApprovalReplyDraft(currentReply);
      setShowApprovalReplyPopup(true);
    };

    const closeApprovalReplyPopup = () => {
      setShowApprovalReplyPopup(false);
      setActiveApprovalReply(null);
      setApprovalReplyDraft('');
    };

    const submitApprovalReply = async () => {
      if (!activeApprovalReply) return;
      if (!approvalReplyDraft.trim()) {
        alert('Please enter a reply before saving.');
        return;
      }
      const replyMessage = approvalReplyDraft.trim();
      const key = activeApprovalReply.replyKey || getApprovalReplyKey(activeApprovalReply);
      const nextReplies = {
        ...approvalReplies,
        [key]: replyMessage,
      };
      const replyTimestamp = new Date().toISOString();

      try {
        const approvalDocId = activeApprovalReply.source === 'userDoc'
          ? activeApprovalReply.approvalId
          : activeApprovalReply.id;
        if (approvalDocId && normalizeApprovalType(activeApprovalReply.type) === 'planUpgrade') {
          try {
            const approvalRef = doc(db, 'updateApprovals', approvalDocId);
            const existingPayload = activeApprovalReply.payload || {};
            await updateDoc(approvalRef, {
              payload: {
                ...existingPayload,
                adminReply: replyMessage,
                adminReplyAt: replyTimestamp,
              },
              updatedAt: serverTimestamp(),
            });
          } catch (error) {
            void error;
          }
        }

        const targetUser = users.find((u) => (
          u.id === activeApprovalReply.userId
          || String(u?.dealerCode || '').trim() === String(activeApprovalReply?.dealerCode || '').trim()
        ));

        if (targetUser?.id && normalizeApprovalType(activeApprovalReply.type) === 'planUpgrade') {
          try {
            await updateDoc(doc(db, 'users', targetUser.id), {
              'pendingUpdates.planUpgrade.adminReply': replyMessage,
              'pendingUpdates.planUpgrade.adminReplyAt': replyTimestamp,
              updatedAt: serverTimestamp(),
            });
          } catch (error) {
            void error;
          }
        }
      } catch (error) {
        void error;
      }

      persistApprovalReplies(nextReplies);
      logAdminActivity('approval_reply_saved', { id: key, dealerCode: activeApprovalReply.dealerCode || '' });
      await loadData();
      closeApprovalReplyPopup();
    };

    const loadData = async () => {
      try {
        let firebaseRequests = [];
        let firebaseUsers = [];
        let firebaseApprovals = [];
        let firebaseFeedback = [];

        try {
          const reqSnap = await getDocs(collection(db, 'registrationRequests'));
          firebaseRequests = reqSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data()?.createdAt?.toDate?.()?.toISOString?.() || d.data()?.createdAt || '',
            approvedAt: d.data()?.approvedAt?.toDate?.()?.toISOString?.() || d.data()?.approvedAt || '',
          }));
        } catch (e) { void e; }

        try {
          const userSnap = await getDocs(collection(db, 'users'));
          firebaseUsers = userSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (e) { void e; }

        try {
          const approvalSnap = await getDocs(collection(db, 'updateApprovals'));
          firebaseApprovals = approvalSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            requestedAt: d.data()?.requestedAt?.toDate?.()?.toISOString?.() || d.data()?.requestedAt || '',
            approvedAt: d.data()?.approvedAt?.toDate?.()?.toISOString?.() || d.data()?.approvedAt || '',
            rejectedAt: d.data()?.rejectedAt?.toDate?.()?.toISOString?.() || d.data()?.rejectedAt || '',
          }));
        } catch (e) { void e; }

        try {
          const feedbackSnap = await getDocs(collection(db, 'feedback'));
          firebaseFeedback = feedbackSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data()?.createdAt?.toDate?.()?.toISOString?.() || d.data()?.createdAt || '',
          }));
        } catch (e) { void e; }

        if (firebaseRequests.length === 0) {
          const reqRaw = localStorage.getItem('registrationRequests');
          const reqList = reqRaw ? JSON.parse(reqRaw) : [];
          firebaseRequests = Array.isArray(reqList) ? reqList : [];
        }
        if (firebaseUsers.length === 0) {
          const usersRaw = localStorage.getItem('usersData');
          const userList = usersRaw ? JSON.parse(usersRaw) : [];
          firebaseUsers = Array.isArray(userList) ? userList : [];
        }
        if (firebaseFeedback.length === 0) {
          const fbRaw = localStorage.getItem('feedbackData');
          const fbList = fbRaw ? JSON.parse(fbRaw) : [];
          firebaseFeedback = Array.isArray(fbList) ? fbList : [];
        }

        const reqWithOverrides = firebaseRequests.map((r) => {
          const overriddenStatus = registrationStatusOverrides[r.id];
          return overriddenStatus ? { ...r, status: overriddenStatus } : r;
        });

        const userFeedback = firebaseUsers.flatMap((u) => {
          const list = Array.isArray(u?.feedbackEntries) ? u.feedbackEntries : [];
          return list.map((entry, idx) => ({
            ...entry,
            id: entry?.id || `userfb-${u.id}-${entry?.clientFeedbackId || idx}`,
            source: 'userDoc',
            userId: u.id,
            dealerCode: entry?.dealerCode || u.dealerCode || '',
            dealerName: entry?.dealerName || u.dealerName || '',
            email: entry?.email || u.email || '',
            createdAt: entry?.createdAt || '',
          }));
        });

        const mergedFeedbackMap = new Map();
        [...firebaseFeedback.map((f) => ({ ...f, source: f.source || 'collection' })), ...userFeedback].forEach((f, idx) => {
          const key = f.clientFeedbackId
            ? `${f.userId || f.dealerCode || 'x'}-${f.clientFeedbackId}`
            : `${f.id || 'fb'}-${idx}`;
          if (!mergedFeedbackMap.has(key)) {
            mergedFeedbackMap.set(key, f);
          }
        });

        const latestFeedbackByUser = new Map();
        Array.from(mergedFeedbackMap.values()).forEach((item) => {
          const userKey = item.dealerCode || item.email || item.userId || item.id || `unknown-${item.clientFeedbackId || ''}`;
          const itemTimestamp = new Date(item.createdAt || item.date || '').getTime() || 0;
          const existing = latestFeedbackByUser.get(userKey);
          const existingTimestamp = existing ? new Date(existing.createdAt || existing.date || '').getTime() || 0 : 0;
          if (!existing || itemTimestamp >= existingTimestamp) {
            latestFeedbackByUser.set(userKey, item);
          }
        });

        const fullFeedbackEntries = Array.from(mergedFeedbackMap.values())
          .map((item) => {
            const override = feedbackMetaOverrides[item.id] || {};
            return {
              priority: 'medium',
              resolved: false,
              ...item,
              ...override,
            };
          })
          .sort((a, b) => new Date(a.createdAt || a.date || '').getTime() - new Date(b.createdAt || b.date || '').getTime());

        const mergedFeedback = Array.from(latestFeedbackByUser.values())
          .map((item) => {
            const override = feedbackMetaOverrides[item.id] || {};
            return {
              priority: 'medium',
              resolved: false,
              ...item,
              ...override,
            };
          })
          .sort((a, b) => new Date(b.createdAt || b.date || '').getTime() - new Date(a.createdAt || a.date || '').getTime());

        setRequests(reqWithOverrides);
        setUsers(firebaseUsers);
        setUpdateApprovals(firebaseApprovals);
        setFeedback(mergedFeedback);
        setAllFeedbackEntries(fullFeedbackEntries);
        localStorage.setItem('registrationRequests', JSON.stringify(reqWithOverrides));
        localStorage.setItem('usersData', JSON.stringify(firebaseUsers));
        localStorage.setItem('feedbackData', JSON.stringify(fullFeedbackEntries));
        setAdminDataHealth({
          source: firebaseUsers.length > 0 || firebaseRequests.length > 0 || firebaseApprovals.length > 0 || firebaseFeedback.length > 0 ? 'firebase+local' : 'local',
          lastSyncAt: new Date().toISOString(),
          firebaseReachable: true,
        });
      } catch {
        try {
          const reqRaw = localStorage.getItem('registrationRequests');
          const reqList = reqRaw ? JSON.parse(reqRaw) : [];
          const usersRaw = localStorage.getItem('usersData');
          const userList = usersRaw ? JSON.parse(usersRaw) : [];
          const fbRaw = localStorage.getItem('feedbackData');
          const fbList = fbRaw ? JSON.parse(fbRaw) : [];
          const reqArray = Array.isArray(reqList) ? reqList : [];
          const reqWithOverrides = reqArray.map((r) => {
            const overriddenStatus = registrationStatusOverrides[r.id];
            return overriddenStatus ? { ...r, status: overriddenStatus } : r;
          });
          setRequests(reqWithOverrides);
          setUsers(Array.isArray(userList) ? userList : []);
          setFeedback(Array.isArray(fbList) ? fbList : []);
          setUpdateApprovals([]);
          setAdminDataHealth({
            source: 'local',
            lastSyncAt: new Date().toISOString(),
            firebaseReachable: false,
          });
        } catch {
          setRequests([]);
          setUsers([]);
          setFeedback([]);
          setUpdateApprovals([]);
          setAdminDataHealth({
            source: 'unavailable',
            lastSyncAt: new Date().toISOString(),
            firebaseReachable: false,
          });
        }
      }
    };

    const writeUsersLocal = (nextUsers) => {
      setUsers(nextUsers);
      localStorage.setItem('usersData', JSON.stringify(nextUsers));
    };

    const toDateInputValue = (value) => {
      if (!value) return '';
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
      return d.toISOString().slice(0, 10);
    };

    const toIsoDate = (value) => {
      if (!value) return '';
      if (String(value).includes('T')) return value;
      const d = new Date(`${value}T00:00:00`);
      return Number.isNaN(d.getTime()) ? value : d.toISOString();
    };

    const logAdminActivity = (action, details = {}) => {
      const entry = {
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        action,
        details,
        createdAt: new Date().toISOString(),
      };
      setAuditTrail((prev) => {
        const next = [entry, ...(Array.isArray(prev) ? prev : [])].slice(0, 150);
        localStorage.setItem('adminAuditTrail', JSON.stringify(next));
        return next;
      });
    };

    const persistAdminNotes = (nextNotes) => {
      setAdminNotes(nextNotes);
      localStorage.setItem('adminNotes', JSON.stringify(nextNotes));
    };

    const saveAdminNote = (noteKey, noteValue) => {
      const nextNotes = { ...adminNotes, [noteKey]: noteValue };
      persistAdminNotes(nextNotes);
      logAdminActivity('note_saved', { noteKey });
    };

    const persistFeedbackMetaOverrides = (nextOverrides) => {
      setFeedbackMetaOverrides(nextOverrides);
      localStorage.setItem('feedbackMetaOverrides', JSON.stringify(nextOverrides));
    };

    const persistFeedbackReplies = (nextReplies) => {
      setFeedbackReplies(nextReplies);
      localStorage.setItem('feedbackReplies', JSON.stringify(nextReplies));
    };

    const persistApprovalReplies = (nextReplies) => {
      setApprovalReplies(nextReplies);
      localStorage.setItem(APPROVAL_REPLIES_STORAGE_KEY, JSON.stringify(nextReplies));
    };

    const persistSavedAdminViews = (nextViews) => {
      setSavedAdminViews(nextViews);
      localStorage.setItem('savedAdminViews', JSON.stringify(nextViews));
    };

    const saveCurrentAdminView = () => {
      const label = window.prompt('Saved view name?');
      if (!label) return;
      const nextViews = [
        {
          id: `view-${Date.now()}`,
          label,
          activeAdminTab,
          adminSearchTerm,
          adminDateRange,
          adminSubFilter,
        },
        ...savedAdminViews,
      ].slice(0, 20);
      persistSavedAdminViews(nextViews);
      logAdminActivity('saved_view_created', { label });
    };

    const applySavedAdminView = (view) => {
      if (!view) return;
      setActiveAdminTab(view.activeAdminTab || 'dashboard');
      setAdminSearchTerm(view.adminSearchTerm || '');
      setAdminDateRange(view.adminDateRange || 'all');
      setAdminSubFilter(view.adminSubFilter || 'all');
      logAdminActivity('saved_view_applied', { label: view.label || '' });
    };

    const handleAdminImport = async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const { default: XLSX } = await import('xlsx');
        const reader = new FileReader();
        reader.onload = async (e) => {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(worksheet);
          const importedUsers = rows.map((row) => ({
            dealerCode: String(row.dealerCode || row['Dealer Code'] || '').trim(),
            dealerName: String(row.dealerName || row['Dealer Name'] || '').trim(),
            mobile: String(row.mobile || row.Mobile || '').trim(),
            email: String(row.email || row.Email || '').trim(),
            package: String(row.package || row.Package || '').trim(),
            pin: String(row.pin || row.PIN || '').trim(),
            role: String(row.role || row.Role || 'operator').trim().toLowerCase() || 'operator',
            status: String(row.status || row.Status || 'active').trim().toLowerCase() || 'active',
            validFrom: toIsoDate(row.validFrom || row['Valid From']) || new Date().toISOString(),
            validTill: toIsoDate(row.validTill || row['Valid Till']) || computeValidityDates(String(row.package || row.Package || '')).validTill,
          })).filter((row) => row.dealerCode && row.dealerName && row.package && row.pin);
          const nextUsers = [...users, ...importedUsers];
          writeUsersLocal(nextUsers);
          logAdminActivity('bulk_users_imported', { count: importedUsers.length });
          alert(`${importedUsers.length} users imported locally.`);
        };
        reader.readAsArrayBuffer(file);
      } catch (error) {
        void error;
        alert('Import failed.');
      } finally {
        event.target.value = null;
      }
    };

    const persistDeletedUsersBin = (nextBin) => {
      setDeletedUsersBin(nextBin);
      localStorage.setItem('deletedUsersBin', JSON.stringify(nextBin));
    };

    const adminRolePermissions = {
      'super-admin': { tabs: ['dashboard', 'dictionary', 'pending-registration', 'approval', 'active-user', 'total-user', 'create-user', 'feedback', 'recycle-bin', 'audit'], mutate: true },
      'approval-admin': { tabs: ['dashboard', 'dictionary', 'pending-registration', 'approval', 'feedback', 'audit'], mutate: true },
      'support-admin': { tabs: ['dashboard', 'dictionary', 'active-user', 'total-user', 'feedback', 'audit'], mutate: true },
      viewer: { tabs: ['dashboard', 'dictionary', 'active-user', 'total-user', 'feedback', 'audit'], mutate: false },
    };
    const currentRolePermissions = adminRolePermissions[adminRoleMode] || adminRolePermissions['super-admin'];
    const canAccessTab = (tabKey) => currentRolePermissions.tabs.includes(tabKey);
    const canMutateAdminData = Boolean(currentRolePermissions.mutate);

    const setRegistrationOverride = (id, status) => {
      setRegistrationStatusOverrides((prev) => {
        const next = { ...(prev || {}), [id]: status };
        localStorage.setItem('registrationStatusOverrides', JSON.stringify(next));
        return next;
      });
    };

    const resolveEditToken = (user) => {
      const dealerCode = String(user?.dealerCode || '').trim();
      return user?.id || (dealerCode ? `dc:${dealerCode}` : '');
    };

    const isSameUserByToken = (user, token) => {
      if (!token) return false;
      if (user?.id && token === user.id) return true;
      const dealerCode = String(user?.dealerCode || '').trim();
      return dealerCode && token === `dc:${dealerCode}`;
    };

    useEffect(() => {
      loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      localStorage.setItem('adminRoleMode', adminRoleMode);
      if (!canAccessTab(activeAdminTab)) {
        setActiveAdminTab('dashboard');
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [adminRoleMode, activeAdminTab]);

    useEffect(() => {
      setAdminSubFilter('all');
      setAdminSearchTerm('');
      clearAllSelections();
      setAdminCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeAdminTab]);

    const approveRequest = async (id, options = {}) => {
      const req = requests.find((r) => r.id === id);
      if (!req) return;
      if (!options.skipConfirm && !confirmAdminAction(`Approve registration request for ${req.dealerCode || 'this dealer'}?`)) return;
      try {
        setRegistrationOverride(id, 'approved');
        const validity = computeValidityDates(req.package || '');
        const requestId = String(id || '');
        const isLocalOnlyRequest = requestId.startsWith('req-') || requestId.startsWith('legacy-');
        let requestStatusUpdated = false;
        const existingUser = users.find((u) => String(u?.dealerCode || '').trim() === String(req?.dealerCode || '').trim());
        if (existingUser?.id) {
          await updateDoc(doc(db, 'users', existingUser.id), {
            dealerCode: req.dealerCode || '',
            dealerName: req.dealerName || '',
            mobile: req.mobile || '',
            email: req.email || '',
            package: req.package || '',
            packageDays: validity.packageDays,
            validFrom: validity.validFrom,
            validTill: validity.validTill,
            pin: req.pin || '',
            status: 'active',
            role: existingUser.role || 'operator',
            approvedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await addDoc(collection(db, 'users'), {
            dealerCode: req.dealerCode || '',
            dealerName: req.dealerName || '',
            mobile: req.mobile || '',
            email: req.email || '',
            package: req.package || '',
            packageDays: validity.packageDays,
            validFrom: validity.validFrom,
            validTill: validity.validTill,
            pin: req.pin || '',
            role: 'operator',
            status: 'active',
            approvalStatus: {},
            createdAt: serverTimestamp(),
            approvedAt: serverTimestamp(),
          });
        }
        if (!isLocalOnlyRequest) {
          try {
            await updateDoc(doc(db, 'registrationRequests', id), {
              status: 'approved',
              approvedAt: serverTimestamp(),
            });
            requestStatusUpdated = true;
          } catch {
            // If request document update is blocked by rules, keep user activation successful.
          }
          const nextLocal = requests.map((r) => (r.id === id ? { ...r, status: 'approved', approvedAt: new Date().toISOString() } : r));
          setRequests(nextLocal);
          localStorage.setItem('registrationRequests', JSON.stringify(nextLocal));
        } else {
          const nextLocal = requests.filter((r) => r.id !== id);
          setRequests(nextLocal);
          localStorage.setItem('registrationRequests', JSON.stringify(nextLocal));
        }
        await loadData();
        logAdminActivity('registration_approved', { id, dealerCode: req.dealerCode || '' });
        if (!isLocalOnlyRequest && !requestStatusUpdated) {
          setRequests((prev) => prev.filter((r) => r.id !== id));
        }
      } catch {
        alert('Approve failed. Firestore rules/permission check karo.');
      }
    };

    const rejectRequest = async (id, options = {}) => {
      const req = requests.find((r) => r.id === id);
      if (!options.skipConfirm && !confirmAdminAction(`Reject registration request for ${req?.dealerCode || 'this dealer'}?`)) return;
      try {
        setRegistrationOverride(id, 'rejected');
        const requestId = String(id || '');
        const isLocalOnlyRequest = requestId.startsWith('req-') || requestId.startsWith('legacy-');
        if (!isLocalOnlyRequest) {
          await updateDoc(doc(db, 'registrationRequests', id), {
            status: 'rejected',
            rejectedAt: serverTimestamp(),
          });
        } else {
          const nextLocal = requests.map((r) => (r.id === id ? { ...r, status: 'rejected' } : r));
          setRequests(nextLocal);
          localStorage.setItem('registrationRequests', JSON.stringify(nextLocal));
        }
        await loadData();
        logAdminActivity('registration_rejected', { id, dealerCode: req?.dealerCode || '' });
      } catch {
        alert('Reject failed. Check Firestore rules.');
      }
    };

    const addManualUser = async () => {
      if (!newUser.dealerCode || !newUser.dealerName || !newUser.pin || !newUser.package) {
        alert('Dealer code, dealer name, package and PIN required.');
        return;
      }
      if (!confirmAdminAction(`Create manual user ${newUser.dealerCode.trim()}?`)) return;
      try {
        const validity = computeValidityDates(newUser.package);
        await addDoc(collection(db, 'users'), {
          dealerCode: newUser.dealerCode.trim(),
          dealerName: newUser.dealerName.trim(),
          mobile: newUser.mobile.trim(),
          email: newUser.email.trim(),
          package: newUser.package,
          packageDays: validity.packageDays,
          validFrom: validity.validFrom,
          validTill: validity.validTill,
          pin: newUser.pin.trim(),
          role: newUser.role,
          status: 'active',
          approvalStatus: {},
          createdAt: serverTimestamp(),
          approvedAt: serverTimestamp(),
        });
        setNewUser({ dealerCode: '', dealerName: '', mobile: '', email: '', package: '', pin: '', role: 'operator' });
        await loadData();
        logAdminActivity('manual_user_created', { dealerCode: newUser.dealerCode.trim() });
      } catch {
        alert('Create user failed.');
      }
    };

    const toggleUserStatus = async (userOrId, options = {}) => {
      const target = typeof userOrId === 'object'
        ? userOrId
        : users.find((u) => u.id === userOrId);
      if (!target) return;
      const nextStatus = target.status === 'active' ? 'disabled' : 'active';
      if (!options.skipConfirm && !confirmAdminAction(`${nextStatus === 'disabled' ? 'Disable' : 'Enable'} ${target.dealerCode || 'this user'}?`)) return;
      try {
        if (target.id) {
          await updateDoc(doc(db, 'users', target.id), {
            status: nextStatus,
            updatedAt: serverTimestamp(),
          });
          await loadData();
          logAdminActivity('user_status_changed', { dealerCode: target.dealerCode || '', status: nextStatus });
          return;
        }
        throw new Error('LOCAL_ONLY_USER');
      } catch {
        const token = resolveEditToken(target);
        const nextUsers = users.map((u) => (isSameUserByToken(u, token) ? { ...u, status: nextStatus } : u));
        writeUsersLocal(nextUsers);
        logAdminActivity('user_status_changed_local', { dealerCode: target.dealerCode || '', status: nextStatus });
        alert('Status updated locally.');
      }
    };

    const deleteUser = async (userOrId) => {
      const target = typeof userOrId === 'object'
        ? userOrId
        : users.find((u) => u.id === userOrId);
      if (!target) return;
      if (!confirmAdminAction(`Delete ${target.dealerCode || 'this user'} permanently?`)) return;
      try {
        persistDeletedUsersBin([{ ...target, deletedAt: new Date().toISOString() }, ...deletedUsersBin].slice(0, 200));
        if (target.id) {
          await deleteDoc(doc(db, 'users', target.id));
          await loadData();
          logAdminActivity('user_deleted', { dealerCode: target.dealerCode || '' });
          return;
        }
        throw new Error('LOCAL_ONLY_USER');
      } catch {
        const token = resolveEditToken(target);
        const nextUsers = users.filter((u) => !isSameUserByToken(u, token));
        writeUsersLocal(nextUsers);
        logAdminActivity('user_deleted_local', { dealerCode: target.dealerCode || '' });
        alert('User deleted locally.');
      }
    };

    const startEditUser = (u) => {
      setEditingUserId(resolveEditToken(u));
      setEditUser({
        dealerCode: u.dealerCode || '',
        dealerName: u.dealerName || '',
        mobile: u.mobile || '',
        email: u.email || '',
        package: u.package || '',
        validFrom: toDateInputValue(u.validFrom),
        validTill: toDateInputValue(u.validTill),
        pin: u.pin || '',
        role: u.role || 'operator',
        status: u.status || 'active',
        profileData: {
          distributorCode: u.profileData?.distributorCode || '',
          distributorName: u.profileData?.distributorName || '',
          contact: u.profileData?.contact || '',
          email: u.profileData?.email || '',
          gst: u.profileData?.gst || '',
          address: u.profileData?.address || '',
          photoDataUrl: u.profileData?.photoDataUrl || '',
        },
        bankDetailsData: {
          bankName: u.bankDetailsData?.bankName || '',
          branch: u.bankDetailsData?.branch || '',
          accountNo: u.bankDetailsData?.accountNo || '',
          ifsc: u.bankDetailsData?.ifsc || '',
        },
      });
    };

    const saveEditedUser = async () => {
      if (!editingUserId) return;
      const targetUser = users.find((u) => isSameUserByToken(u, editingUserId));
      if (!targetUser) {
        alert('User not found.');
        return;
      }
      if (!confirmAdminAction(`Save changes for ${targetUser.dealerCode || 'this user'}?`)) return;
      try {
        const fallbackValidity = computeValidityDates(editUser.package);
        const validFromIso = toIsoDate(editUser.validFrom) || fallbackValidity.validFrom;
        const validTillIso = toIsoDate(editUser.validTill) || fallbackValidity.validTill;
        const diffDays = Math.max(0, Math.ceil((new Date(validTillIso).getTime() - new Date(validFromIso).getTime()) / (1000 * 60 * 60 * 24)));
        if (!targetUser.id) {
          throw new Error('LOCAL_ONLY_USER');
        }
        await updateDoc(doc(db, 'users', targetUser.id), {
          dealerCode: editUser.dealerCode.trim(),
          dealerName: editUser.dealerName.trim(),
          mobile: editUser.mobile.trim(),
          email: editUser.email.trim(),
          package: editUser.package,
          packageDays: Number.isFinite(diffDays) ? diffDays : fallbackValidity.packageDays,
          validFrom: validFromIso,
          validTill: validTillIso,
          pin: editUser.pin.trim(),
          role: editUser.role,
          status: editUser.status,
          profileData: { ...editUser.profileData },
          bankDetailsData: { ...editUser.bankDetailsData },
          updatedAt: serverTimestamp(),
        });
        setEditingUserId('');
        await loadData();
        logAdminActivity('user_updated', { dealerCode: targetUser.dealerCode || '' });
      } catch {
        const fallbackValidity = computeValidityDates(editUser.package);
        const validFromIso = toIsoDate(editUser.validFrom) || fallbackValidity.validFrom;
        const validTillIso = toIsoDate(editUser.validTill) || fallbackValidity.validTill;
        const diffDays = Math.max(0, Math.ceil((new Date(validTillIso).getTime() - new Date(validFromIso).getTime()) / (1000 * 60 * 60 * 24)));
        const nextUsers = users.map((u) => (
          isSameUserByToken(u, editingUserId)
            ? {
              ...u,
              dealerCode: editUser.dealerCode.trim(),
              dealerName: editUser.dealerName.trim(),
              mobile: editUser.mobile.trim(),
              email: editUser.email.trim(),
              package: editUser.package,
              packageDays: Number.isFinite(diffDays) ? diffDays : fallbackValidity.packageDays,
              validFrom: validFromIso,
              validTill: validTillIso,
              pin: editUser.pin.trim(),
              role: editUser.role,
              status: editUser.status,
              profileData: { ...editUser.profileData },
              bankDetailsData: { ...editUser.bankDetailsData },
            }
            : u
        ));
        writeUsersLocal(nextUsers);
        setEditingUserId('');
        logAdminActivity('user_updated_local', { dealerCode: targetUser.dealerCode || '' });
        alert('User updated locally. Firebase permission denied.');
      }
    };

    const normalizeApprovalType = (type) => {
      const raw = String(type || '').toLowerCase().trim();
      if (raw === 'profile' || raw === 'profiledata') return 'profile';
      if (raw === 'bank' || raw === 'bankdetails' || raw === 'bankdetailsdata') return 'bank';
      if (raw === 'rates' || raw === 'rate' || raw === 'ratesdata') return 'rates';
      if (raw === 'header' || raw === 'hindiheader' || raw === 'hindiheaderdata') return 'header';
      if (raw === 'planupgrade' || raw === 'plan' || raw === 'package') return 'planUpgrade';
      if (raw === 'dictionary' || raw === 'dict' || raw === 'translationdictionary') return 'dictionary';
      if (raw === 'deliveryarea' || raw === 'delivery area') return 'deliveryArea';
      if (raw === 'deliverystaff' || raw === 'delivery staff') return 'deliveryStaff';
      return raw;
    };

    const pendingApprovalRequests = updateApprovals.filter((r) => String(r.status || 'pending').toLowerCase() === 'pending');
    const fallbackPendingApprovals = users.flatMap((u) => {
      const pendingUpdates = u?.pendingUpdates || {};
      const pendingUpdateApprovals = Object.entries(pendingUpdates)
        .filter(([, v]) => String(v?.status || 'pending').toLowerCase() === 'pending')
        .map(([type, value]) => ({
          id: `userdoc-${u.id}-${type}`,
          source: 'userDoc',
          userId: u.id,
          dealerCode: u.dealerCode || '',
          dealerName: u.dealerName || '',
          type,
          status: value?.status || 'pending',
          payload: value?.payload ?? null,
          requestedAt: value?.requestedAt || '',
          adminReply: value?.adminReply || '',
          adminReplyAt: value?.adminReplyAt || '',
        }));
      const pendingDictionaryApprovals = (Array.isArray(u?.pendingDictionaryRequests) ? u.pendingDictionaryRequests : [])
        .filter((request) => String(request?.status || 'pending').toLowerCase() === 'pending')
        .map((request, idx) => ({
          id: `userdict-${u.id}-${request?.id || request?.approvalId || idx}`,
          source: 'userDoc',
          userId: u.id,
          dealerCode: request?.dealerCode || u.dealerCode || '',
          dealerName: request?.dealerName || u.dealerName || '',
          type: 'dictionary',
          status: request?.status || 'pending',
          payload: request?.payload || request,
          requestedAt: request?.requestedAt || request?.payload?.requestedAt || '',
          approvalId: request?.approvalId || '',
          clientRequestId: request?.id || request?.payload?.clientRequestId || '',
        }));
      return [...pendingUpdateApprovals, ...pendingDictionaryApprovals];
    });
    const collectionPendingApprovals = pendingApprovalRequests.filter((approval) => {
      const approvalType = normalizeApprovalType(approval.type);
      const user = users.find((u) => u.id === approval.userId || String(u?.dealerCode || '').trim() === String(approval?.dealerCode || '').trim());
      const pendingStatus = user?.pendingUpdates?.[approvalType]?.status;
      if (!pendingStatus) return true;
      return String(pendingStatus).toLowerCase() === 'pending';
    });
    const getApprovalKey = (approval) => {
      if (!approval) return '';
      const approvalType = normalizeApprovalType(approval.type);
      if (approvalType === 'dictionary') {
        return `${approvalType}-${approval.approvalId || approval.clientRequestId || approval.id || approval.userId || approval.dealerCode || ''}`;
      }
      const userKey = approval.userId || approval.dealerCode || approval.dealerName || '';
      if (userKey) {
        return `${approvalType}-${userKey}`;
      }
      return `${approvalType}-${approval.id || approval?.payload?.clientRequestId || ''}`;
    };

    const combinedApprovalMap = new Map();
    [...collectionPendingApprovals, ...fallbackPendingApprovals].forEach((approval) => {
      const key = getApprovalKey(approval);
      if (!combinedApprovalMap.has(key)) {
        combinedApprovalMap.set(key, approval);
      }
    });
    const combinedPendingApprovals = Array.from(combinedApprovalMap.values())
      .filter((approval) => !hiddenApprovalIds.includes(approval.id));
    const dictionaryPendingApprovals = combinedPendingApprovals.filter((approval) => normalizeApprovalType(approval.type) === 'dictionary');
    const nonDictionaryPendingApprovals = combinedPendingApprovals.filter((approval) => normalizeApprovalType(approval.type) !== 'dictionary');

    const getDictionaryApprovalPayload = (approval) => ({
      ...(approval?.payload || {}),
      ...(dictionaryApprovalEdits[approval?.id] || {}),
    });

    const duplicateDictionaryApprovals = dictionaryPendingApprovals.filter((approval) => {
      const payload = getDictionaryApprovalPayload(approval);
      return Boolean(getExistingDictionaryEntry(translationDictionary, payload?.englishWord || payload?.eng));
    });
    const newDictionaryApprovals = dictionaryPendingApprovals.filter((approval) => {
      const payload = getDictionaryApprovalPayload(approval);
      return !getExistingDictionaryEntry(translationDictionary, payload?.englishWord || payload?.eng);
    });

    const updateDictionaryApprovalEdit = (approval, field, value) => {
      const current = getDictionaryApprovalPayload(approval);
      setDictionaryApprovalEdits((prev) => ({
        ...prev,
        [approval.id]: {
          ...current,
          [field]: value,
        },
      }));
    };

    const approveUpdateRequest = async (approval, options = {}) => {
      if (!approval?.id) return;
      const approvalType = normalizeApprovalType(approval.type);
      const fieldByType = {
        profile: 'profileData',
        bank: 'bankDetailsData',
        rates: 'ratesData',
        header: 'hindiHeaderData',
        deliveryArea: 'deliveryAreaUpdates',
        deliveryStaff: 'deliveryStaffUpdates',
      };
      const targetField = fieldByType[approvalType];
      if (!targetField && approvalType !== 'planUpgrade' && approvalType !== 'dictionary') {
        alert(`Unsupported approval type: ${approval.type || 'unknown'}`);
        return;
      }
      if (!options.skipConfirm && !confirmAdminAction(`Approve ${approval.type || 'update'} request for ${approval.dealerCode || 'this dealer'}?`)) return;
      try {
        const targetUser = users.find((u) => u.id === approval.userId || String(u?.dealerCode || '').trim() === String(approval?.dealerCode || '').trim());
        if (!targetUser?.id) {
          alert('User not found for approval.');
          return;
        }
        const nextStatus = { ...(targetUser.approvalStatus || {}), [approvalType]: 'approved' };
        if (approvalType === 'rates') {
          nextStatus.rate = 'approved';
          nextStatus.ratesData = 'approved';
        }
        if (approvalType === 'profile') {
          nextStatus.profileData = 'approved';
        }
        if (approvalType === 'bank') {
          nextStatus.bankDetailsData = 'approved';
        }
        if (approvalType === 'header') {
          nextStatus.hindiHeaderData = 'approved';
        }
        if (approvalType === 'dictionary') {
          const dictionaryPayload = getDictionaryApprovalPayload(approval);
          const englishWord = String(dictionaryPayload?.englishWord || dictionaryPayload?.eng || '').trim();
          const hindiTranslation = String(dictionaryPayload?.hindiTranslation || dictionaryPayload?.hin || '').trim();
          if (!englishWord || !hindiTranslation) {
            alert('Dictionary request needs both English word and Hindi translation.');
            return;
          }
          const nextDict = { ...translationDictionary, [englishWord]: hindiTranslation };
          await setDoc(doc(db, 'settings', 'translationDictionary'), nextDict);
          await setDoc(doc(db, 'translationDictionary', getDictionaryDocId(englishWord)), {
            englishWord,
            hindiTranslation,
            dealerCode: approval.dealerCode || targetUser.dealerCode || '',
            dealerName: approval.dealerName || targetUser.dealerName || '',
            approvalId: approval.id || '',
            status: 'approved',
            approvedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setTranslationDictionary(nextDict);
          const nextPendingDictionaryRequests = (Array.isArray(targetUser.pendingDictionaryRequests) ? targetUser.pendingDictionaryRequests : [])
            .filter((request) => {
              const matchesRequest = request?.approvalId === approval.id
                || request?.approvalId === approval.approvalId
                || request?.id === dictionaryPayload?.clientRequestId
                || request?.payload?.clientRequestId === dictionaryPayload?.clientRequestId;
              return !matchesRequest;
            });
          await updateDoc(doc(db, 'users', targetUser.id), {
            dictionaryPendingCount: Math.max(0, nextPendingDictionaryRequests.length),
            pendingDictionaryRequests: nextPendingDictionaryRequests,
            updatedAt: serverTimestamp(),
          });
          const approvalDocId = approval.source === 'userDoc' ? approval.approvalId : approval.id;
          if (approvalDocId) {
            try {
              await deleteDoc(doc(db, 'updateApprovals', approvalDocId));
            } catch (error) {
              void error;
            }
          }
        } else if (approvalType === 'planUpgrade') {
          const nextPackage = approval.payload?.package || approval.payload?.selectedPackage || '';
          if (!nextPackage) {
            alert('Plan upgrade request has no selected package.');
            return;
          }
          const validity = computeValidityDates(nextPackage);
          await updateDoc(doc(db, 'users', targetUser.id), {
            package: nextPackage,
            packageDays: validity.packageDays,
            validFrom: validity.validFrom,
            validTill: validity.validTill,
            status: 'active',
            approvalStatus: nextStatus,
            [`pendingUpdates.${approvalType}.status`]: 'approved',
            [`pendingUpdates.${approvalType}.approvedAt`]: new Date().toISOString(),
            updatedAt: serverTimestamp(),
          });
        } else if (approvalType === 'deliveryArea' || approvalType === 'deliveryStaff') {
          const existingUpdates = Array.isArray(targetUser[targetField]) ? targetUser[targetField] : [];
          const incomingUpdates = Array.isArray(approval.payload) ? approval.payload : [approval.payload];
          const nextUpdates = [...existingUpdates];

          incomingUpdates.forEach((entry) => {
            const english = String(entry.englishWord || entry.english || '').trim();
            const hindi = String(entry.hindiTranslation || entry.hindi || '').trim();
            if (!english || !hindi) return;
            const existingIndex = nextUpdates.findIndex((current) => String(current?.englishWord || current?.english || '').trim().toLowerCase() === english.toLowerCase());
            if (existingIndex >= 0) {
              nextUpdates[existingIndex] = { englishWord: english, hindiTranslation: hindi };
            } else {
              nextUpdates.push({ englishWord: english, hindiTranslation: hindi });
            }
          });

          await updateDoc(doc(db, 'users', targetUser.id), {
            [targetField]: nextUpdates,
            approvalStatus: nextStatus,
            [`pendingUpdates.${approvalType}.status`]: 'approved',
            [`pendingUpdates.${approvalType}.approvedAt`]: new Date().toISOString(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, 'users', targetUser.id), {
            [targetField]: approval.payload,
            approvalStatus: nextStatus,
            [`pendingUpdates.${approvalType}.status`]: 'approved',
            [`pendingUpdates.${approvalType}.approvedAt`]: new Date().toISOString(),
            updatedAt: serverTimestamp(),
          });
        }
        if (approval.source !== 'userDoc' && approvalType !== 'dictionary') {
          try {
            await updateDoc(doc(db, 'updateApprovals', approval.id), {
              status: 'approved',
              approvedAt: serverTimestamp(),
            });
        } catch (e) { void e; }
        }
        setDictionaryApprovalEdits((prev) => {
          const next = { ...prev };
          delete next[approval.id];
          return next;
        });
        setHiddenApprovalIds((prev) => (prev.includes(approval.id) ? prev : [...prev, approval.id]));
        await loadData();
        logAdminActivity('update_approved', { id: approval.id, dealerCode: approval.dealerCode || '', type: approval.type || '' });
        if (!options.skipAlert) {
          alert('Request approved successfully.');
        }
      } catch {
        alert('Approval failed.');
      }
    };

    const rejectUpdateRequest = async (approval, options = {}) => {
      if (!approval?.id) return;
      const approvalType = normalizeApprovalType(approval.type);
      if (!options.skipConfirm && !confirmAdminAction(`Reject ${approval.type || 'update'} request for ${approval.dealerCode || 'this dealer'}?`)) return;
      try {
        const targetUser = users.find((u) => u.id === approval.userId || String(u?.dealerCode || '').trim() === String(approval?.dealerCode || '').trim());
        if (targetUser?.id) {
          const nextStatus = { ...(targetUser.approvalStatus || {}), [approvalType]: 'rejected' };
          if (approvalType === 'rates') {
            nextStatus.rate = 'rejected';
            nextStatus.ratesData = 'rejected';
          }
          if (approvalType === 'profile') {
            nextStatus.profileData = 'rejected';
          }
          if (approvalType === 'bank') {
            nextStatus.bankDetailsData = 'rejected';
          }
          if (approvalType === 'header') {
            nextStatus.hindiHeaderData = 'rejected';
          }
          if (approvalType === 'dictionary') {
            const dictionaryPayload = getDictionaryApprovalPayload(approval);
            const nextPendingDictionaryRequests = (Array.isArray(targetUser.pendingDictionaryRequests) ? targetUser.pendingDictionaryRequests : [])
              .filter((request) => {
                const matchesRequest = request?.approvalId === approval.id
                  || request?.approvalId === approval.approvalId
                  || request?.id === dictionaryPayload?.clientRequestId
                  || request?.payload?.clientRequestId === dictionaryPayload?.clientRequestId;
                return !matchesRequest;
              });
            await updateDoc(doc(db, 'users', targetUser.id), {
              dictionaryPendingCount: Math.max(0, nextPendingDictionaryRequests.length),
              pendingDictionaryRequests: nextPendingDictionaryRequests,
              updatedAt: serverTimestamp(),
            });
          } else {
            await updateDoc(doc(db, 'users', targetUser.id), {
              approvalStatus: nextStatus,
              [`pendingUpdates.${approvalType}.status`]: 'rejected',
              [`pendingUpdates.${approvalType}.rejectedAt`]: new Date().toISOString(),
              updatedAt: serverTimestamp(),
            });
          }
        }
        const approvalDocId = approval.source === 'userDoc' ? approval.approvalId : approval.id;
        if (approvalDocId) {
          try {
            await deleteDoc(doc(db, 'updateApprovals', approvalDocId));
          } catch (error) {
            void error;
          }
        }
        setDictionaryApprovalEdits((prev) => {
          const next = { ...prev };
          delete next[approval.id];
          return next;
        });
        setHiddenApprovalIds((prev) => (prev.includes(approval.id) ? prev : [...prev, approval.id]));
        await loadData();
        logAdminActivity('update_rejected', { id: approval.id, dealerCode: approval.dealerCode || '', type: approval.type || '' });
      } catch {
        alert('Reject failed.');
      }
    };

    const toggleFeedbackRead = async (item) => {
      const nextRead = !item?.read;
      try {
        if (item?.id) {
          try {
            await updateDoc(doc(db, 'feedback', item.id), {
              read: nextRead,
              updatedAt: serverTimestamp(),
            });
        } catch (e) { void e; }
        }
        const nextFeedback = feedback.map((f) => (f.id === item.id ? { ...f, read: nextRead } : f));
        setFeedback(nextFeedback);
        localStorage.setItem('feedbackData', JSON.stringify(nextFeedback));
        logAdminActivity('feedback_read_toggle', { id: item.id, read: nextRead });
      } catch {
        alert('Unable to update feedback status.');
      }
    };

    const deleteFeedbackItem = async (item) => {
      const targetUser = users.find((u) => u.id === item?.userId || String(u?.dealerCode || '').trim() === String(item?.dealerCode || '').trim());
      if (!confirmAdminAction(`Delete feedback from ${item?.dealerCode || 'this user'}?`)) return;
      try {
        if (item?.source !== 'userDoc' && item?.id && !String(item.id).startsWith('userfb-')) {
          try {
            await deleteDoc(doc(db, 'feedback', item.id));
          } catch (e) { void e; }
        }

        if (targetUser?.id) {
          const existingEntries = Array.isArray(targetUser.feedbackEntries) ? targetUser.feedbackEntries : [];
          const filteredEntries = existingEntries.filter((entry) => {
            if (item?.clientFeedbackId) {
              return entry?.clientFeedbackId !== item.clientFeedbackId;
            }
            return String(entry?.text || '') !== String(item?.text || '') || String(entry?.createdAt || '') !== String(item?.createdAt || '');
          });
          try {
            await updateDoc(doc(db, 'users', targetUser.id), {
              feedbackEntries: filteredEntries,
              updatedAt: serverTimestamp(),
            });
          } catch (e) { void e; }
          const nextUsers = users.map((u) => (u.id === targetUser.id ? { ...u, feedbackEntries: filteredEntries } : u));
          writeUsersLocal(nextUsers);
        }

        const nextFeedback = feedback.filter((f) => {
          if (item?.clientFeedbackId && f?.clientFeedbackId) {
            return f.clientFeedbackId !== item.clientFeedbackId;
          }
          return f.id !== item.id;
        });
        setFeedback(nextFeedback);
        localStorage.setItem('feedbackData', JSON.stringify(nextFeedback));
        logAdminActivity('feedback_deleted', { id: item.id, dealerCode: item?.dealerCode || '' });
      } catch {
        alert('Unable to delete feedback.');
      }
    };

    const updateFeedbackMeta = async (item, patch) => {
      const nextFeedback = feedback.map((f) => (f.id === item.id ? { ...f, ...patch } : f));
      setFeedback(nextFeedback);
      localStorage.setItem('feedbackData', JSON.stringify(nextFeedback));
      const nextOverrides = { ...feedbackMetaOverrides, [item.id]: { ...(feedbackMetaOverrides[item.id] || {}), ...patch } };
      persistFeedbackMetaOverrides(nextOverrides);
      try {
        if (item?.id && item?.source !== 'userDoc' && !String(item.id).startsWith('userfb-')) {
          await updateDoc(doc(db, 'feedback', item.id), { ...patch, updatedAt: serverTimestamp() });
        }
      } catch (e) { void e; }
    };

    const setFeedbackPriority = async (item, priority) => {
      await updateFeedbackMeta(item, { priority });
      logAdminActivity('feedback_priority', { id: item.id, priority });
    };

    const toggleFeedbackResolved = async (item) => {
      const resolved = !item?.resolved;
      await updateFeedbackMeta(item, { resolved });
      logAdminActivity('feedback_resolved', { id: item.id, resolved });
    };

    const openDetailView = (user, type) => {
      if (type === 'profile') {
        setDetailView({ title: `Profile - ${user?.dealerCode || ''}`, data: user?.profileData || {}, noteKey: `user:${user?.id || user?.dealerCode}:profile` });
        return;
      }
      if (type === 'bank') {
        setDetailView({ title: `Bank - ${user?.dealerCode || ''}`, data: user?.bankDetailsData || {}, noteKey: `user:${user?.id || user?.dealerCode}:bank` });
        return;
      }
      if (type === 'header') {
        setDetailView({ title: `Header - ${user?.dealerCode || ''}`, data: user?.hindiHeaderData || {}, noteKey: `user:${user?.id || user?.dealerCode}:header` });
        return;
      }
      setDetailView({ title: `Rates - ${user?.dealerCode || ''}`, data: user?.ratesData || [], noteKey: `user:${user?.id || user?.dealerCode}:rates` });
    };

    const pendingRegistrationRequests = requests.filter((r) => {
      if ((r.status || 'pending') !== 'pending') return false;
      // Agar user already create ho chuka hai aur active/disabled/expired hai, toh request hide karein
      const isAlreadyVerified = users.some((u) => String(u?.dealerCode || '').trim() === String(r?.dealerCode || '').trim() && u.status !== 'pending');
      if (isAlreadyVerified) return false;
      return true;
    });
    const pendingCount = pendingRegistrationRequests.length;
    const activeUsers = users.filter((u) => u.status === 'active').length;
    const activeUsersList = users.filter((u) => u.status === 'active');
    const disabledUsers = users.filter((u) => u.status === 'disabled').length;
    const unreadFeedbackCount = feedback.filter((item) => !item?.read).length;
    const approvalTypeCounts = combinedPendingApprovals.reduce((acc, item) => {
      const key = normalizeApprovalType(item?.type);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const expiringUsers = users
      .filter((u) => u.status === 'active')
      .map((u) => ({ ...u, remainingDays: getRemainingDays(u.validTill) }))
      .filter((u) => u.remainingDays !== null && u.remainingDays >= 0 && u.remainingDays <= 7)
      .sort((a, b) => a.remainingDays - b.remainingDays);
    const searchLower = adminSearchTerm.trim().toLowerCase();
    const rangeDaysMap = { today: 0, '7d': 7, '30d': 30 };
    const isWithinAdminDateRange = (value) => {
      if (adminDateRange === 'all') return true;
      const date = new Date(value || '');
      if (Number.isNaN(date.getTime())) return false;
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (adminDateRange === 'today') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        return date >= start && date <= today;
      }
      const days = rangeDaysMap[adminDateRange];
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - days);
      return date >= start && date <= today;
    };
    const matchesAdminSearch = (values) => {
      if (!searchLower) return true;
      return values.some((value) => String(value || '').toLowerCase().includes(searchLower));
    };
    const filteredPendingRegistrationRequests = pendingRegistrationRequests.filter((r) =>
      isWithinAdminDateRange(r.createdAt || r.approvedAt) &&
      (adminSubFilter === 'all' || String(r.package || '') === adminSubFilter) &&
      matchesAdminSearch([r.dealerCode, r.dealerName, r.mobile, r.email, r.package])
    );
    const filteredUsersList = (activeAdminTab === 'active-user' ? activeUsersList : users).filter((u) => {
      const matchesSubFilter = adminSubFilter === 'all'
        || (adminSubFilter === 'expiring' && getRemainingDays(u.validTill) !== null && getRemainingDays(u.validTill) >= 0 && getRemainingDays(u.validTill) <= 7)
        || String(u.status || '').toLowerCase() === adminSubFilter
        || String(u.role || '').toLowerCase() === adminSubFilter;
      return isWithinAdminDateRange(u.createdAt || u.approvedAt || u.updatedAt)
        && matchesSubFilter
        && matchesAdminSearch([u.dealerCode, u.dealerName, u.mobile, u.email, u.package, u.pin, u.status, u.role]);
    });
    const filteredApprovals = nonDictionaryPendingApprovals.filter((a) =>
      isWithinAdminDateRange(a.requestedAt || a.approvedAt || a.rejectedAt) &&
      (adminSubFilter === 'all' || normalizeApprovalType(a.type) === adminSubFilter) &&
      matchesAdminSearch([a.dealerCode, a.dealerName, a.type, a.requestedAt])
    );
    const activeDictionaryApprovals = dictionaryRequestView === 'duplicate' ? duplicateDictionaryApprovals : newDictionaryApprovals;
    const filteredDictionaryApprovals = activeDictionaryApprovals.filter((a) =>
      isWithinAdminDateRange(a.requestedAt || a.approvedAt || a.rejectedAt) &&
      matchesAdminSearch([
        a.dealerCode,
        a.dealerName,
        a.type,
        a.requestedAt,
        a.payload?.englishWord,
        a.payload?.hindiTranslation,
      ])
    );
    const filteredFeedback = feedback.filter((f) => {
      const priority = String(f.priority || 'medium').toLowerCase();
      const feedbackState = f.resolved ? 'resolved' : (f.read ? 'read' : 'unread');
      const matchesSubFilter = adminSubFilter === 'all'
        || adminSubFilter === priority
        || adminSubFilter === feedbackState
        || (adminSubFilter === 'open' && !f.resolved);
      return isWithinAdminDateRange(f.createdAt || f.date) &&
        matchesSubFilter &&
        matchesAdminSearch([f.dealerCode, f.dealerName, f.email, f.text, f.createdAt, f.date, f.read ? 'read' : 'unread', priority, f.resolved ? 'resolved' : 'open']);
    });
    const currentTabRows = activeAdminTab === 'pending-registration'
      ? filteredPendingRegistrationRequests
      : activeAdminTab === 'approval'
        ? filteredApprovals
        : activeAdminTab === 'feedback'
          ? filteredFeedback
          : (activeAdminTab === 'active-user' || activeAdminTab === 'total-user')
            ? filteredUsersList
            : activeAdminTab === 'dictionary'
              ? filteredDictionaryApprovals
            : activeAdminTab === 'recycle-bin'
              ? deletedUsersBin
              : activeAdminTab === 'audit'
                ? auditTrail
                : [];
    const adminTotalPages = Math.max(1, Math.ceil(currentTabRows.length / adminItemsPerPage));
    const pagedPendingRegistrationRequests = paginateAdminRows(filteredPendingRegistrationRequests, adminItemsPerPage, adminCurrentPage);
    const pagedUsersList = paginateAdminRows(filteredUsersList, adminItemsPerPage, adminCurrentPage);
    const pagedApprovals = paginateAdminRows(filteredApprovals, adminItemsPerPage, adminCurrentPage);
    const pagedDictionaryApprovals = paginateAdminRows(filteredDictionaryApprovals, adminItemsPerPage, adminCurrentPage);
    const pagedFeedback = paginateAdminRows(filteredFeedback, adminItemsPerPage, adminCurrentPage);
    const pagedDeletedUsers = paginateAdminRows(deletedUsersBin, adminItemsPerPage, adminCurrentPage);
    const pagedAuditTrail = paginateAdminRows(auditTrail, adminItemsPerPage, adminCurrentPage);
    const notifications = [
      pendingCount > 0 ? { id: 'pending-requests', text: `${pendingCount} registration requests pending`, tone: 'blue' } : null,
      nonDictionaryPendingApprovals.length > 0 ? { id: 'pending-approvals', text: `${nonDictionaryPendingApprovals.length} approval requests waiting`, tone: 'amber' } : null,
      dictionaryPendingApprovals.length > 0 ? { id: 'pending-dictionary', text: `${dictionaryPendingApprovals.length} dictionary requests waiting`, tone: 'blue' } : null,
      expiringUsers.length > 0 ? { id: 'expiring-users', text: `${expiringUsers.length} active users expiring within 7 days`, tone: 'rose' } : null,
      unreadFeedbackCount > 0 ? { id: 'unread-feedback', text: `${unreadFeedbackCount} unread feedback messages`, tone: 'green' } : null,
    ].filter(Boolean);
    const exportRowsAsCsv = (filename, rows) => {
      if (!Array.isArray(rows) || rows.length === 0) {
        alert('No data available to export.');
        return;
      }
      const columns = Array.from(
        rows.reduce((set, row) => {
          Object.keys(row || {}).forEach((key) => set.add(key));
          return set;
        }, new Set())
      );
      const escapeCell = (value) => {
        const text = String(value ?? '');
        if (/[",\n]/.test(text)) {
          return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
      };
      const csv = [
        columns.join(','),
        ...rows.map((row) => columns.map((column) => escapeCell(row?.[column])).join(',')),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };
    const adminStats = [
      { label: 'Pending Registration', value: pendingCount, tone: 'blue' },
      { label: 'Pending Approval', value: nonDictionaryPendingApprovals.length, tone: 'amber' },
      { label: 'Dictionary Requests', value: dictionaryPendingApprovals.length, tone: 'blue' },
      { label: 'Active Users', value: activeUsers, tone: 'green' },
      { label: 'Total Users', value: users.length, tone: 'navy' },
      { label: 'Disabled Users', value: disabledUsers, tone: 'slate' },
      { label: 'Unread Feedback', value: unreadFeedbackCount, tone: 'rose' },
    ];
    const countItemsInDays = (items, getDateValue, days) => {
      const now = new Date();
      now.setHours(23, 59, 59, 999);
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - days);
      return items.filter((item) => {
        const raw = getDateValue(item);
        const date = new Date(raw || '');
        return !Number.isNaN(date.getTime()) && date >= start && date <= now;
      }).length;
    };
    const dateSummaryCards = [
      { label: 'Today', value: countItemsInDays(requests, (item) => item.createdAt || item.approvedAt, 0) },
      { label: '7 Days', value: countItemsInDays(requests, (item) => item.createdAt || item.approvedAt, 7) },
      { label: '30 Days', value: countItemsInDays(requests, (item) => item.createdAt || item.approvedAt, 30) },
    ];
    const adminTabs = [
      { key: 'dashboard', label: 'Dashboard', count: null },
      { key: 'dictionary', label: 'Dictionary', count: dictionaryPendingApprovals.length },
      { key: 'pending-registration', label: 'Pending Registration', count: pendingCount },
      { key: 'approval', label: 'Approval', count: nonDictionaryPendingApprovals.length },
      { key: 'active-user', label: 'Active User', count: activeUsersList.length },
      { key: 'total-user', label: 'Total User', count: users.length },
      { key: 'create-user', label: 'Create User', count: null },
      { key: 'feedback', label: 'Feedback', count: unreadFeedbackCount },
      { key: 'recycle-bin', label: 'Recycle Bin', count: deletedUsersBin.length },
      { key: 'audit', label: 'Audit', count: auditTrail.length },
    ];
    const approvalSummaryCards = [
      { label: 'Profile', value: approvalTypeCounts.profile || 0 },
      { label: 'Bank', value: approvalTypeCounts.bank || 0 },
      { label: 'Rates', value: approvalTypeCounts.rates || 0 },
      { label: 'Header', value: approvalTypeCounts.header || 0 },
      { label: 'Plan Upgrade', value: approvalTypeCounts.planUpgrade || 0 },
    ];
    const adminSubFilterOptions = {
      'pending-registration': [{ value: 'all', label: 'All Packages' }, ...PACKAGE_OPTIONS.map((pkg) => ({ value: pkg, label: pkg }))],
      'approval': [
        { value: 'all', label: 'All Approval Types' },
        { value: 'profile', label: 'Profile' },
        { value: 'bank', label: 'Bank' },
        { value: 'rates', label: 'Rates' },
        { value: 'header', label: 'Header' },
        { value: 'planUpgrade', label: 'Plan Upgrade' },
      ],
      'active-user': [
        { value: 'all', label: 'All Users' },
        { value: 'active', label: 'Active' },
        { value: 'disabled', label: 'Disabled' },
        { value: 'expired', label: 'Expired' },
        { value: 'admin', label: 'Admin Role' },
        { value: 'operator', label: 'Operator Role' },
        { value: 'viewer', label: 'Viewer Role' },
        { value: 'expiring', label: 'Expiring Soon' },
      ],
      'total-user': [
        { value: 'all', label: 'All Users' },
        { value: 'active', label: 'Active' },
        { value: 'disabled', label: 'Disabled' },
        { value: 'expired', label: 'Expired' },
        { value: 'admin', label: 'Admin Role' },
        { value: 'operator', label: 'Operator Role' },
        { value: 'viewer', label: 'Viewer Role' },
        { value: 'expiring', label: 'Expiring Soon' },
      ],
      'feedback': [
        { value: 'all', label: 'All Feedback' },
        { value: 'unread', label: 'Unread' },
        { value: 'read', label: 'Read' },
        { value: 'open', label: 'Open' },
        { value: 'resolved', label: 'Resolved' },
        { value: 'high', label: 'High Priority' },
        { value: 'medium', label: 'Medium Priority' },
        { value: 'low', label: 'Low Priority' },
      ],
      'dictionary': [{ value: 'all', label: 'No extra filter' }],
      'create-user': [{ value: 'all', label: 'No extra filter' }],
    };
    const currentTabMeta = {
      dashboard: {
        title: 'Admin Dashboard',
        subtitle: 'Analytics, alerts, notifications, and quick admin control.',
      },
      'pending-registration': {
        title: 'Pending Registration Requests',
        subtitle: `${filteredPendingRegistrationRequests.length} visible requests`,
      },
      'approval': {
        title: 'Approval Queue',
        subtitle: `${filteredApprovals.length} pending updates waiting for action`,
      },
      'active-user': {
        title: 'Active Users',
        subtitle: `${filteredUsersList.length} active users currently visible`,
      },
      'total-user': {
        title: 'All Users',
        subtitle: `${filteredUsersList.length} users currently visible`,
      },
      'create-user': {
        title: 'Create User',
        subtitle: 'Manually add a distributor login with package and role.',
      },
      'feedback': {
        title: 'Feedback Inbox',
        subtitle: `${filteredFeedback.length} feedback entries currently visible`,
      },
      'dictionary': {
        title: 'Translation Dictionary',
        subtitle: `${newDictionaryApprovals.length} new requests, ${duplicateDictionaryApprovals.length} duplicate requests waiting.`,
      },
      'recycle-bin': {
        title: 'Recycle Bin',
        subtitle: `${deletedUsersBin.length} deleted users available for restore`,
      },
      audit: {
        title: 'Audit Trail',
        subtitle: `${auditTrail.length} recent admin events recorded`,
      },
    }[activeAdminTab];
    const activeDrawer = detailView
      ? { ...detailView, type: 'detail' }
      : viewApproval
        ? { title: `Approval - ${viewApproval?.dealerCode || ''}`, data: viewApproval?.payload || {}, noteKey: `approval:${viewApproval?.id || ''}`, type: 'approval' }
        : viewRequest
          ? { title: `Request - ${viewRequest?.dealerCode || ''}`, data: viewRequest || {}, noteKey: `request:${viewRequest?.id || ''}`, type: 'request' }
          : null;
    const activeSubFilterOptions = adminSubFilterOptions[activeAdminTab] || [{ value: 'all', label: 'All' }];

    const bulkApproveRegistrations = async () => {
      if (selectedRequestIds.length === 0) return;
      if (!confirmAdminAction(`Approve ${selectedRequestIds.length} selected registration requests?`)) return;
      for (const id of selectedRequestIds) {
        await approveRequest(id, { skipConfirm: true });
      }
      clearSelectedRequestIds();
    };
    const bulkRejectRegistrations = async () => {
      if (selectedRequestIds.length === 0) return;
      if (!confirmAdminAction(`Reject ${selectedRequestIds.length} selected registration requests?`)) return;
      for (const id of selectedRequestIds) {
        await rejectRequest(id, { skipConfirm: true });
      }
      clearSelectedRequestIds();
    };
    const bulkApproveUpdates = async () => {
      const targets = filteredApprovals.filter((item) => selectedApprovalIds.includes(item.id));
      if (targets.length === 0) return;
      if (!confirmAdminAction(`Approve ${targets.length} selected update requests?`)) return;
      for (const item of targets) {
        await approveUpdateRequest(item, { skipConfirm: true, skipAlert: true });
      }
      clearSelectedApprovalIds();
      alert(`${targets.length} requests approved.`);
    };
    const bulkRejectUpdates = async () => {
      const targets = filteredApprovals.filter((item) => selectedApprovalIds.includes(item.id));
      if (targets.length === 0) return;
      if (!confirmAdminAction(`Reject ${targets.length} selected update requests?`)) return;
      for (const item of targets) {
        await rejectUpdateRequest(item, { skipConfirm: true, skipAlert: true });
      }
      clearSelectedApprovalIds();
      alert(`${targets.length} requests rejected.`);
    };
    const bulkApproveDictionaryRequests = async () => {
      const targets = filteredDictionaryApprovals.filter((item) => selectedApprovalIds.includes(item.id));
      if (targets.length === 0) return;
      if (!confirmAdminAction(`Approve ${targets.length} selected dictionary requests?`)) return;
      for (const item of targets) {
        await approveUpdateRequest(item, { skipConfirm: true, skipAlert: true });
      }
      clearSelectedApprovalIds();
      alert(`${targets.length} dictionary requests approved.`);
    };
    const bulkRejectDictionaryRequests = async () => {
      const targets = filteredDictionaryApprovals.filter((item) => selectedApprovalIds.includes(item.id));
      if (targets.length === 0) return;
      if (!confirmAdminAction(`Reject ${targets.length} selected dictionary requests?`)) return;
      for (const item of targets) {
        await rejectUpdateRequest(item, { skipConfirm: true, skipAlert: true });
      }
      clearSelectedApprovalIds();
      alert(`${targets.length} dictionary requests rejected.`);
    };
    const bulkToggleUsers = async () => {
      const targets = filteredUsersList.filter((u) => selectedUserTokens.includes(resolveEditToken(u)));
      if (targets.length === 0) return;
      if (!confirmAdminAction(`Toggle status for ${targets.length} selected users?`)) return;
      for (const item of targets) {
        await toggleUserStatus(item, { skipConfirm: true });
      }
      clearSelectedUserTokens();
    };

    const saveDictionaryRowsToFirebase = async (rows, source = 'admin') => {
      const entries = rows
        .map((row) => ({
          englishWord: String(row.englishWord || row['English Word'] || row.English || row.english || row.Word || row.word || '').trim(),
          hindiTranslation: String(row.hindiTranslation || row['Hindi Translation'] || row.Hindi || row.hindi || row.Translation || row.translation || '').trim(),
        }))
        .filter((row) => row.englishWord && row.hindiTranslation);

      if (entries.length === 0) {
        alert('No valid dictionary rows found. Use columns like English Word and Hindi Translation.');
        return;
      }

      const nextDict = entries.reduce((acc, item) => {
        acc[item.englishWord] = item.hindiTranslation;
        return acc;
      }, { ...translationDictionary });

      await setDoc(doc(db, 'settings', 'translationDictionary'), nextDict);
      await Promise.all(entries.map((item) => setDoc(doc(db, 'translationDictionary', getDictionaryDocId(item.englishWord)), {
        englishWord: item.englishWord,
        hindiTranslation: item.hindiTranslation,
        source,
        status: 'approved',
        updatedAt: serverTimestamp(),
      })));
      setTranslationDictionary(nextDict);
      logAdminActivity('dictionary_bulk_imported', { count: entries.length, source });
      alert(`${entries.length} dictionary words saved to Firebase.`);
    };

    const handleDictionaryImport = async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const { default: XLSX } = await import('xlsx');
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(worksheet);
            await saveDictionaryRowsToFirebase(rows, 'admin-excel');
          } catch {
            alert('Dictionary import failed.');
          }
        };
        reader.readAsArrayBuffer(file);
      } catch {
        alert('Dictionary import failed.');
      } finally {
        event.target.value = null;
      }
    };

    useEffect(() => {
      setAdminNotifications(notifications);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingCount, nonDictionaryPendingApprovals.length, dictionaryPendingApprovals.length, expiringUsers.length, unreadFeedbackCount]);

    useEffect(() => {
      setAdminCurrentPage((prev) => Math.min(prev, adminTotalPages));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [adminTotalPages]);

    return (
      <div className="placeholder-container admin-panel">
        <div className="admin-header">
          <div className="admin-header-copy">
            <div className="admin-kicker">Control Center</div>
            <h2>Admin Panel</h2>
            <p>Registrations, approvals, users, and feedback ko ek jagah se manage kijiye.</p>
          </div>
          <div className="admin-header-actions">
            <select className="form-input admin-role-select" value={adminRoleMode} onChange={(e) => setAdminRoleMode(e.target.value)}>
              <option value="super-admin">Super Admin</option>
              <option value="approval-admin">Approval Admin</option>
              <option value="support-admin">Support Admin</option>
              <option value="viewer">Viewer</option>
            </select>
            <button className="admin-ghost-btn" onClick={loadData}>Refresh Data</button>
            <button className="admin-logout-btn" onClick={onAdminLogout}>Log Out</button>
          </div>
        </div>

        <div className="admin-notification-strip">
          {adminNotifications.length === 0 ? (
            <span className="admin-notification-item admin-notification-item--green">No urgent admin alerts right now.</span>
          ) : (
            adminNotifications.map((item) => (
              <span key={item.id} className={`admin-notification-item admin-notification-item--${item.tone}`}>{item.text}</span>
            ))
          )}
        </div>

        <div className="admin-overview">
          <div className="admin-grid">
            {adminStats.map((item) => (
              <div key={item.label} className={`admin-card admin-card--${item.tone}`}>
                <div className="admin-stat-label">{item.label}</div>
                <div className="admin-stat-value">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="admin-highlight">
            <div className="admin-highlight-title">Quick Snapshot</div>
            <div className="admin-highlight-value">{pendingCount + nonDictionaryPendingApprovals.length + dictionaryPendingApprovals.length}</div>
            <div className="admin-highlight-text">items need admin action right now</div>
          </div>
        </div>

        <div className="admin-date-summary">
          {dateSummaryCards.map((item) => (
            <div key={item.label} className="admin-date-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>

        <div className="admin-utility-grid">
          <div className="admin-utility-card">
            <div className="admin-utility-head">
              <h3>Approval Summary</h3>
              <span>{nonDictionaryPendingApprovals.length} pending</span>
            </div>
            <div className="admin-mini-stats">
              {approvalSummaryCards.map((item) => (
                <div key={item.label} className="admin-mini-card">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-utility-card">
            <div className="admin-utility-head">
              <h3>Package Expiry Alerts</h3>
              <span>{expiringUsers.length} users</span>
            </div>
            <div className="admin-expiry-list">
              {expiringUsers.length === 0 ? (
                <div className="admin-expiry-empty">No active users expiring in next 7 days.</div>
              ) : (
                expiringUsers.slice(0, 5).map((user) => (
                  <div key={user.id || user.dealerCode} className="admin-expiry-item">
                    <div>
                      <strong>{user.dealerCode || '-'}</strong>
                      <span>{user.dealerName || '-'}</span>
                    </div>
                    <div className="admin-expiry-days">{user.remainingDays}d</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="admin-utility-card">
            <div className="admin-utility-head">
              <h3>Recent Activity</h3>
              <span>{auditTrail.length} logs</span>
            </div>
            <div className="admin-activity-list">
              {auditTrail.length === 0 ? (
                <div className="admin-expiry-empty">No admin activity recorded yet.</div>
              ) : (
                auditTrail.slice(0, 5).map((item) => (
                  <div key={item.id} className="admin-activity-item">
                    <strong>{String(item.action || '').replace(/_/g, ' ')}</strong>
                    <span>{formatDisplayDate(item.createdAt)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="admin-tab-row">
          {adminTabs.map((tab) => (
            <button
              key={tab.key}
              className={activeAdminTab === tab.key ? 'admin-tab active' : 'admin-tab'}
              onClick={() => canAccessTab(tab.key) && setActiveAdminTab(tab.key)}
              disabled={!canAccessTab(tab.key)}
            >
              <span>{tab.label}</span>
              {tab.count !== null && <span className="admin-tab-count">{tab.count}</span>}
            </button>
          ))}
        </div>

        <div className="admin-toolbar">
          <div className="admin-toolbar-copy">
            <h3>{currentTabMeta.title}</h3>
            <p>{currentTabMeta.subtitle}</p>
          </div>
          <div className="admin-toolbar-actions">
            <div className="admin-range-pills">
              <button className={adminDateRange === 'all' ? 'admin-range-pill active' : 'admin-range-pill'} onClick={() => setAdminDateRange('all')}>All</button>
              <button className={adminDateRange === 'today' ? 'admin-range-pill active' : 'admin-range-pill'} onClick={() => setAdminDateRange('today')}>Today</button>
              <button className={adminDateRange === '7d' ? 'admin-range-pill active' : 'admin-range-pill'} onClick={() => setAdminDateRange('7d')}>7 Days</button>
              <button className={adminDateRange === '30d' ? 'admin-range-pill active' : 'admin-range-pill'} onClick={() => setAdminDateRange('30d')}>30 Days</button>
            </div>
            <select className="form-input admin-subfilter-select" value={adminSubFilter} onChange={(e) => setAdminSubFilter(e.target.value)}>
              {activeSubFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button className="admin-ghost-btn" onClick={saveCurrentAdminView}>Save View</button>
            {activeAdminTab === 'pending-registration' && (
              <button className="admin-ghost-btn" onClick={() => exportRowsAsCsv('pending-registrations.csv', filteredPendingRegistrationRequests)}>Export CSV</button>
            )}
            {(activeAdminTab === 'active-user' || activeAdminTab === 'total-user') && (
              <button className="admin-ghost-btn" onClick={() => exportRowsAsCsv('users.csv', filteredUsersList)}>Export CSV</button>
            )}
            {activeAdminTab === 'approval' && (
              <button className="admin-ghost-btn" onClick={() => exportRowsAsCsv('approvals.csv', filteredApprovals)}>Export CSV</button>
            )}
            {activeAdminTab === 'dictionary' && (
              <button className="admin-ghost-btn" onClick={() => exportRowsAsCsv('dictionary-requests.csv', filteredDictionaryApprovals)}>Export CSV</button>
            )}
            {activeAdminTab === 'feedback' && (
              <button className="admin-ghost-btn" onClick={() => exportRowsAsCsv('feedback.csv', filteredFeedback)}>Export CSV</button>
            )}
            {activeAdminTab !== 'create-user' && (
              <input
                className="form-input admin-search-input"
                type="text"
                value={adminSearchTerm}
                onChange={(e) => setAdminSearchTerm(e.target.value)}
                placeholder="Search current tab..."
              />
            )}
          </div>
        </div>

        {savedAdminViews.length > 0 && (
          <div className="admin-saved-views">
            {savedAdminViews.map((view) => (
              <button key={view.id} className="admin-saved-view-chip" onClick={() => applySavedAdminView(view)}>{view.label}</button>
            ))}
          </div>
        )}

        {activeAdminTab === 'dashboard' && (
          <div className="admin-dashboard-grid">
            <div className="admin-section">
              <h3>Registration Trend</h3>
              <div className="admin-chart-bars">
                {dateSummaryCards.map((item) => (
                  <div key={item.label} className="admin-chart-bar">
                    <div className="admin-chart-bar-fill" style={{ height: `${Math.max(18, item.value * 8)}px` }} />
                    <strong>{item.value}</strong>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="admin-section">
              <h3>Package Mix</h3>
              <div className="admin-list-grid">
                {PACKAGE_OPTIONS.map((pkg) => {
                  const count = users.filter((u) => u.package === pkg).length;
                  return (
                    <div key={pkg} className="admin-list-card">
                      <span>{pkg}</span>
                      <strong>{count}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="admin-section">
              <h3>Sync Health</h3>
              <div className="admin-health-grid">
                <div className="admin-health-card">
                  <span>Source</span>
                  <strong>{adminDataHealth.source}</strong>
                </div>
                <div className="admin-health-card">
                  <span>Firebase</span>
                  <strong>{adminDataHealth.firebaseReachable ? 'Connected' : 'Fallback'}</strong>
                </div>
                <div className="admin-health-card">
                  <span>Last Sync</span>
                  <strong>{formatDisplayDate(adminDataHealth.lastSyncAt)}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeAdminTab === 'pending-registration' && (
        <div className="admin-section">
          <div className="admin-bulk-bar">
            <span>{selectedRequestIds.length} selected</span>
            <div className="admin-bulk-actions">
              <button className="admin-ghost-btn" onClick={() => setSelectedRequestIds(filteredPendingRegistrationRequests.map((r) => r.id))}>Select All</button>
              <button className="admin-ghost-btn" onClick={bulkApproveRegistrations}>Bulk Approve</button>
              <button className="admin-ghost-btn" onClick={bulkRejectRegistrations}>Bulk Reject</button>
            </div>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Dealer Code</th>
                  <th>Dealer Name</th>
                  <th>Mobile</th>
                  <th>Email</th>
                  <th>Package</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedPendingRegistrationRequests.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="admin-empty-cell">No registration requests match the current search.</td>
                  </tr>
                ) : (
                  pagedPendingRegistrationRequests.map((r) => (
                    <tr key={r.id}>
                      <td><input type="checkbox" checked={selectedRequestIds.includes(r.id)} onChange={() => toggleRequestSelection(r.id)} /></td>
                      <td>{r.dealerCode || '-'}</td>
                      <td>{r.dealerName || '-'}</td>
                      <td>{r.mobile || '-'}</td>
                      <td>{r.email || '-'}</td>
                      <td><span className="admin-status-chip admin-status-chip--info">{r.package || '-'}</span></td>
                      <td>
                        <div className="admin-actions">
                          <button onClick={() => setViewRequest(r)}>View</button>
                          <button onClick={() => approveRequest(r.id)} disabled={!canMutateAdminData}>Approve</button>
                          <button onClick={() => rejectRequest(r.id)} disabled={!canMutateAdminData}>Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {activeAdminTab === 'create-user' && (
        <div className="admin-section">
          <div className="admin-bulk-bar">
            <span>Bulk Import Users</span>
            <div className="admin-bulk-actions">
              <button className="admin-ghost-btn" onClick={() => adminImportRef.current?.click()}>Import CSV/XLSX</button>
              <input ref={adminImportRef} type="file" accept=".csv,.xlsx" style={{ display: 'none' }} onChange={handleAdminImport} />
            </div>
          </div>
          <div className="admin-form">
            <input className="form-input" placeholder="Dealer Code" value={newUser.dealerCode} onChange={(e) => setNewUser((p) => ({ ...p, dealerCode: e.target.value }))} />
            <input className="form-input" placeholder="Dealer Name" value={newUser.dealerName} onChange={(e) => setNewUser((p) => ({ ...p, dealerName: e.target.value }))} />
            <input className="form-input" placeholder="Mobile" value={newUser.mobile} onChange={(e) => setNewUser((p) => ({ ...p, mobile: e.target.value }))} />
            <input className="form-input" placeholder="Email" type="email" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} />
            <select className="form-input" value={newUser.package} onChange={(e) => setNewUser((p) => ({ ...p, package: e.target.value }))}>
              <option value="">Select Package</option>
              {PACKAGE_OPTIONS.map((pkg) => (
                <option key={pkg} value={pkg}>{pkg}</option>
              ))}
            </select>
            <input className="form-input" type="password" maxLength={6} value={newUser.pin} onChange={(e) => setNewUser((p) => ({ ...p, pin: e.target.value }))} />
            <select className="form-input" value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}>
              <option value="operator">Operator</option>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
            <button onClick={addManualUser} disabled={!canMutateAdminData}>Create User</button>
          </div>
        </div>
        )}

        {(activeAdminTab === 'active-user' || activeAdminTab === 'total-user') && (
        <div className="admin-section">
          <div className="admin-bulk-bar">
            <span>{selectedUserTokens.length} selected</span>
            <div className="admin-bulk-actions">
              <button className="admin-ghost-btn" onClick={() => setSelectedUserTokens(filteredUsersList.map((u) => resolveEditToken(u)))}>Select All</button>
              <button className="admin-ghost-btn" onClick={bulkToggleUsers}>Bulk Toggle Status</button>
            </div>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Email</th>
                  <th>Package</th>
                  <th>Validity</th>
                  <th>Pin</th>
                  <th>Profile Updated</th>
                  <th>Bank Updated</th>
                  <th>Rate Updated</th>
                  <th>Header Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedUsersList.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="admin-empty-cell">No users match the current search.</td>
                  </tr>
                ) : (
                  pagedUsersList.map((u, idx) => (
                    <tr key={u.id || `${u.dealerCode || 'user'}-${idx}`}>
                      <td><input type="checkbox" checked={selectedUserTokens.includes(resolveEditToken(u))} onChange={() => toggleUserSelection(resolveEditToken(u))} /></td>
                      <td>{u.dealerCode || '-'}</td>
                      <td>{u.dealerName || '-'}</td>
                      <td>{u.mobile || '-'}</td>
                      <td>{u.email || '-'}</td>
                      <td><span className="admin-status-chip admin-status-chip--info">{u.package || '-'}</span></td>
                      <td>
                        <span className={`admin-status-chip admin-status-chip--${String(u.status || '').toLowerCase() || 'info'}`}>
                          {u.status || '-'}
                        </span>{' '}
                        {formatDisplayDate(u.validTill)}
                        {getRemainingDays(u.validTill) !== null ? ` (${getRemainingDays(u.validTill)}d)` : ''}
                      </td>
                      <td>{u.pin || '-'}</td>
                      <td>{u.profileData ? <button onClick={() => openDetailView(u, 'profile')}>View</button> : '-'}</td>
                      <td>{u.bankDetailsData ? <button onClick={() => openDetailView(u, 'bank')}>View</button> : '-'}</td>
                      <td>{Array.isArray(u.ratesData) && u.ratesData.length > 0 ? <button onClick={() => openDetailView(u, 'rates')}>View</button> : '-'}</td>
                      <td>{u.hindiHeaderData ? <button onClick={() => openDetailView(u, 'header')}>View</button> : '-'}</td>
                      <td>
                        <div className="admin-actions">
                          <button onClick={() => setDetailView({ title: `User - ${u?.dealerCode || ''}`, data: u, noteKey: `user:${u?.id || u?.dealerCode}:general` })}>View</button>
                          <button onClick={() => startEditUser(u)} disabled={!canMutateAdminData}>Edit</button>
                          <button onClick={() => toggleUserStatus(u)} disabled={!canMutateAdminData}>
                            {u.status === 'active' ? 'Disable' : 'Enable'}
                          </button>
                          <button onClick={() => deleteUser(u)} disabled={!canMutateAdminData}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {editingUserId && (
          <div className="admin-section">
            <h3>Edit User Details</h3>
            <div className="admin-edit-grid">
              <input className="form-input" placeholder="Dealer Code" value={editUser.dealerCode} onChange={(e) => setEditUser((p) => ({ ...p, dealerCode: e.target.value }))} />
              <input className="form-input" placeholder="Dealer Name" value={editUser.dealerName} onChange={(e) => setEditUser((p) => ({ ...p, dealerName: e.target.value }))} />
              <input className="form-input" placeholder="Mobile" value={editUser.mobile} onChange={(e) => setEditUser((p) => ({ ...p, mobile: e.target.value }))} />
              <input className="form-input" placeholder="Email" value={editUser.email} onChange={(e) => setEditUser((p) => ({ ...p, email: e.target.value }))} />
              <select className="form-input" value={editUser.package} onChange={(e) => {
                const newPkg = e.target.value;
                const validity = computeValidityDates(newPkg);
                setEditUser((p) => ({
                  ...p,
                  package: newPkg,
                  validFrom: toDateInputValue(validity.validFrom),
                  validTill: toDateInputValue(validity.validTill)
                }));
              }}>
                <option value="">Select Package</option>
                {PACKAGE_OPTIONS.map((pkg) => (
                  <option key={pkg} value={pkg}>{pkg}</option>
                ))}
              </select>
              <input className="form-input" type="date" value={editUser.validFrom} onChange={(e) => setEditUser((p) => ({ ...p, validFrom: e.target.value }))} />
              <input className="form-input" type="date" value={editUser.validTill} onChange={(e) => setEditUser((p) => ({ ...p, validTill: e.target.value }))} />
              <input className="form-input" placeholder="PIN" value={editUser.pin} onChange={(e) => setEditUser((p) => ({ ...p, pin: e.target.value }))} />
              <select className="form-input" value={editUser.role} onChange={(e) => setEditUser((p) => ({ ...p, role: e.target.value }))}>
                <option value="operator">Operator</option>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
              <select className="form-input" value={editUser.status} onChange={(e) => setEditUser((p) => ({ ...p, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div className="admin-edit-grid admin-edit-grid-profile">
              <input className="form-input" placeholder="Profile Distributor Code" value={editUser.profileData.distributorCode} onChange={(e) => setEditUser((p) => ({ ...p, profileData: { ...p.profileData, distributorCode: e.target.value } }))} />
              <input className="form-input" placeholder="Profile Distributor Name" value={editUser.profileData.distributorName} onChange={(e) => setEditUser((p) => ({ ...p, profileData: { ...p.profileData, distributorName: e.target.value } }))} />
              <input className="form-input" placeholder="Profile Contact" value={editUser.profileData.contact} onChange={(e) => setEditUser((p) => ({ ...p, profileData: { ...p.profileData, contact: e.target.value } }))} />
              <input className="form-input" placeholder="Profile Email" value={editUser.profileData.email} onChange={(e) => setEditUser((p) => ({ ...p, profileData: { ...p.profileData, email: e.target.value } }))} />
              <input className="form-input" placeholder="Profile GST" value={editUser.profileData.gst} onChange={(e) => setEditUser((p) => ({ ...p, profileData: { ...p.profileData, gst: e.target.value } }))} />
              <input className="form-input" placeholder="Profile Address" value={editUser.profileData.address} onChange={(e) => setEditUser((p) => ({ ...p, profileData: { ...p.profileData, address: e.target.value } }))} />
              <input className="form-input" placeholder="Profile Photo Data URL" value={editUser.profileData.photoDataUrl} onChange={(e) => setEditUser((p) => ({ ...p, profileData: { ...p.profileData, photoDataUrl: e.target.value } }))} />
            </div>
            <div className="admin-edit-grid admin-edit-grid-bank">
              <input className="form-input" placeholder="Bank Name" value={editUser.bankDetailsData.bankName} onChange={(e) => setEditUser((p) => ({ ...p, bankDetailsData: { ...p.bankDetailsData, bankName: e.target.value } }))} />
              <input className="form-input" placeholder="Branch" value={editUser.bankDetailsData.branch} onChange={(e) => setEditUser((p) => ({ ...p, bankDetailsData: { ...p.bankDetailsData, branch: e.target.value } }))} />
              <input className="form-input" placeholder="Account No" value={editUser.bankDetailsData.accountNo} onChange={(e) => setEditUser((p) => ({ ...p, bankDetailsData: { ...p.bankDetailsData, accountNo: e.target.value } }))} />
              <input className="form-input" placeholder="IFSC" value={editUser.bankDetailsData.ifsc} onChange={(e) => setEditUser((p) => ({ ...p, bankDetailsData: { ...p.bankDetailsData, ifsc: e.target.value } }))} />
            </div>
            <div className="form-actions">
              <button onClick={saveEditedUser} disabled={!canMutateAdminData}>Save User Changes</button>
              <button onClick={() => setEditingUserId('')}>Cancel</button>
            </div>
          </div>
        )}

        {activeAdminTab === 'approval' && (
          <div className="admin-section">
            <div className="admin-bulk-bar">
              <span>{selectedApprovalIds.length} selected</span>
              <div className="admin-bulk-actions">
                <button className="admin-ghost-btn" onClick={() => setSelectedApprovalIds(filteredApprovals.map((a) => a.id))}>Select All</button>
                <button className="admin-ghost-btn" onClick={bulkApproveUpdates}>Bulk Approve</button>
                <button className="admin-ghost-btn" onClick={bulkRejectUpdates}>Bulk Reject</button>
              </div>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedApprovals.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="admin-empty-cell">No approval requests match the current search.</td>
                    </tr>
                  ) : (
                    pagedApprovals.map((a) => {
                      const approvalType = normalizeApprovalType(a.type);
                      const dictionaryPayload = approvalType === 'dictionary' ? getDictionaryApprovalPayload(a) : null;
                      return (
                        <tr key={a.id}>
                          <td><input type="checkbox" checked={selectedApprovalIds.includes(a.id)} onChange={() => toggleApprovalSelection(a.id)} /></td>
                          <td>{a.dealerCode || '-'}</td>
                          <td>{a.dealerName || '-'}</td>
                          <td>
                            <span className="admin-status-chip admin-status-chip--amber">{a.type || '-'}</span>
                            {approvalType === 'dictionary' && (
                              <div className="dictionary-approval-edit">
                                <input
                                  className="form-input"
                                  value={dictionaryPayload?.englishWord || ''}
                                  onChange={(e) => updateDictionaryApprovalEdit(a, 'englishWord', e.target.value)}
                                  placeholder="English word"
                                />
                                <input
                                  className="form-input"
                                  value={dictionaryPayload?.hindiTranslation || ''}
                                  onChange={(e) => updateDictionaryApprovalEdit(a, 'hindiTranslation', e.target.value)}
                                  placeholder="Hindi translation"
                                />
                              </div>
                            )}
                          </td>
                          <td>{formatDisplayDate(a.requestedAt)}</td>
                          <td>
                            <div className="admin-actions">
                              <button type="button" onClick={() => setViewApproval({ ...a, payload: dictionaryPayload || a.payload })}>View</button>
                              <button type="button" onClick={() => approveUpdateRequest(a)} disabled={!canMutateAdminData}>Approve</button>
                              <button type="button" onClick={() => rejectUpdateRequest(a)} disabled={!canMutateAdminData}>Reject</button>
                              {approvalType === 'planUpgrade' && (
                              <button type="button" className="admin-ghost-btn" onClick={(e) => { e.preventDefault(); openApprovalReplyPopup(a); }} disabled={!canMutateAdminData}>
                                  Approval Reply
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showApprovalReplyPopup && (
          <div className="admin-chat-popup-overlay" role="dialog" aria-modal="true">
            <div className="admin-chat-popup">
              <div className="admin-chat-popup-header">
                <h3>Approval Reply</h3>
                <button type="button" className="admin-chat-popup-close" onClick={closeApprovalReplyPopup}>Close</button>
              </div>
              <div className="admin-chat-popup-body">
                <div className="admin-chat-content" style={{ width: '100%' }}>
                  <div className="admin-chat-conversation">
                    <div className="admin-chat-message user-message">
                      <strong>User Request:</strong>
                      <p>
                        Plan upgrade request from {activeApprovalReply?.dealerCode || 'user'} - {activeApprovalReply?.payload?.package || activeApprovalReply?.payload?.selectedPackage || 'unknown plan'}
                      </p>
                    </div>
                    <div className="admin-chat-message admin-message">
                      <strong>Approval Reply:</strong>
                      <p>{getApprovalReplyMessage(activeApprovalReply) || 'No reply yet.'}</p>
                    </div>
                  </div>
                  <textarea
                    className="form-input"
                    rows="5"
                    value={approvalReplyDraft}
                    onChange={(e) => setApprovalReplyDraft(e.target.value)}
                    placeholder="Type approval reply here"
                  />
                  <div className="admin-chat-actions">
                    <button type="button" className="form-button" onClick={submitApprovalReply}>Send Approval Reply</button>
                    <button type="button" className="form-button secondary" onClick={closeApprovalReplyPopup}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeAdminTab === 'feedback' && (
          <div className="admin-section">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Feedback</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedFeedback.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="admin-empty-cell">No feedback entries match the current search.</td>
                    </tr>
                  ) : (
                    pagedFeedback.map((f, index) => (
                      <tr key={f.id || index}>
                        <td>{f.dealerCode || '-'}</td>
                        <td>{f.dealerName || '-'}</td>
                        <td>{f.email || '-'}</td>
                        <td>
                          <div>{f.text || '-'}</div>
                          {feedbackReplies && (feedbackReplies[f.id] || feedbackReplies[f.clientFeedbackId]) && (
                            <div className="admin-feedback-chat">
                              <div className="admin-feedback-chat-message user-message">
                                <strong>User:</strong>
                                <span>{f.text || '-'}</span>
                              </div>
                              <div className="admin-feedback-chat-message admin-message">
                                <strong>Admin:</strong>
                                <span>{feedbackReplies[f.id] || feedbackReplies[f.clientFeedbackId]}</span>
                              </div>
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="feedback-status-stack">
                            <span className={f.read ? 'feedback-read' : 'feedback-unread'}>{f.read ? 'Read' : 'Unread'}</span>
                            <span className={f.resolved ? 'feedback-read' : 'feedback-unread'}>{f.resolved ? 'Resolved' : 'Open'}</span>
                          </div>
                        </td>
                        <td>{formatDisplayDate(f.createdAt || f.date)}</td>
                        <td>
                          <div className="admin-actions">
                            <select className="form-input admin-inline-select" value={f.priority || 'medium'} onChange={(e) => setFeedbackPriority(f, e.target.value)} disabled={!canMutateAdminData}>
                              <option value="high">High</option>
                              <option value="medium">Medium</option>
                              <option value="low">Low</option>
                            </select>
                            <button type="button" className="admin-ghost-btn" onClick={() => toggleFeedbackResolved(f)} disabled={!canMutateAdminData}>
                              {f.resolved ? 'Reopen' : 'Resolve'}
                            </button>
                            <button type="button" className={f.read ? 'feedback-unread-btn' : 'feedback-read-btn'} onClick={() => toggleFeedbackRead(f)} disabled={!canMutateAdminData}>
                              {f.read ? 'Mark Unread' : 'Mark Read'}
                            </button>
                            <button
                              type="button"
                              className="admin-ghost-btn"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openAdminReplyPopup(f);
                              }}
                              disabled={!canMutateAdminData}
                            >
                              Feedback Reply
                            </button>
                            <button type="button" className="feedback-delete-btn" onClick={() => deleteFeedbackItem(f)} disabled={!canMutateAdminData}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {showAdminReplyPopup && (
              <div className="admin-chat-popup-overlay" role="dialog" aria-modal="true">
                <div className="admin-chat-popup">
                  <div className="admin-chat-popup-header">
                    <h3>Feedback Reply</h3>
                    <button type="button" className="admin-chat-popup-close" onClick={closeAdminReplyPopup}>Close</button>
                  </div>
                  <div className="admin-chat-popup-body">
                    <div className="admin-chat-content" style={{ width: '100%' }}>
                      <div className="admin-chat-conversation" style={{ flexDirection: 'column', gap: '12px' }}>
                        <h4>Chat History</h4>
                        {getConversationHistory(activeAdminFeedback).map((historyItem) => {
                          const replyText = feedbackReplies?.[historyItem.id] || feedbackReplies?.[historyItem.clientFeedbackId];
                          const isSelected = activeAdminFeedback && (historyItem.id === activeAdminFeedback.id || historyItem.clientFeedbackId === activeAdminFeedback.clientFeedbackId);
                          return (
                            <div key={historyItem.id || historyItem.clientFeedbackId || `${historyItem.dealerCode}-${historyItem.createdAt}`}
                              className={`admin-feedback-chat ${isSelected ? 'admin-feedback-chat-selected' : ''}`}
                              style={{ padding: '12px', borderRadius: '8px', background: isSelected ? '#eef6ff' : '#f8f8f8' }}>
                              <div className="admin-feedback-chat-message user-message">
                                <strong>User:</strong>
                                <span>{historyItem.text || historyItem.feedback || 'No message content.'}</span>
                                <small>{formatDisplayDate(historyItem.createdAt || historyItem.date)}</small>
                              </div>
                              <div className="admin-feedback-chat-message admin-message">
                                <strong>Admin:</strong>
                                <span>{replyText || 'No reply yet.'}</span>
                              </div>
                              <div style={{ marginTop: '8px' }}>
                                <button
                                  type="button"
                                  className="form-button admin-chat-history-select"
                                  onClick={() => openAdminReplyPopup(historyItem)}
                                  disabled={isSelected}
                                >
                                  {isSelected ? 'Selected' : 'Feedback Reply'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <textarea
                        className="form-input"
                        rows="5"
                        value={adminReplyDraft}
                        onChange={(e) => setAdminReplyDraft(e.target.value)}
                        placeholder="Type feedback reply here"
                      />
                      <div className="admin-chat-actions">
                        <button type="button" className="form-button" onClick={submitAdminReply}>Send Feedback Reply</button>
                        <button type="button" className="form-button secondary" onClick={closeAdminReplyPopup}>Cancel</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {activeAdminTab === 'dictionary' && (
          <div className="admin-section">
            <div className="admin-bulk-bar">
              <span>{selectedApprovalIds.length} dictionary request selected</span>
              <div className="admin-bulk-actions">
                <button
                  className={`admin-ghost-btn ${dictionaryRequestView === 'new' ? 'dictionary-submenu-active' : ''}`}
                  onClick={() => {
                    setDictionaryRequestView('new');
                    clearSelectedApprovalIds();
                  }}
                >
                  Dictionary ({newDictionaryApprovals.length})
                </button>
                <button
                  className={`admin-ghost-btn ${dictionaryRequestView === 'duplicate' ? 'dictionary-submenu-active' : ''}`}
                  onClick={() => {
                    setDictionaryRequestView('duplicate');
                    clearSelectedApprovalIds();
                  }}
                >
                  Dup-Dictonary ({duplicateDictionaryApprovals.length})
                </button>
                <button className="admin-ghost-btn" onClick={() => dictionaryImportRef.current?.click()} disabled={!canMutateAdminData}>Import Excel</button>
                <input ref={dictionaryImportRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleDictionaryImport} />
                <button className="admin-ghost-btn" onClick={() => setSelectedApprovalIds(filteredDictionaryApprovals.map((a) => a.id))}>Select All Requests</button>
                <button className="admin-ghost-btn" onClick={bulkApproveDictionaryRequests} disabled={!canMutateAdminData}>Bulk Approve</button>
                <button className="admin-ghost-btn" onClick={bulkRejectDictionaryRequests} disabled={!canMutateAdminData}>Bulk Reject</button>
              </div>
            </div>
            <div className="admin-table-wrap" style={{ marginBottom: '20px' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Code</th>
                    <th>Name</th>
                    <th>English Word</th>
                    {dictionaryRequestView === 'duplicate' && <th>Existing Hindi</th>}
                    <th>Hindi Translation</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedDictionaryApprovals.length === 0 ? (
                    <tr><td colSpan={dictionaryRequestView === 'duplicate' ? 8 : 7} className="admin-empty-cell">No dictionary approval requests pending.</td></tr>
                  ) : (
                    pagedDictionaryApprovals.map((a) => {
                      const dictionaryPayload = getDictionaryApprovalPayload(a);
                      const existingEntry = getExistingDictionaryEntry(translationDictionary, dictionaryPayload?.englishWord || dictionaryPayload?.eng);
                      return (
                        <tr key={a.id}>
                          <td><input type="checkbox" checked={selectedApprovalIds.includes(a.id)} onChange={() => toggleApprovalSelection(a.id)} /></td>
                          <td>{a.dealerCode || '-'}</td>
                          <td>{a.dealerName || '-'}</td>
                          <td>
                            <input
                              className="form-input"
                              value={dictionaryPayload?.englishWord || ''}
                              onChange={(e) => updateDictionaryApprovalEdit(a, 'englishWord', e.target.value)}
                              placeholder="English word"
                            />
                          </td>
                          {dictionaryRequestView === 'duplicate' && (
                            <td className="dictionary-existing-value">{existingEntry?.hindiTranslation || '-'}</td>
                          )}
                          <td>
                            <input
                              className="form-input"
                              value={dictionaryPayload?.hindiTranslation || ''}
                              onChange={(e) => updateDictionaryApprovalEdit(a, 'hindiTranslation', e.target.value)}
                              placeholder="Hindi translation"
                            />
                          </td>
                          <td>{formatDisplayDate(a.requestedAt)}</td>
                          <td>
                            <div className="admin-actions">
                              <button onClick={() => setViewApproval({ ...a, payload: dictionaryPayload })}>View</button>
                              <button onClick={() => approveUpdateRequest(a)} disabled={!canMutateAdminData}>Approve</button>
                              <button onClick={() => rejectUpdateRequest(a)} disabled={!canMutateAdminData}>Reject</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeDrawer && (
          <div className="admin-drawer-backdrop" onClick={() => { setViewRequest(null); setViewApproval(null); setDetailView(null); }}>
            <div className="admin-drawer" onClick={(e) => e.stopPropagation()}>
              <div className="admin-drawer-head">
                <div>
                  <h3>{activeDrawer.title}</h3>
                  <p>Detailed data, internal note, and audit-friendly snapshot.</p>
                </div>
                <button className="admin-ghost-btn" onClick={() => { setViewRequest(null); setViewApproval(null); setDetailView(null); }}>Close</button>
              </div>
              <div className="admin-drawer-note">
                <label>Admin Note</label>
                <textarea
                  className="form-textarea"
                  rows="4"
                  value={adminNotes[activeDrawer.noteKey || ''] || ''}
                  onChange={(e) => saveAdminNote(activeDrawer.noteKey || 'general', e.target.value)}
                  placeholder="Write internal note..."
                />
              </div>
              <pre>{JSON.stringify(activeDrawer.data || {}, null, 2)}</pre>
            </div>
          </div>
        )}

        {activeAdminTab === 'recycle-bin' && (
          <div className="admin-section">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Deleted At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedDeletedUsers.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="admin-empty-cell">Recycle bin is empty.</td>
                    </tr>
                  ) : (
                    pagedDeletedUsers.map((user, index) => (
                      <tr key={`${user.id || user.dealerCode}-${index}`}>
                        <td>{user.dealerCode || '-'}</td>
                        <td>{user.dealerName || '-'}</td>
                        <td>{formatDisplayDate(user.deletedAt)}</td>
                        <td>
                          <div className="admin-actions">
                            <button
                              type="button"
                              onClick={() => restoreDeletedUser(
                                user,
                                confirmAdminAction,
                                deletedUsersBin,
                                users,
                                writeUsersLocal,
                                persistDeletedUsersBin,
                                logAdminActivity,
                                loadData,
                              )}
                              disabled={!canMutateAdminData}
                            >Restore</button>
                            <button
                              type="button"
                              onClick={() => permanentlyDeleteBinItem(
                                user,
                                confirmAdminAction,
                                deletedUsersBin,
                                persistDeletedUsersBin,
                                logAdminActivity,
                              )}
                              disabled={!canMutateAdminData}
                            >Permanently Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeAdminTab === 'audit' && (
          <div className="admin-section">
            <div className="admin-bulk-bar">
              <span>{auditTrail.length} audit records</span>
              <div className="admin-bulk-actions">
                <button className="admin-ghost-btn" onClick={() => exportRowsAsCsv('admin-audit.csv', auditTrail)}>Export Audit</button>
              </div>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Date</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedAuditTrail.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="admin-empty-cell">No audit records found.</td>
                    </tr>
                  ) : (
                    pagedAuditTrail.map((item) => (
                      <tr key={item.id}>
                        <td><span className="admin-status-chip admin-status-chip--info">{String(item.action || '').replace(/_/g, ' ')}</span></td>
                        <td>{formatDisplayDate(item.createdAt)}</td>
                        <td>{JSON.stringify(item.details || {})}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {['pending-registration', 'approval', 'dictionary', 'active-user', 'total-user', 'feedback', 'recycle-bin', 'audit'].includes(activeAdminTab) && adminTotalPages > 1 && (
          <div className="admin-pagination">
            <button className="admin-ghost-btn" onClick={() => setAdminCurrentPage((prev) => Math.max(1, prev - 1))} disabled={adminCurrentPage === 1}>Previous</button>
            <span>Page {adminCurrentPage} of {adminTotalPages}</span>
            <button className="admin-ghost-btn" onClick={() => setAdminCurrentPage((prev) => Math.min(adminTotalPages, prev + 1))} disabled={adminCurrentPage === adminTotalPages}>Next</button>
          </div>
        )}

        <div className="form-actions">
          <button onClick={loadData}>Refresh</button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  };

  const HomeInfo = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = parsedData.filter((row) => {
      const raw = row?.['Order Date'];
      if (!raw) return false;
      const dt = getNormalizedRowDate(raw);
      if (!dt || Number.isNaN(dt.getTime())) return false;
      dt.setHours(0, 0, 0, 0);
      return dt.getTime() === today.getTime();
    }).length;

    const pendingEkycCount = parsedData.filter((row) => {
      const status = String(row?.['EKYC Status'] || '').toLowerCase().trim();
      return status === 'pending' || status === 'ekyc not done';
    }).length;

    const activePackageStatus = loggedInUser?.package
      ? `${loggedInUser.package} (Valid till: ${formatDisplayDate(loggedInUser.validTill)})`
      : 'N/A';

    const homeQuickActions = [
      'CSV / XLSX Pending Booking डेटा अपलोड करें',
      'रिपोर्ट और फ़िल्टर से रिकॉर्ड जांचें',
      'Cashmemo और Tax Invoice प्रिंट करें',
      'Profile / Bank / Rate update request भेजें',
    ];

    const homeTodayFocus = [
      `आज की bookings: ${todayOrders}`,
      `eKYC pending records: ${pendingEkycCount}`,
      'Pending SV और long pending bookings को प्राथमिकता दें',
      'Online paid bookings और selected rows verify करें',
    ];

    const homeSupportPoints = [
      'Data mismatch होने पर fresh file दोबारा upload करें',
      'Print से पहले selected rows एक बार verify करें',
      'Profile, bank और rate changes admin approval के बाद लागू होंगे',
    ];

    const homeAccountDetails = [
      { label: 'Dealer Code', value: loggedInUser?.dealerCode || 'N/A' },
      { label: 'Dealer Name', value: loggedInUser?.dealerName || 'N/A' },
      { label: 'Active Package', value: activePackageStatus },
      { label: 'Account Status', value: loggedInUser?.status || 'N/A' },
    ];

    return (
      <div className="placeholder-container home-dashboard">
        <h2 className="home-info-title">🏠 होम (Home Dashboard)</h2>

        <div className="home-important-note">
          {!isLoggedIn && <h2>वेबसाइट टेस्ट करने के लिए ID- 41099999 , Pin - 0000 का उपयोग करे</h2>}
          <h3>📌 महत्वपूर्ण सूचना (Cashmemo Print हेतु)</h3>
          <p>Cashmemo प्रिंट करने से पहले कृपया अपने Pending Cashmemo को cDCMS से डाउनलोड या सेव अवश्य करें।</p>
          <p><strong>डाउनलोड करने का पथ (Path):</strong> cDCMS -&gt; Order Fulfillment -&gt; Pending Booking</p>
          <p>डाउनलोड की गई फ़ाइल को इस पोर्टल के Top Navbar में Upload करें, फिर “Show Data” पर क्लिक करके डेटा प्रदर्शित करें।</p>
          <p><strong>बिना cDCMS से Pending Booking डेटा अपलोड किए Cashmemo प्रिंट संभव नहीं होगा।</strong></p>
        </div>

        <div className="home-section">
          <h3>स्वागत संदेश</h3>
          <p>HPCL LPG Distributor Dashboard में आपका स्वागत है।</p>
          <p>यहाँ से आप cDCMS से Pending Booking डेटा upload करके, उसे validate और review करके, Cashmemo और Tax Invoice print कर सकते हैं।</p>
          <p>इसके साथ ही आप Profile, Bank, Rate, Delivery Area और Delivery Staff update requests भेज सकते हैं तथा approval workflow को ट्रैक कर सकते हैं।</p>
        </div>

        <div className="home-hero-grid">
          <div className="home-section home-highlight-card">
            <h3>काम करने का आसान क्रम</h3>
            <ol className="home-steps-list">
              <li>cDCMS से Pending Booking डेटा download करके upload करें</li>
              <li>Filters और report cards से records verify करें</li>
              <li>Cashmemo / Invoice generate और print करें</li>
              <li>ज़रूरत होने पर profile, bank या rate update request भेजें</li>
            </ol>
          </div>

          <div className="home-section home-highlight-card">
            <h3>अकाउंट की झलक</h3>
            <div className="home-account-grid">
              {homeAccountDetails.map((item) => (
                <div key={item.label} className="home-account-item">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="home-layout">
          <div className="home-section">
            <h3>त्वरित कार्य</h3>
            <ul>
              {homeQuickActions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="home-section">
            <h3>आज का फोकस</h3>
            <ul>
              {homeTodayFocus.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="home-section">
            <h3>सहायता और सुझाव</h3>
            <ul>
              {homeSupportPoints.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  };
  const AboutInfo = () => {
    const summaryCards = [
      {
        title: 'मुख्य मॉड्यूल',
        items: [
          'Pending Booking डेटा upload और parsing engine',
          'Report cards, filters और searchable data grid',
          'Cashmemo Print और GST Tax Invoice generation',
          'Profile / Bank / Rate / Delivery update requests',
          'Admin approval workflow और user control dashboard',
        ],
      },
      {
        title: 'डेटा और अपलोड सिस्टम',
        items: [
          'CSV / XLSX upload support और dynamic column mapping',
          'Excel dates, mixed formats और numeric normalization',
          'Top Navbar से re-upload, show data और data visibility control',
          'Firebase primary storage के साथ local fallback backup',
        ],
      },
      {
        title: 'रिपोर्ट और ऑपरेशन कंट्रोल',
        items: [
          'Pending booking analysis और clickable report cards',
          'eKYC, area, order type, status और date range filters',
          'Cascading filters जो available data के हिसाब से options दिखाते हैं',
          'Printable table view, selected rows verify और bulk actions',
        ],
      },
      {
        title: 'Cashmemo और Invoice सुविधाएँ',
        items: [
          'Bulk cashmemo print और multiple layout modes',
          'Online paid और regular booking handling',
          'GST invoice generation, round-off और amount in words',
          'Print-friendly invoice rendering, declaration और signature section',
        ],
      },
      {
        title: 'Admin कंट्रोल और गवर्नेंस',
        items: [
          'Pending registration और approval request workflow',
          'User creation, package control और account status management',
          'Dictionary, delivery area/staff और profile approval queue',
          'Feedback handling, audit trail, recycle bin और CSV export tools',
        ],
      },
      {
        title: 'सुरक्षा और प्रोडक्टिविटी',
        items: [
          'Dealer Code + PIN based user login',
          'Package validity, pending, active, disabled और expired access control',
          'Saved views, quick summaries और expiry alerts',
          'Daily distributor operations को fast और structured रखने वाला workflow',
        ],
      },
    ];

    return (
      <div className="placeholder-container about-summary">
        <h2 className="about-info-title">📊 डैशबोर्ड (System Summary)</h2>
        <div className="home-important-note">
          {!isLoggedIn && <h2>वेबसाइट टेस्ट करने के लिए ID- 41099999 , Pin - 0000 का उपयोग करे</h2>}
          <h3>📌 महत्वपूर्ण सूचना (Cashmemo Print हेतु)</h3>
          <p>Cashmemo प्रिंट करने से पहले कृपया अपने Pending Cashmemo को cDCMS से डाउनलोड या सेव अवश्य करें।</p>
          <p><strong>डाउनलोड करने का पथ (Path):</strong> cDCMS -&gt; Order Fulfillment -&gt; Pending Booking</p>
          <p>डाउनलोड की गई फ़ाइल को इस पोर्टल के Top Navbar में Upload करें, फिर “Show Data” पर क्लिक करके डेटा प्रदर्शित करें।</p>
          <p><strong>बिना cDCMS से Pending Booking डेटा अपलोड किए Cashmemo प्रिंट संभव नहीं होगा।</strong></p>
        </div>
        <p>
          यह प्लेटफ़ॉर्म LPG Distributor के daily workflow को end-to-end संभालने के लिए बनाया गया है।
          cDCMS की Pending Booking फ़ाइल upload करना, डेटा को verify करना, filter करना और रिपोर्ट करना यहाँ मुख्य काम हैं।
        </p>
        <p>
          इसके बाद Cashmemo / Tax Invoice print करना, update requests भेजना और admin approval स्टेटस देखना आसान रहता है।
          यह सिस्टम आपकी daily operations को तेज, structured और error-prone कम करने के लिए डिज़ाइन किया गया है।
        </p>

        <div className="about-summary-grid">
          {summaryCards.map((card) => (
            <section key={card.title} className="about-summary-card">
              <h3>{card.title}</h3>
              <ul>
                {card.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    );
  };
  const [labelUpdatePageType, setLabelUpdatePageType] = useState('3 Cashmemo/Page');
  const [cashMemoLabelSettings, setCashMemoLabelSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('cashMemoLabelSettings') || '{}');
      return mergeCashMemoLabelSettings(saved);
    } catch {
      return createDefaultCashMemoLabelSettings();
    }
  });
  const [labelDraftSettings, setLabelDraftSettings] = useState(() => createDefaultCashMemoLabelSettings());
  const [customersToPrint] = useState([]); // New state to hold multiple customers for printing
  const cashMemoRef = useRef(); // Ref for the cash memo component

  const defaultVisibleHeaders = [
    'Consumer No.',
    'Consumer Name',
    'Delivery Area',
    'Mobile No.',
    'Order Date',
    'Cash Memo Date',
    'Online Refill Payment status',
    'EKYC Status'
  ];
  const getFilterPresetStorageKey = (dealerCode = '') => (
    `${FILTER_PRESET_STORAGE_KEY_PREFIX}${String(dealerCode || 'guest').trim() || 'guest'}`
  );

  const {
    parsedData,
    headers,
    visibleHeaders,
    setVisibleHeaders,
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    pageType,
    setPageType,
    printLanguage,
    setPrintLanguage,
    showDataButton,
    showParsedData,
    setShowParsedData,
    showBookingReport,
    setShowBookingReport,
    uploadMetadata,
    uploadInProgress,
    eKycFilter,
    setEKycFilter,
    areaFilter,
    setAreaFilter,
    natureFilter,
    setNatureFilter,
    mobileStatusFilter,
    setMobileStatusFilter,
    consumerStatusFilter,
    setConsumerStatusFilter,
    connectionTypeFilter,
    setConnectionTypeFilter,
    onlineRefillPaymentStatusFilter,
    setOnlineRefillPaymentStatusFilter,
    orderDateStart,
    setOrderDateStart,
    orderDateEnd,
    setOrderDateEnd,
    cashMemoDateStart,
    setCashMemoDateStart,
    cashMemoDateEnd,
    setCashMemoDateEnd,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    activeReportFilter,
    setActiveReportFilter,
    orderStatusFilter,
    setOrderStatusFilter,
    orderSourceFilter,
    setOrderSourceFilter,
    orderTypeFilter,
    setOrderTypeFilter,
    cashMemoStatusFilter,
    setCashMemoStatusFilter,
    deliveryManFilter,
    setDeliveryManFilter,
    isRegMobileFilter,
    setIsRegMobileFilter,
    handleFileUpload,
    handleResetFilters,
  } = useParsedDataFilters({
    normalizeData,
    sortedUniqueValues,
    defaultVisibleHeaders,
    hideAllViews,
    onNotify: pushToast,
  });

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  useEffect(() => {
    try {
      const storageKey = getRecentActivityStorageKey(loggedInUser?.dealerCode);
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setRecentActivities(Array.isArray(parsed) ? parsed : []);
    } catch {
      setRecentActivities([]);
    }
  }, [loggedInUser?.dealerCode]);

  useEffect(() => {
    if (!uploadMetadata?.uploadedAt) return;
    logRecentActivity(
      `Uploaded ${uploadMetadata.fileName} with ${uploadMetadata.totalRows} rows`,
      loggedInUser?.dealerCode,
    );
  }, [uploadMetadata?.uploadedAt]);

  const loadTestSampleFile = useCallback(async () => {
    if (sampleDataLoaded || sampleDataLoading) return;
    setSampleDataLoading(true);
    try {
      const response = await fetch(encodeURI('/Sample Excel.xlsx'));
      if (!response.ok) throw new Error('Unable to load sample file');
      const blob = await response.blob();
      const file = new File([blob], 'Sample Excel.xlsx', {
        type: blob.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      await handleFileUpload(file);
      setSampleDataLoaded(true);
    } catch (error) {
      console.error('Sample file load failed:', error);
      pushToast('Sample file load failed. Please use Upload Data manually.', 'error');
    } finally {
      setSampleDataLoading(false);
      setSampleDataAttempted(true);
    }
  }, [handleFileUpload, pushToast, sampleDataLoaded, sampleDataLoading]);

  useEffect(() => {
    if (!isTestUser || sampleDataLoaded || sampleDataLoading || sampleDataAttempted) return;
    loadTestSampleFile();
  }, [isTestUser, loadTestSampleFile, sampleDataAttempted, sampleDataLoaded, sampleDataLoading]);

  const handleResetAllFilters = () => {
    handleResetFilters();
    clearSelection();
  };

  const exportRowsToCsvFile = (filename, rows, exportHeaders = visibleHeaders) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      pushToast('No data available to export.', 'info');
      return;
    }
    const headersToUse = Array.isArray(exportHeaders) && exportHeaders.length > 0 ? exportHeaders : Object.keys(rows[0] || {});
    const escapeCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csvLines = [
      headersToUse.map(escapeCell).join(','),
      ...rows.map((row) => headersToUse.map((header) => escapeCell(row?.[header])).join(',')),
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    pushToast(`Exported ${rows.length} rows to ${filename}`, 'success');
    logRecentActivity(`Exported ${rows.length} rows as ${filename}`);
  };

  useEffect(() => {
    try {
      const storageKey = getFilterPresetStorageKey(loggedInUser?.dealerCode);
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setSavedFilterPresets(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSavedFilterPresets([]);
    }
  }, [loggedInUser?.dealerCode]);

  const buildCurrentFilterPreset = () => ({
    searchTerm,
    activeReportFilter,
    eKycFilter,
    areaFilter,
    natureFilter,
    mobileStatusFilter,
    consumerStatusFilter,
    connectionTypeFilter,
    onlineRefillPaymentStatusFilter,
    orderStatusFilter,
    orderSourceFilter,
    orderTypeFilter,
    cashMemoStatusFilter,
    deliveryManFilter,
    isRegMobileFilter,
    orderDateStart,
    orderDateEnd,
    cashMemoDateStart,
    cashMemoDateEnd,
    sortBy,
    sortOrder,
  });

  const applyFilterPreset = (preset = {}) => {
    setSearchTerm(String(preset.searchTerm || ''));
    setActiveReportFilter(String(preset.activeReportFilter || ''));
    setEKycFilter(String(preset.eKycFilter || 'All'));
    setAreaFilter(String(preset.areaFilter || 'All'));
    setNatureFilter(String(preset.natureFilter || 'All'));
    setMobileStatusFilter(String(preset.mobileStatusFilter || 'All'));
    setConsumerStatusFilter(String(preset.consumerStatusFilter || 'All'));
    setConnectionTypeFilter(String(preset.connectionTypeFilter || 'All'));
    setOnlineRefillPaymentStatusFilter(String(preset.onlineRefillPaymentStatusFilter || 'All'));
    setOrderStatusFilter(String(preset.orderStatusFilter || 'All'));
    setOrderSourceFilter(String(preset.orderSourceFilter || 'All'));
    setOrderTypeFilter(String(preset.orderTypeFilter || 'All'));
    setCashMemoStatusFilter(String(preset.cashMemoStatusFilter || 'All'));
    setDeliveryManFilter(String(preset.deliveryManFilter || 'All'));
    setIsRegMobileFilter(String(preset.isRegMobileFilter || 'All'));
    setOrderDateStart(String(preset.orderDateStart || ''));
    setOrderDateEnd(String(preset.orderDateEnd || ''));
    setCashMemoDateStart(String(preset.cashMemoDateStart || ''));
    setCashMemoDateEnd(String(preset.cashMemoDateEnd || ''));
    setSortBy(String(preset.sortBy || ''));
    setSortOrder(String(preset.sortOrder || 'asc'));
    setShowAdvancedFilters(true);
    pushToast(`Applied preset: ${preset?.name || 'Saved filter'}`, 'success');
  };

  const persistFilterPresets = (nextPresets) => {
    setSavedFilterPresets(nextPresets);
    try {
      localStorage.setItem(
        getFilterPresetStorageKey(loggedInUser?.dealerCode),
        JSON.stringify(nextPresets),
      );
    } catch {
      pushToast('Unable to save filter preset locally.', 'error');
    }
  };

  const handleSaveCurrentPreset = () => {
    const presetName = window.prompt('Preset name', '');
    if (!presetName || !presetName.trim()) {
      pushToast('Preset save cancelled.', 'info');
      return;
    }
    const trimmedName = presetName.trim();
    const nextPreset = {
      id: `preset-${Date.now()}`,
      name: trimmedName,
      updatedAt: new Date().toISOString(),
      filters: buildCurrentFilterPreset(),
    };
    const dedupedPresets = savedFilterPresets.filter(
      (preset) => String(preset?.name || '').trim().toLowerCase() !== trimmedName.toLowerCase(),
    );
    const nextPresets = [nextPreset, ...dedupedPresets].slice(0, 8);
    persistFilterPresets(nextPresets);
    pushToast(`Saved preset: ${trimmedName}`, 'success');
  };

  const handleDeletePreset = (presetId) => {
    const nextPresets = savedFilterPresets.filter((preset) => preset.id !== presetId);
    persistFilterPresets(nextPresets);
    pushToast('Preset removed.', 'info');
  };

  const handlePrintData = () => {
    const printContent = buildPrintDataHtml({
      visibleHeaders,
      filteredData,
      formatDateToDDMMYYYY,
      excelSerialDateToJSDate,
      parseDateString,
    });
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      pushToast('Unable to open print window. Please allow pop-ups.', 'error');
      return;
    }
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
    logRecentActivity(`Printed data view with ${filteredData.length} rows`);
  };
  const handlePrintCashmemo = async () => {
      if (selectedCustomerIds.length === 0) {
        pushToast('Please select at least one cashmemo to print.', 'info');
        return;
      }

      const isHindiPrint = printLanguage === 'Hindi';
      const [{ renderToString }, { default: CashMemoTemplate }] = await Promise.all([
        import('react-dom/server'),
        isHindiPrint ? import('./CashMemoHindi') : import('./CashMemoEnglish'),
      ]);

      // एड्रेस को साफ़ करने और चिपके हुए शब्दों को अलग करने का फंक्शन
      const formatAddress = (text) => {
        if (!text) return '';
        let formatted = text;
        
        // 1. '-' , '+' और ',' जैसे चिन्हों के आगे-पीछे स्पेस दें
        formatted = formatted.replace(/([-+,])/g, ' $1 ');
        
        // 2. 'S/O', 'W/O', 'D/O', 'C/O' (या बिना स्लैश के 'SO', 'WO') के ठीक बाद अगर लेटर है, तो स्पेस दें
        formatted = formatted.replace(/\b([SWDCswdc]\/?[Oo])([a-zA-Z]{3,})/g, '$1 $2');
        
        // 3. अंकों और अक्षरों को अलग करें (e.g., 16VILL -> 16 VILL या WARD16 -> WARD 16)
        formatted = formatted.replace(/(\d)([a-zA-Z])/g, '$1 $2');
        formatted = formatted.replace(/([a-zA-Z])(\d)/g, '$1 $2');
        
        // 4. कुछ खास चिपके हुए शब्दों (Keywords और Surnames) को अलग करें 
        const keywords = [
          'WARD', 'VILL', 'VPO', 'POST', 'PO', 'PS', 'DIST', 'PIN', 'BLOCK', 'TEHSIL', 'NAGAR', 'ROAD', 'GALI', 'TOLA', 'CHOWK',
          'KUMARI', 'KUMAR', 'DEVI', 'SINGH', 'SAHNI', 'PASWAN', 'THAKUR', 'YADAV', 'MAHTO', 'SHARMA', 'MANDAL', 'CHAUDHARY', 'PANDIT', 'MISHRA', 'MUKHIYA', 'MANJHI', 'CHAUHAN'
        ];
        keywords.forEach(keyword => {
          const regex = new RegExp(`(${keyword})`, 'gi');
          formatted = formatted.replace(regex, ' $1 ');
        });
        
        // 5. लगातार एक जैसे अलग-अलग शब्दों को एक करें (e.g., "VILL VILL" -> "VILL")
        formatted = formatted.replace(/\b(\w+)(?:\s+\1)+\b/gi, '$1');
        
        // 6. चिपके हुए एक जैसे शब्दों (कम से कम 4 अक्षर) को सिंगल करें (e.g., "SAHNISONPURVASONPURVA" -> "SAHNISONPURVA")
        formatted = formatted.replace(/(\w{4,})\1+/gi, '$1');

        // 7. एक्स्ट्रा स्पेस को हटाकर शब्दों को Array में बदलें
        let words = formatted.replace(/\s+/g, ' ').trim().split(' ');
        
        // 8. आस-पास के मिलते-जुलते शब्दों को हटाएं (Typos in village names e.g., "SONPURVA Sonpurwa")
        let uniqueWords = [];
        for (let i = 0; i < words.length; i++) {
          if (i > 0 && uniqueWords.length > 0) {
            let prev = uniqueWords[uniqueWords.length - 1].toLowerCase();
            let curr = words[i].toLowerCase();
            // अगर दोनों शब्द 5 या उससे ज्यादा अक्षर के हैं, पहले 5 अक्षर समान हैं, और लंबाई में ज्यादा अंतर नहीं है
            if (prev.length >= 5 && curr.length >= 5 && prev.substring(0, 5) === curr.substring(0, 5) && Math.abs(prev.length - curr.length) <= 2) {
              continue; // दूसरे मिलते-जुलते शब्द को छोड़ दें
            }
          }
          uniqueWords.push(words[i]);
        }

        return uniqueWords.join(' ');
      };

      let customersToPrint = selectedCustomersForPrint.map(customer => {
        const formattedCustomer = { ...customer };
        if (formattedCustomer['Address']) {
          formattedCustomer['Address'] = formatAddress(formattedCustomer['Address']);
        }
        return formattedCustomer;
      });

      if (isHindiPrint) {
        const transliterateText = async (text) => {
          if (!text) return '';
          let processedText = text;
          try {
            const localCacheKey = `transCache_${text.toLowerCase().trim()}`;
            const cached = localStorage.getItem(localCacheKey);
            if (cached) return cached;
            
            const exactMatch = Object.keys(translationDictionary).find(k => k.toLowerCase() === text.toLowerCase().trim());
            if (exactMatch) return translationDictionary[exactMatch];

            const sortedKeys = Object.keys(translationDictionary).sort((a, b) => b.length - a.length);
            sortedKeys.forEach(engWord => {
              const escapedWord = engWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(`(^|\\s)${escapedWord}(?=\\s|[,.-]|$)`, 'gi');
              processedText = processedText.replace(regex, `$1${translationDictionary[engWord]}`);
            });

            if (!/[a-zA-Z]/.test(processedText)) {
              localStorage.setItem(localCacheKey, processedText);
              return processedText;
            }

            const GOOGLE_CLOUD_API_KEY = 'AIzaSyA9fCIrR8PkDcPAFxHm_bYXxOwXzeFfCGA';
            const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_CLOUD_API_KEY}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                q: processedText,
                source: 'en',
                target: 'hi',
                format: 'text'
              })
            });

            const data = await response.json();
            if (data && data.data && data.data.translations && data.data.translations[0]) {
              const result = data.data.translations[0].translatedText;
              localStorage.setItem(localCacheKey, result);
              return result;
            }
          } catch (error) {
            console.error('Translation failed:', error);
          }
          return processedText || text;
        };

        customersToPrint = await Promise.all(
          customersToPrint.map(async (customer) => {
            const translatedCustomer = { ...customer };
            if (customer['Consumer Name']) {
              translatedCustomer['Consumer Name Hindi'] = await transliterateText(customer['Consumer Name']);
            }
            if (customer['Address']) {
              translatedCustomer['Address Hindi'] = await transliterateText(customer['Address']);
            }
            if (customer['Delivery Area']) {
              translatedCustomer['Delivery Area'] = await transliterateText(customer['Delivery Area']);
            }
            if (customer['Delivery Man']) {
              translatedCustomer['Delivery Man'] = await transliterateText(customer['Delivery Man']);
            }
            return translatedCustomer;
          })
        );
      }

      let allCashMemosHtml = '';

      const pd = loggedInUser?.profileData || null;
      const hd = loggedInUser?.hindiHeaderData || null;
      const baseDealerName = pd?.distributorName
        ? (pd?.distributorCode ? `${pd.distributorName} (${pd.distributorCode})` : pd.distributorName)
        : '-';

      const dealerDetails = {
        name: (isHindiPrint && hd?.distributorName) ? hd.distributorName : baseDealerName,
        gstn: (isHindiPrint && hd?.gstn) ? hd.gstn : (pd?.gst || '-'),
        address: { plotNo: (isHindiPrint && hd?.address) ? hd.address : (pd?.address || '-') },
        contact: {
          email: (isHindiPrint && hd?.email) ? hd.email : (pd?.email || '-'),
          telephone: (isHindiPrint && hd?.telephone) ? hd.telephone : (pd?.contact || '-'),
        },
      };

      customersToPrint.forEach((customer, index) => {
        const processedCustomer = { ...customer };

        const pickFirstValue = (obj, keys) => {
          for (const key of keys) {
            const value = obj?.[key];
            if (value !== undefined && value !== null && String(value).trim() !== '') {
              return value;
            }
          }
          return '';
        };

        // Normalize common keys for print template compatibility
        processedCustomer['Order No.'] = pickFirstValue(processedCustomer, ['Order No.']);
        processedCustomer['LPG ID'] = pickFirstValue(processedCustomer, ['LPG ID', 'UniqueConsumerId', 'Unique Consumer Id', 'Unique Consumer ID']);
        processedCustomer['Cash Memo No.'] = pickFirstValue(processedCustomer, ['Cash Memo No.', 'CashMemoNo', 'Cash Memo']);
        processedCustomer['HSN'] = '27111900';

        // Convert 'Order Date'
        if (typeof processedCustomer['Order Date'] === 'number') {
          processedCustomer['Order Date'] = excelSerialDateToJSDate(processedCustomer['Order Date']);
        } else if (typeof processedCustomer['Order Date'] === 'string') {
          processedCustomer['Order Date'] = parseDateString(processedCustomer['Order Date']);
        } else {
          processedCustomer['Order Date'] = null; // Set to null if not a number or string
        }

        // Convert 'Cash Memo Date'
        const cashMemoDateRaw = pickFirstValue(processedCustomer, ['Cash Memo Date', 'Cash Memo Dt', 'CashMemo Date', 'CashMemoDate']);
        if (typeof cashMemoDateRaw === 'number') {
          processedCustomer['Cash Memo Date'] = excelSerialDateToJSDate(cashMemoDateRaw);
        } else if (typeof cashMemoDateRaw === 'string') {
          processedCustomer['Cash Memo Date'] = parseDateString(cashMemoDateRaw);
        } else {
          processedCustomer['Cash Memo Date'] = null; // Set to null if not a number or string
        }

        try {
          const rates = Array.isArray(loggedInUser?.ratesData)
            ? loggedInUser.ratesData
            : (() => {
              const savedRates = localStorage.getItem('ratesData');
              return savedRates ? JSON.parse(savedRates) : [];
            })();
          if (Array.isArray(rates) && rates.length > 0) {
              const productText = String(processedCustomer['Consumer Package'] || '').toLowerCase();
              const match = rates.find(r => {
                const itemText = String(r.Item || '').toLowerCase();
                return productText.includes(itemText) || itemText.includes(productText);
              });
              if (match) {
                const basic = parseFloat(match.BasicPrice) || 0;
                const sgstPct = parseFloat(match.SGST) || 0;
                const cgstPct = parseFloat(match.CGST) || 0;
                const cgstAmt = parseFloat((basic * cgstPct / 100).toFixed(2));
                const sgstAmt = parseFloat((basic * sgstPct / 100).toFixed(2));
                const rsp = parseFloat(match.RSP) || 0;
                processedCustomer['Base Price (₹)'] = basic;
                processedCustomer['Delivery Charges (₹)'] = processedCustomer['Delivery Charges (₹)'] || 0;
                processedCustomer['Cash & Carry Rebate (₹)'] = processedCustomer['Cash & Carry Rebate (₹)'] || 0;
                processedCustomer['CGST (2.50%) (₹)'] = cgstAmt;
                processedCustomer['SGST (2.50%) (₹)'] = sgstAmt;
                processedCustomer['Total Amount (₹)'] = rsp;
              }
          }
        } catch (error) {
          void error;
        }

        const cashMemoHtml = renderToString(
          <CashMemoTemplate customer={processedCustomer} pageType={pageType} dealerDetails={dealerDetails} formatDateToDDMMYYYY={formatDateToDDMMYYYY} labelSettings={cashMemoLabelSettings[pageType]} />
        );

        const memosPerPage = getCashMemoPerPage(pageType);
        const pageBreakClass = (index + 1) % memosPerPage === 0 && (index + 1) < customersToPrint.length
          ? ' cashmemo-page-break'
          : '';

        allCashMemosHtml += `<div class="cashmemo-print-item cashmemo-print-item--${memosPerPage}${pageBreakClass}">${cashMemoHtml}</div>`;
      });

      const fullHtml = `
        <html>
          <head>
            <title>${isHindiPrint ? 'Hindi Cash Memos' : 'Cash Memos'}</title>
            <link rel="stylesheet" href="CashMemoPrint.css" />
            <style>
              @page {
                size: A4 portrait;
                margin: 4mm 6mm 5mm;
              }
              html, body {
                margin: 0;
                padding: 0;
                background: #ffffff;
                color: #111;
                font-family: Calibri, sans-serif;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              * {
                box-sizing: border-box;
              }
              table {
                width: 100%;
                border-collapse: collapse;
              }
              .cashmemo-print-item {
                width: 100%;
                height: 94mm;
                margin: 0 0 2mm;
                border: 1px solid #111;
                overflow: hidden;
                page-break-inside: avoid;
                break-inside: avoid;
              }
              .cashmemo-print-item--2 {
                height: 142mm;
                margin-bottom: 2mm;
              }
              .cashmemo-print-item--4 {
                height: 68.75mm;
                margin-bottom: 1.5mm;
              }
              .cashmemo-page-break {
                page-break-after: always;
                break-after: page;
              }
              .only-details-print {
                height: 100%;
                display: flex;
                align-items: flex-end;
              }
              .only-details-print .tax-details {
                width: 100%;
              }
              .cash-memo-single {
                display: flex;
                width: 100%;
                height: 100%;
                background: #fff;
                color: #111;
              }
              .distributor-copy,
              .tax-invoice {
                min-height: 0;
                display: flex;
                flex-direction: column;
              }
              .distributor-copy {
                width: 41.5%;
                border-right: 1px dashed #666;
              }
              .tax-invoice {
                width: 58.5%;
              }
              .distributor-header,
              .tax-invoice-header {
                min-height: 12.5mm;
                display: flex;
                align-items: stretch;
                border-bottom: 1px solid #222;
              }
              .distributor-header-logo,
              .tax-invoice-header-logo {
                width: 34%;
                display: flex;
                align-items: center;
                padding: 1mm 1.5mm;
              }
              .distributor-header-image,
              .tax-invoice-header-image {
                width: 100%;
                max-height: 10.5mm;
                object-fit: contain;
              }
              .distributor-header-details,
              .tax-invoice-header-details {
                flex: 1;
                padding: 0.9mm 1.5mm 0.7mm;
                text-align: right;
                font-size: 2.8mm;
                font-weight: 700;
                line-height: 1.1;
              }
              .distributor-header-detail-text,
              .tax-invoice-header-detail-text,
              .declaration-text,
              .signature-text,
              .tax-invoice-title {
                margin: 0;
              }
              .distributor-copy-title {
                display: inline-block;
                margin: 0.9mm 0 0.8mm 1.2mm;
                padding: 0.35mm 1.4mm;
                background: #ececec;
                color: #222;
                font-size: 2.45mm;
                font-weight: 700;
              }
              .contact-info {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                border-bottom: 1px solid #222;
                background: #0a4c9a;
                color: #fff;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .contact-info > div {
                padding: 0.65mm 1mm;
                border-right: 1px solid rgba(255, 255, 255, 0.45);
                font-size: 2.05mm;
                line-height: 1.05;
              }
              .contact-info > div:last-child {
                border-right: none;
              }
              .contact-info-strong {
                font-size: 3.5mm;
                font-weight: 700;
                color: #fff;
              }
              .header-content {
                min-height: 5.4mm;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 1.2mm;
              }
              .tax-invoice-title {
                font-size: 2.5mm;
                font-weight: 700;
                padding-right: 5.4mm;
              }
              .header-content-flex-spacer {
                flex: 1;
              }
              .image-1906 {
                height: 5.2mm;
                object-fit: contain;
              }
              .memo-table-wrap {
                flex: 1;
                min-height: 0;
                padding: 0 1mm;
                overflow: hidden;
              }
              .memo-table-wrap--tax {
                padding-top: 0.25mm;
              }
              .memo-table-box {
                height: 100%;
                border: 1px solid #222;
                overflow: hidden;
                background: #fff;
              }
              .memo-table-box--distributor {
                height: auto;
                min-height: 100%;
              }
              .details-headline,
              .details-address {
                font-size: 2.2mm;
                line-height: 1.08;
                margin: 0 0 0.45mm;
                font-weight: 700;
              }
              .details-headline--emphasis {
                font-size: 3.05mm;
                line-height: 1.12;
                font-weight: 800;
              }
              .details-headline--primary {
                font-size: 3.35mm;
              }
              .details-address {
                margin-bottom: 0.95mm;
                font-size: 2.8mm;
                line-height: 1.12;
                font-weight: 800;
              }
              .pair-table {
                table-layout: fixed;
              }
              .pair-table td {
                padding: 0.05mm 0;
                font-size: 2.18mm;
                line-height: 1.06;
                vertical-align: top;
                font-weight: 600;
              }
              .pair-table__row--emphasis td {
                font-size: 2.58mm;
                font-weight: 800;
              }
              .pair-table__row--payment td {
                font-size: 2.65mm;
                font-weight: 800;
              }
              .pair-table__row--mobile td {
                font-size: 3mm;
                font-weight: 800;
              }
              .pair-table__row--address td {
                font-size: 2.35mm;
                font-weight: 800;
              }
              .pair-table__row--alert td {
                color: #c22121;
                font-weight: 800;
              }
              .pair-table--dense td {
                padding: 0.03mm 0;
              }
              .pair-table__label {
                width: 44%;
                white-space: nowrap;
              }
              .pair-table__sep {
                width: 4%;
                text-align: center;
                white-space: nowrap;
              }
              .pair-table__value {
                width: 52%;
                word-break: break-word;
              }
              .pair-table--amount .pair-table__value {
                text-align: right;
                padding-right: 0.2mm;
              }
              .distributor-details {
                padding: 1.6mm 1.6mm 0 1.8mm;
              }
              .tax-details {
                padding: 1.2mm 1.15mm 0 1.1mm;
              }
              .tax-details .pair-table td {
                font-size: 2.35mm;
                line-height: 1.1;
              }
              .tax-details .pair-table__row--emphasis td,
              .tax-details .pair-table__row--mobile td,
              .tax-details .pair-table__row--payment td {
                font-size: 2.65mm;
              }
              .cashmemo-print-item--2 .memo-table-box,
              .cashmemo-print-item--3 .memo-table-box {
                display: flex;
              }
              .cashmemo-print-item--2 .memo-table-box--distributor,
              .cashmemo-print-item--2 .memo-table-box--tax {
                height: 100%;
              }
              .cashmemo-print-item--2 .distributor-details,
              .cashmemo-print-item--2 .tax-details,
              .cashmemo-print-item--3 .distributor-details,
              .cashmemo-print-item--3 .tax-details {
                width: 100%;
              }
              .cashmemo-print-item--2 .distributor-details,
              .cashmemo-print-item--2 .tax-details {
                height: 100%;
              }
              .cashmemo-print-item--2 .distributor-details {
                display: grid;
                grid-template-rows: auto auto auto 1fr 1fr;
                align-items: stretch;
                padding-bottom: 1mm;
              }
              .cashmemo-print-item--2 .pair-table--dist-main,
              .cashmemo-print-item--2 .pair-table--dist-amounts {
                height: 100%;
              }
              .cashmemo-print-item--2 .distributor-copy-title,
              .cashmemo-print-item--2 .tax-invoice-title {
                font-size: 2.8mm;
              }
              .cashmemo-print-item--2 .contact-info > div {
                font-size: 2.35mm;
              }
              .cashmemo-print-item--2 .contact-info-strong {
                font-size: 4mm;
              }
              .cashmemo-print-item--2 .details-headline--emphasis {
                font-size: 3.55mm;
              }
              .cashmemo-print-item--2 .details-headline--primary {
                font-size: 3.95mm;
              }
              .cashmemo-print-item--2 .details-address {
                font-size: 3.3mm;
                white-space: normal;
                overflow: visible;
                word-break: break-word;
              }
              .cashmemo-print-item--2 .pair-table td {
                padding-top: 0.9mm;
                padding-bottom: 0.9mm;
                font-size: 2.85mm;
                line-height: 1.12;
                vertical-align: middle;
              }
              .cashmemo-print-item--2 .pair-table__row--emphasis td,
              .cashmemo-print-item--2 .pair-table__row--payment td {
                font-size: 3.15mm;
              }
              .cashmemo-print-item--2 .pair-table__row--mobile td {
                font-size: 3.45mm;
              }
              .cashmemo-print-item--2 .pair-table__row--address td {
                font-size: 3mm;
              }
              .cashmemo-print-item--2 .pair-table__row--delivery-area .pair-table__value {
                white-space: normal;
                overflow: visible;
                word-break: break-word;
              }
              .cashmemo-print-item--2 .tax-details .pair-table td {
                font-size: 2.8mm;
              }
              .cashmemo-print-item--2 .tax-details .pair-table__row--emphasis td,
              .cashmemo-print-item--2 .tax-details .pair-table__row--mobile td,
              .cashmemo-print-item--2 .tax-details .pair-table__row--payment td {
                font-size: 3.15mm;
              }
              .cashmemo-print-item--2 .tax-details__columns {
                height: 100%;
                align-items: stretch;
              }
              .cashmemo-print-item--2 .tax-details__column {
                display: grid;
                grid-template-rows: auto auto 1fr;
              }
              .cashmemo-print-item--2 .tax-details__column--right {
                display: flex;
              }
              .cashmemo-print-item--2 .pair-table--tax-top {
                order: 1;
              }
              .cashmemo-print-item--2 .pair-table--tax-bottom {
                order: 2;
              }
              .cashmemo-print-item--2 .tax-details__spacer {
                order: 3;
              }
              .cashmemo-print-item--2 .pair-table--tax-amounts {
                height: 100%;
              }
              .cashmemo-print-item--3 .pair-table td {
                padding-top: 0.22mm;
                padding-bottom: 0.22mm;
                vertical-align: middle;
              }
              .cashmemo-print-item--2 .pair-table--dense td {
                padding-top: 0.7mm;
                padding-bottom: 0.7mm;
              }
              .cashmemo-print-item--3 .pair-table--dense td {
                padding-top: 0.18mm;
                padding-bottom: 0.18mm;
              }
              .cashmemo-print-item--2 .tax-details__spacer {
                height: auto;
              }
              .cashmemo-print-item--3 .tax-details__spacer {
                height: 2.2mm;
              }
              .tax-details__columns {
                display: grid;
                grid-template-columns: 1.02fr 0.98fr;
                gap: 1.2mm;
              }
              .tax-details__column {
                min-width: 0;
              }
              .tax-details__column--right .pair-table__label {
                width: 54%;
              }
              .tax-details__column--right .pair-table__sep {
                width: 4%;
              }
              .tax-details__column--right .pair-table__value {
                width: 42%;
              }
              .tax-details__spacer {
                height: 1.3mm;
              }
              .pair-table--dist-main .pair-table__label {
                width: 34%;
                white-space: nowrap;
              }
              .pair-table--dist-main .pair-table__sep {
                width: 3%;
                white-space: nowrap;
              }
              .pair-table--dist-main .pair-table__value {
                width: 63%;
                white-space: nowrap;
                word-break: normal;
              }
              .pair-table--dist-amounts .pair-table__label {
                width: 34%;
                white-space: nowrap;
              }
              .pair-table--dist-amounts .pair-table__sep {
                width: 3%;
                white-space: nowrap;
              }
              .pair-table--dist-amounts .pair-table__value {
                width: 63%;
                white-space: nowrap;
                word-break: normal;
                text-align: left;
                padding-right: 0;
              }
              .pair-table--dist-amounts .pair-table__row--emphasis .pair-table__value {
                text-align: left;
              }
              .pair-table--dist-amounts {
                margin-top: 0.45mm;
                table-layout: auto;
              }
              .pair-table--dist-main {
                table-layout: auto;
              }
              .pair-table--tax-main .pair-table__label {
                width: 35%;
              }
              .pair-table--tax-main .pair-table__sep {
                width: 4%;
              }
              .pair-table--tax-main .pair-table__value {
                width: 61%;
              }
              .pair-table--tax-amounts .pair-table__value {
                white-space: nowrap;
              }
              .hidden {
                display: none;
              }
              .declaration {
                min-height: 11.2mm;
                display: flex;
                align-items: flex-end;
                border: 1px solid #222;
                margin: 0.9mm 1mm 1mm;
              }
              .declaration-text {
                flex: 1;
                padding: 0.9mm 1mm 0.55mm;
                color: #c22121;
                font-size: 1.9mm;
                line-height: 1.1;
                text-align: justify;
                font-weight: 700;
              }
              .signature-section {
                width: 30%;
                min-width: 26mm;
                margin: 0 1.2mm 0.85mm 0.4mm;
                border-top: 1px solid #222;
                padding-top: 0.4mm;
                text-align: center;
                font-size: 2mm;
                font-weight: 600;
              }
              .signature-text {
                padding: 0 1.3mm 0.5mm;
                font-size: 2.1mm;
                font-weight: 700;
              }
              .instructions-section {
                display: flex;
                align-items: stretch;
                border: 1px solid #222;
                margin: 0 1mm 1mm;
              }
              .instructions-text-container {
                flex: 1;
                padding: 0.5mm 1mm 0.2mm;
              }
              .instructions-list {
                margin: 0;
                padding-left: 3.2mm;
                font-size: 1.7mm;
                line-height: 1.2;
              }
              .hp-pay-image-container {
                width: 19mm;
                display: flex;
                align-items: flex-end;
                justify-content: flex-end;
                padding: 0.6mm 0.8mm 0.6mm 0;
              }
              .hp-pay-image {
                width: 16.5mm;
                height: auto;
                object-fit: contain;
              }
              .cash-memo-single--compact .distributor-header,
              .cash-memo-single--compact .tax-invoice-header {
                min-height: 10.8mm;
              }
              .cash-memo-single--compact .distributor-header-details,
              .cash-memo-single--compact .tax-invoice-header-details {
                font-size: 2.35mm;
              }
              .cash-memo-single--compact .distributor-copy-title,
              .cash-memo-single--compact .tax-invoice-title {
                font-size: 2.15mm;
              }
              .cash-memo-single--compact .details-headline--emphasis {
                font-size: 2.45mm;
              }
              .cash-memo-single--compact .details-headline--primary,
              .cash-memo-single--compact .details-address {
                font-size: 2.2mm;
              }
              .cash-memo-single--compact .pair-table td,
              .cash-memo-single--compact .pair-table__row--emphasis td,
              .cash-memo-single--compact .pair-table__row--payment td,
              .cash-memo-single--compact .pair-table__row--mobile td {
                font-size: 1.9mm;
                line-height: 1.02;
              }
              .cash-memo-single--compact .contact-info > div {
                font-size: 1.75mm;
              }
              .cash-memo-single--compact .contact-info-strong {
                font-size: 2.85mm;
              }
              .cash-memo-single--compact .instructions-list,
              .cash-memo-single--compact .declaration-text,
              .cash-memo-single--compact .signature-text,
              .cash-memo-single--compact .signature-section {
                font-size: 1.65mm;
              }
            </style>
          </head>
          <body>
            <div id="print-root" style="display: flex; flex-wrap: wrap; align-content: flex-start;">
              ${allCashMemosHtml}
            </div>
          </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      printWindow.document.write(fullHtml);
      printWindow.document.close();
      const triggerPrint = () => {
        const images = Array.from(printWindow.document.images || []);
        Promise.all(
          images.map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
            });
          })
        ).then(() => {
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 200);
        });
      };

      if (printWindow.document.readyState === 'complete') {
        triggerPrint();
      } else {
        printWindow.addEventListener('load', triggerPrint, { once: true });
      }
    };

    const restoreDeletedUser = async (
      item,
      confirmFn,
      currentDeletedUsersBin,
      currentUsers,
      writeUsersLocalFn,
      persistDeletedUsersBinFn,
      logAdminActivityFn,
      loadDataFn,
    ) => {
      if (!item) return;
      const confirmAction = typeof confirmFn === 'function' ? confirmFn : window.confirm;
      if (!confirmAction(`Restore ${item.dealerCode || 'this user'} from recycle bin?`)) return;

      const nextBin = (Array.isArray(currentDeletedUsersBin) ? currentDeletedUsersBin : []).filter(
        (user) => !(user.id === item.id && user.dealerCode === item.dealerCode),
      );
      const restoredUser = { ...item, status: item.status || 'active' };
      delete restoredUser.deletedAt;

      try {
        const userData = { ...restoredUser };
        delete userData.id;

        if (item.id) {
          await setDoc(doc(db, 'users', item.id), {
            ...userData,
            restoredAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await addDoc(collection(db, 'users'), {
            ...userData,
            restoredAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        if (typeof loadDataFn === 'function') {
          await loadDataFn();
        }
      } catch (error) {
        console.error('Restore failed, falling back to local restore:', error);
        const nextUsers = item.id
          ? [...(Array.isArray(currentUsers) ? currentUsers.filter((u) => u.id !== item.id) : []), restoredUser]
          : [...(Array.isArray(currentUsers) ? currentUsers : []), restoredUser];
        if (typeof writeUsersLocalFn === 'function') {
          writeUsersLocalFn(nextUsers);
        }
        alert(`Restore failed in Firestore, restored locally for ${item.dealerCode || 'user'}.`);
      } finally {
        if (typeof persistDeletedUsersBinFn === 'function') {
          persistDeletedUsersBinFn(nextBin);
        }
      }

      if (typeof logAdminActivityFn === 'function') {
        logAdminActivityFn('user_restored', { dealerCode: item.dealerCode || '' });
      }
      alert(`${item.dealerCode || 'User'} restored from recycle bin.`);
    };

    const permanentlyDeleteBinItem = async (
      item,
      confirmFn,
      currentDeletedUsersBin,
      persistDeletedUsersBinFn,
      logAdminActivityFn,
    ) => {
      if (!item) return;
      const confirmAction = typeof confirmFn === 'function' ? confirmFn : window.confirm;
      if (!confirmAction(`Permanently remove ${item.dealerCode || 'this deleted user'} from recycle bin?`)) return;

      const nextBin = (Array.isArray(currentDeletedUsersBin) ? currentDeletedUsersBin : []).filter(
        (user) => !(user.id === item.id && user.dealerCode === item.dealerCode),
      );
      try {
        if (item.id) {
          await deleteDoc(doc(db, 'users', item.id));
        }
      } catch (error) {
        console.error('Permanent delete failed for Firestore user:', error);
      } finally {
        if (typeof persistDeletedUsersBinFn === 'function') {
          persistDeletedUsersBinFn(nextBin);
        }
      }

      if (typeof logAdminActivityFn === 'function') {
        logAdminActivityFn('user_deleted_permanently', { dealerCode: item.dealerCode || '' });
      }
      alert(`${item.dealerCode || 'Deleted user'} removed permanently.`);
    };

  const matchesReportFilter = (row, reportKey) => {
    const ageInDays = getElapsedDays(row['Order Date']);
    const orderDate = getStartOfDay(row['Order Date']);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (reportKey) {
      case 'onlinePaid':
        return isOnlinePaidStatus(row['Online Refill Payment status']);
      case 'eKycNotDone':
        return isEkycNotDoneStatus(row['EKYC Status']);
      case 'sbcBooking':
        return isConsumerStatusMatch(row['Consumer Type'], 'SBC');
      case 'dbcBooking':
        return isConsumerStatusMatch(row['Consumer Type'], 'DBC');
      case 'pending02To05Days':
        return ageInDays !== null && ageInDays >= 2 && ageInDays <= 5;
      case 'pending05To10Days':
        return ageInDays !== null && ageInDays >= 5 && ageInDays <= 10;
      case 'pendingDay1':
        return ageInDays === 1;
      case 'pendingDay2':
        return ageInDays === 2;
      case 'pendingDay3':
        return ageInDays === 3;
      case 'pendingDay4':
        return ageInDays === 4;
      case 'pendingDay5':
        return ageInDays === 5;
      case 'pendingDay6':
        return ageInDays === 6;
      case 'pendingDay7':
        return ageInDays === 7;
      case 'pendingDay8':
        return ageInDays === 8;
      case 'pendingDay9':
        return ageInDays === 9;
      case 'pendingDay10':
        return ageInDays === 10;
      case 'pendingAbove21Days':
        return ageInDays !== null && ageInDays > 21;
      case 'pendingAbove15Days':
        return ageInDays !== null && ageInDays > 15;
      case 'pendingAbove10Days':
        return ageInDays !== null && ageInDays > 10;
      case 'pendingAbove7Days':
        return ageInDays !== null && ageInDays > 7;
      case 'pendingAbove3Days':
        return ageInDays !== null && ageInDays > 3;
      case 'todayBooking':
        return orderDate && orderDate.getTime() === today.getTime();
      case 'pendingSv':
        return isPendingSvRow(row);
      default:
        return true;
    }
  };

  const applyStructuredFilters = (rows, excludedFilters = []) => {
    const excluded = new Set(excludedFilters);

    let tempFilteredData = rows.filter(row => {
      const consumerNo = String(row['Consumer No.']);
      return /^\d{6}$/.test(consumerNo);
    });

    if (searchTerm) {
      const lowercasedSearchTerm = searchTerm.toLowerCase();
      tempFilteredData = tempFilteredData.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(lowercasedSearchTerm)
        )
      );
    }

    if (!excluded.has('eKycFilter') && eKycFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['EKYC Status'] === eKycFilter);
    }
    if (!excluded.has('areaFilter') && areaFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Delivery Area'] === areaFilter);
    }
    if (!excluded.has('natureFilter') && natureFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Consumer Nature'] === natureFilter);
    }
    if (!excluded.has('mobileStatusFilter') && mobileStatusFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row =>
        mobileStatusFilter === 'Available' ? (row['Mobile No.'] && row['Mobile No.'] !== '') : (!row['Mobile No.'] || row['Mobile No.'] === '')
      );
    }
    if (!excluded.has('consumerStatusFilter') && consumerStatusFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Consumer Type'] === consumerStatusFilter);
    }
    if (!excluded.has('connectionTypeFilter') && connectionTypeFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Consumer Package'] === connectionTypeFilter);
    }
    if (!excluded.has('onlineRefillPaymentStatusFilter') && onlineRefillPaymentStatusFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Online Refill Payment status'] === onlineRefillPaymentStatusFilter);
    }
    if (!excluded.has('orderStatusFilter') && orderStatusFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Order Status'] === orderStatusFilter);
    }
    if (!excluded.has('orderSourceFilter') && orderSourceFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Order Source'] === orderSourceFilter);
    }
    if (!excluded.has('orderTypeFilter') && orderTypeFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Order Type'] === orderTypeFilter);
    }
    if (!excluded.has('cashMemoStatusFilter') && cashMemoStatusFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Cash Memo Status'] === cashMemoStatusFilter);
    }
    if (!excluded.has('deliveryManFilter') && deliveryManFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Delivery Man'] === deliveryManFilter);
    }
    if (!excluded.has('isRegMobileFilter') && isRegMobileFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row =>
        isRegMobileFilter === 'Yes' ? (row['Is Reg Mobile'] && row['Is Reg Mobile'] !== '') : (!row['Is Reg Mobile'] || row['Is Reg Mobile'] === '')
      );
    }

    if (!excluded.has('orderDateRange') && orderDateStart && orderDateEnd) {
      tempFilteredData = tempFilteredData.filter(row => {
        const convertedRowDate = getNormalizedRowDate(row['Order Date']);
        if (!convertedRowDate) return false;
        const orderDate = new Date(convertedRowDate);
        const start = new Date(orderDateStart);
        const end = new Date(orderDateEnd);
        orderDate.setHours(0, 0, 0, 0);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        return orderDate >= start && orderDate <= end;
      });
    }

    if (!excluded.has('cashMemoDateRange') && cashMemoDateStart && cashMemoDateEnd) {
      tempFilteredData = tempFilteredData.filter(row => {
        const convertedRowDate = getNormalizedRowDate(row['Cash Memo Date']);
        if (!convertedRowDate) return false;
        const cashMemoDate = new Date(convertedRowDate);
        const start = new Date(cashMemoDateStart);
        const end = new Date(cashMemoDateEnd);
        cashMemoDate.setHours(0, 0, 0, 0);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        return cashMemoDate >= start && cashMemoDate <= end;
      });
    }

    if (!excluded.has('activeReportFilter') && activeReportFilter) {
      tempFilteredData = tempFilteredData.filter(row => matchesReportFilter(row, activeReportFilter));
    }

    return tempFilteredData;
  };

  const sortRows = (rows) => {
    if (!sortBy) return rows;
    return [...rows].sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];

      if (aValue === undefined || aValue === null) return sortOrder === 'asc' ? 1 : -1;
      if (bValue === undefined || bValue === null) return sortOrder === 'asc' ? -1 : 1;

      if (sortBy === 'Order Date' || sortBy === 'Cash Memo Date') {
        const dateA = getNormalizedRowDate(aValue);
        const dateB = getNormalizedRowDate(bValue);
        if (!dateA && !dateB) return 0;
        if (!dateA) return sortOrder === 'asc' ? 1 : -1;
        if (!dateB) return sortOrder === 'asc' ? -1 : 1;
        return sortOrder === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
      return 0;
    });
  };

  const baseFilteredData = useMemo(() => {
    return sortRows(applyStructuredFilters(parsedData, ['activeReportFilter']));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    parsedData,
    searchTerm,
    eKycFilter,
    areaFilter,
    natureFilter,
    mobileStatusFilter,
    consumerStatusFilter,
    connectionTypeFilter,
    onlineRefillPaymentStatusFilter,


    orderDateStart,
    orderDateEnd,
    cashMemoDateStart,
    cashMemoDateEnd,
    sortBy,
    sortOrder,
    orderStatusFilter,
    orderSourceFilter,
    orderTypeFilter,
    cashMemoStatusFilter,
    deliveryManFilter,
    isRegMobileFilter,
    activeReportFilter,
  ]);

  const bookingReport = useMemo(() => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const metrics = {
      totalPendingBooking: baseFilteredData.length,
      onlinePaid: 0,
      eKycNotDone: 0,
      sbcBooking: 0,
      dbcBooking: 0,
      pending02To05Days: 0,
      pending05To10Days: 0,
      pendingDay1: 0,
      pendingDay2: 0,
      pendingDay3: 0,
      pendingDay4: 0,
      pendingDay5: 0,
      pendingDay6: 0,
      pendingDay7: 0,
      pendingDay8: 0,
      pendingDay9: 0,
      pendingDay10: 0,
      pendingAbove21Days: 0,
      pendingAbove15Days: 0,
      pendingAbove10Days: 0,
      pendingAbove7Days: 0,
      pendingAbove3Days: 0,
      todayBooking: 0,
      pendingSv: 0,
    };

    baseFilteredData.forEach((row) => {
      const ageInDays = getElapsedDays(row['Order Date'], now);
      const orderDate = getStartOfDay(row['Order Date']);

      if (isOnlinePaidStatus(row['Online Refill Payment status'])) {
        metrics.onlinePaid += 1;
      }

      if (isEkycNotDoneStatus(row['EKYC Status'])) {
        metrics.eKycNotDone += 1;
      }

      if (isConsumerStatusMatch(row['Consumer Type'], 'SBC')) {
        metrics.sbcBooking += 1;
      }

      if (isConsumerStatusMatch(row['Consumer Type'], 'DBC')) {
        metrics.dbcBooking += 1;
      }

      if (ageInDays !== null) {
        if (ageInDays >= 2 && ageInDays <= 5) metrics.pending02To05Days += 1;
        if (ageInDays >= 5 && ageInDays <= 10) metrics.pending05To10Days += 1;
        if (ageInDays === 1) metrics.pendingDay1 += 1;
        if (ageInDays === 2) metrics.pendingDay2 += 1;
        if (ageInDays === 3) metrics.pendingDay3 += 1;
        if (ageInDays === 4) metrics.pendingDay4 += 1;
        if (ageInDays === 5) metrics.pendingDay5 += 1;
        if (ageInDays === 6) metrics.pendingDay6 += 1;
        if (ageInDays === 7) metrics.pendingDay7 += 1;
        if (ageInDays === 8) metrics.pendingDay8 += 1;
        if (ageInDays === 9) metrics.pendingDay9 += 1;
        if (ageInDays === 10) metrics.pendingDay10 += 1;
        if (ageInDays > 21) metrics.pendingAbove21Days += 1;
        if (ageInDays > 15) metrics.pendingAbove15Days += 1;
        if (ageInDays > 10) metrics.pendingAbove10Days += 1;
        if (ageInDays > 7) metrics.pendingAbove7Days += 1;
        if (ageInDays > 3) metrics.pendingAbove3Days += 1;
      }

      if (isPendingSvRow(row)) {
        metrics.pendingSv += 1;
      }

      if (orderDate) {
        if (orderDate.getTime() === today.getTime()) {
          metrics.todayBooking += 1;
        }
      }
    });

    return { metrics };
  }, [baseFilteredData]);

  const filteredData = useMemo(() => {
    if (!activeReportFilter) {
      return baseFilteredData;
    }
    return baseFilteredData.filter((row) => matchesReportFilter(row, activeReportFilter));
  }, [activeReportFilter, baseFilteredData]);

  useEffect(() => {
    setTimeout(() => {
      setCurrentPage(1);
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchTerm,
    eKycFilter,
    areaFilter,
    natureFilter,
    mobileStatusFilter,
    consumerStatusFilter,
    connectionTypeFilter,
    onlineRefillPaymentStatusFilter,
    orderDateStart,
    orderDateEnd,
    cashMemoDateStart,
    cashMemoDateEnd,
    sortBy,
    sortOrder,
    orderStatusFilter,
    orderSourceFilter,
    orderTypeFilter,
    cashMemoStatusFilter,
    deliveryManFilter,
    isRegMobileFilter,
    activeReportFilter,
  ]);



  // Calculate total pages
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  // Get current page data
  const currentTableData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, itemsPerPage]);
  const hasActiveDataFilters = Boolean(
    searchTerm
    || activeReportFilter
    || eKycFilter !== 'All'
    || areaFilter !== 'All'
    || natureFilter !== 'All'
    || mobileStatusFilter !== 'All'
    || consumerStatusFilter !== 'All'
    || connectionTypeFilter !== 'All'
    || onlineRefillPaymentStatusFilter !== 'All'
    || orderStatusFilter !== 'All'
    || orderSourceFilter !== 'All'
    || orderTypeFilter !== 'All'
    || cashMemoStatusFilter !== 'All'
    || deliveryManFilter !== 'All'
    || isRegMobileFilter !== 'All'
    || orderDateStart
    || orderDateEnd
    || cashMemoDateStart
    || cashMemoDateEnd
    || sortBy
    || sortOrder !== 'asc'
  );
  const shouldShowEmptyUploadState = showParsedData && parsedData.length === 0;
  const shouldShowFilteredEmptyState = showParsedData && parsedData.length > 0 && filteredData.length === 0;
  const activeFilterChips = [
    searchTerm ? { key: 'search', label: `Search: ${searchTerm}`, clear: () => setSearchTerm('') } : null,
    activeReportFilter ? { key: 'report', label: `Report: ${activeReportFilter}`, clear: () => setActiveReportFilter('') } : null,
    eKycFilter !== 'All' ? { key: 'ekyc', label: `EKYC: ${eKycFilter}`, clear: () => setEKycFilter('All') } : null,
    areaFilter !== 'All' ? { key: 'area', label: `Area: ${areaFilter}`, clear: () => setAreaFilter('All') } : null,
    natureFilter !== 'All' ? { key: 'nature', label: `Nature: ${natureFilter}`, clear: () => setNatureFilter('All') } : null,
    mobileStatusFilter !== 'All' ? { key: 'mobile', label: `Mobile: ${mobileStatusFilter}`, clear: () => setMobileStatusFilter('All') } : null,
    onlineRefillPaymentStatusFilter !== 'All' ? { key: 'payment', label: `Payment: ${onlineRefillPaymentStatusFilter}`, clear: () => setOnlineRefillPaymentStatusFilter('All') } : null,
    orderTypeFilter !== 'All' ? { key: 'orderType', label: `Order Type: ${orderTypeFilter}`, clear: () => setOrderTypeFilter('All') } : null,
    consumerStatusFilter !== 'All' ? { key: 'consumerType', label: `Consumer Type: ${consumerStatusFilter}`, clear: () => setConsumerStatusFilter('All') } : null,
    connectionTypeFilter !== 'All' ? { key: 'connection', label: `Connection: ${connectionTypeFilter}`, clear: () => setConnectionTypeFilter('All') } : null,
    orderStatusFilter !== 'All' ? { key: 'orderStatus', label: `Order Status: ${orderStatusFilter}`, clear: () => setOrderStatusFilter('All') } : null,
    orderSourceFilter !== 'All' ? { key: 'orderSource', label: `Order Source: ${orderSourceFilter}`, clear: () => setOrderSourceFilter('All') } : null,
    cashMemoStatusFilter !== 'All' ? { key: 'cashMemoStatus', label: `Cash Memo: ${cashMemoStatusFilter}`, clear: () => setCashMemoStatusFilter('All') } : null,
    deliveryManFilter !== 'All' ? { key: 'deliveryMan', label: `Delivery Man: ${deliveryManFilter}`, clear: () => setDeliveryManFilter('All') } : null,
    isRegMobileFilter !== 'All' ? { key: 'regMobile', label: `Reg Mobile: ${isRegMobileFilter}`, clear: () => setIsRegMobileFilter('All') } : null,
    orderDateStart || orderDateEnd ? {
      key: 'orderDate',
      label: `Order Date: ${orderDateStart || 'Any'} to ${orderDateEnd || 'Any'}`,
      clear: () => {
        setOrderDateStart('');
        setOrderDateEnd('');
      },
    } : null,
    cashMemoDateStart || cashMemoDateEnd ? {
      key: 'cashMemoDate',
      label: `Cash Memo Date: ${cashMemoDateStart || 'Any'} to ${cashMemoDateEnd || 'Any'}`,
      clear: () => {
        setCashMemoDateStart('');
        setCashMemoDateEnd('');
      },
    } : null,
    sortBy ? {
      key: 'sort',
      label: `Sort: ${sortBy} (${sortOrder})`,
      clear: () => {
        setSortBy('');
        setSortOrder('asc');
      },
    } : null,
  ].filter(Boolean);

  const {
    selectedCustomerIds,
    isAllFilteredRowsSelected,
    selectedCustomersForPrint,
    handleCheckboxChange,
    handleSelectAllChange,
    clearSelection,
  } = useCashmemoSelection(filteredData);

  const selectedFilteredRows = filteredData.filter((row) => selectedCustomerIds.includes(String(row['Consumer No.'])));

  const reportCards = [
    { key: 'totalPendingBooking', label: 'Total Pending', value: bookingReport.metrics.totalPendingBooking },
    { key: 'onlinePaid', label: 'Online Paid', value: bookingReport.metrics.onlinePaid },
    { key: 'eKycNotDone', label: 'EKYC Pending', value: bookingReport.metrics.eKycNotDone },
    { key: 'sbcBooking', label: 'SBC Booking', value: bookingReport.metrics.sbcBooking },
    { key: 'dbcBooking', label: 'DBC Booking', value: bookingReport.metrics.dbcBooking },
    { key: 'pendingSv', label: 'Pending SV', value: bookingReport.metrics.pendingSv },
    { key: 'todayBooking', label: "Today's Booking", value: bookingReport.metrics.todayBooking },
    { key: 'pendingDay1', label: '1 Day', value: bookingReport.metrics.pendingDay1 },
    { key: 'pendingDay2', label: '2 Days', value: bookingReport.metrics.pendingDay2 },
    { key: 'pendingDay3', label: '3 Days', value: bookingReport.metrics.pendingDay3 },
    { key: 'pendingDay4', label: '4 Days', value: bookingReport.metrics.pendingDay4 },
    { key: 'pendingDay5', label: '5 Days', value: bookingReport.metrics.pendingDay5 },
    { key: 'pendingDay6', label: '6 Days', value: bookingReport.metrics.pendingDay6 },
    { key: 'pendingDay7', label: '7 Days', value: bookingReport.metrics.pendingDay7 },
    { key: 'pendingDay8', label: '8 Days', value: bookingReport.metrics.pendingDay8 },
    { key: 'pendingDay9', label: '9 Days', value: bookingReport.metrics.pendingDay9 },
    { key: 'pendingDay10', label: '10 Days', value: bookingReport.metrics.pendingDay10 },
    { key: 'pending02To05Days', label: '02 - 05 Days', value: bookingReport.metrics.pending02To05Days },
    { key: 'pending05To10Days', label: '05 - 10 Days', value: bookingReport.metrics.pending05To10Days },
    { key: 'pendingAbove3Days', label: '> 3 Days', value: bookingReport.metrics.pendingAbove3Days },
    { key: 'pendingAbove7Days', label: '> 7 Days', value: bookingReport.metrics.pendingAbove7Days },
    { key: 'pendingAbove10Days', label: '> 10 Days', value: bookingReport.metrics.pendingAbove10Days },
    { key: 'pendingAbove15Days', label: '> 15 Days', value: bookingReport.metrics.pendingAbove15Days },
    { key: 'pendingAbove21Days', label: '> 21 Days', value: bookingReport.metrics.pendingAbove21Days },
  ];
  const reportFilterOptions = reportCards.filter((card) => card.key !== 'totalPendingBooking');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const availableEkycOptions = useMemo(() => sortedUniqueValues(applyStructuredFilters(parsedData, ['eKycFilter']).map(row => row['EKYC Status'])), [parsedData, searchTerm, areaFilter, natureFilter, mobileStatusFilter, consumerStatusFilter, connectionTypeFilter, onlineRefillPaymentStatusFilter, orderStatusFilter, orderSourceFilter, orderTypeFilter, cashMemoStatusFilter, deliveryManFilter, isRegMobileFilter, orderDateStart, orderDateEnd, cashMemoDateStart, cashMemoDateEnd, activeReportFilter]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const availableAreaOptions = useMemo(() => sortedUniqueValues(applyStructuredFilters(parsedData, ['areaFilter']).map(row => row['Delivery Area'])), [parsedData, searchTerm, eKycFilter, natureFilter, mobileStatusFilter, consumerStatusFilter, connectionTypeFilter, onlineRefillPaymentStatusFilter, orderStatusFilter, orderSourceFilter, orderTypeFilter, cashMemoStatusFilter, deliveryManFilter, isRegMobileFilter, orderDateStart, orderDateEnd, cashMemoDateStart, cashMemoDateEnd, activeReportFilter]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const availableNatureOptions = useMemo(() => sortedUniqueValues(applyStructuredFilters(parsedData, ['natureFilter']).map(row => row['Consumer Nature'])), [parsedData, searchTerm, eKycFilter, areaFilter, mobileStatusFilter, consumerStatusFilter, connectionTypeFilter, onlineRefillPaymentStatusFilter, orderStatusFilter, orderSourceFilter, orderTypeFilter, cashMemoStatusFilter, deliveryManFilter, isRegMobileFilter, orderDateStart, orderDateEnd, cashMemoDateStart, cashMemoDateEnd, activeReportFilter]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const availableMobileStatusOptions = useMemo(() => sortedUniqueValues(applyStructuredFilters(parsedData, ['mobileStatusFilter']).map(row => (row['Mobile No.'] && row['Mobile No.'] !== '' ? 'Available' : 'Not Available'))), [parsedData, searchTerm, eKycFilter, areaFilter, natureFilter, consumerStatusFilter, connectionTypeFilter, onlineRefillPaymentStatusFilter, orderStatusFilter, orderSourceFilter, orderTypeFilter, cashMemoStatusFilter, deliveryManFilter, isRegMobileFilter, orderDateStart, orderDateEnd, cashMemoDateStart, cashMemoDateEnd, activeReportFilter]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const availableConsumerStatusOptions = useMemo(() => sortedUniqueValues(applyStructuredFilters(parsedData, ['consumerStatusFilter']).map(row => row['Consumer Type'])), [parsedData, searchTerm, eKycFilter, areaFilter, natureFilter, mobileStatusFilter, connectionTypeFilter, onlineRefillPaymentStatusFilter, orderStatusFilter, orderSourceFilter, orderTypeFilter, cashMemoStatusFilter, deliveryManFilter, isRegMobileFilter, orderDateStart, orderDateEnd, cashMemoDateStart, cashMemoDateEnd, activeReportFilter]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const availableConnectionTypeOptions = useMemo(() => sortedUniqueValues(applyStructuredFilters(parsedData, ['connectionTypeFilter']).map(row => row['Consumer Package'])), [parsedData, searchTerm, eKycFilter, areaFilter, natureFilter, mobileStatusFilter, consumerStatusFilter, onlineRefillPaymentStatusFilter, orderStatusFilter, orderSourceFilter, orderTypeFilter, cashMemoStatusFilter, deliveryManFilter, isRegMobileFilter, orderDateStart, orderDateEnd, cashMemoDateStart, cashMemoDateEnd, activeReportFilter]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const availableOnlinePaymentOptions = useMemo(() => sortedUniqueValues(applyStructuredFilters(parsedData, ['onlineRefillPaymentStatusFilter']).map(row => row['Online Refill Payment status'])), [parsedData, searchTerm, eKycFilter, areaFilter, natureFilter, mobileStatusFilter, consumerStatusFilter, connectionTypeFilter, orderStatusFilter, orderSourceFilter, orderTypeFilter, cashMemoStatusFilter, deliveryManFilter, isRegMobileFilter, orderDateStart, orderDateEnd, cashMemoDateStart, cashMemoDateEnd, activeReportFilter]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const availableOrderStatusOptions = useMemo(() => sortedUniqueValues(applyStructuredFilters(parsedData, ['orderStatusFilter']).map(row => row['Order Status'])), [parsedData, searchTerm, eKycFilter, areaFilter, natureFilter, mobileStatusFilter, consumerStatusFilter, connectionTypeFilter, onlineRefillPaymentStatusFilter, orderSourceFilter, orderTypeFilter, cashMemoStatusFilter, deliveryManFilter, isRegMobileFilter, orderDateStart, orderDateEnd, cashMemoDateStart, cashMemoDateEnd, activeReportFilter]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const availableOrderSourceOptions = useMemo(() => sortedUniqueValues(applyStructuredFilters(parsedData, ['orderSourceFilter']).map(row => row['Order Source'])), [parsedData, searchTerm, eKycFilter, areaFilter, natureFilter, mobileStatusFilter, consumerStatusFilter, connectionTypeFilter, onlineRefillPaymentStatusFilter, orderStatusFilter, orderTypeFilter, cashMemoStatusFilter, deliveryManFilter, isRegMobileFilter, orderDateStart, orderDateEnd, cashMemoDateStart, cashMemoDateEnd, activeReportFilter]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const availableOrderTypeOptions = useMemo(() => sortedUniqueValues(applyStructuredFilters(parsedData, ['orderTypeFilter']).map(row => row['Order Type'])), [parsedData, searchTerm, eKycFilter, areaFilter, natureFilter, mobileStatusFilter, consumerStatusFilter, connectionTypeFilter, onlineRefillPaymentStatusFilter, orderStatusFilter, orderSourceFilter, cashMemoStatusFilter, deliveryManFilter, isRegMobileFilter, orderDateStart, orderDateEnd, cashMemoDateStart, cashMemoDateEnd, activeReportFilter]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const availableCashMemoStatusOptions = useMemo(() => sortedUniqueValues(applyStructuredFilters(parsedData, ['cashMemoStatusFilter']).map(row => row['Cash Memo Status'])), [parsedData, searchTerm, eKycFilter, areaFilter, natureFilter, mobileStatusFilter, consumerStatusFilter, connectionTypeFilter, onlineRefillPaymentStatusFilter, orderStatusFilter, orderSourceFilter, orderTypeFilter, deliveryManFilter, isRegMobileFilter, orderDateStart, orderDateEnd, cashMemoDateStart, cashMemoDateEnd, activeReportFilter]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const availableDeliveryManOptions = useMemo(() => sortedUniqueValues(applyStructuredFilters(parsedData, ['deliveryManFilter']).map(row => row['Delivery Man'])), [parsedData, searchTerm, eKycFilter, areaFilter, natureFilter, mobileStatusFilter, consumerStatusFilter, connectionTypeFilter, onlineRefillPaymentStatusFilter, orderStatusFilter, orderSourceFilter, orderTypeFilter, cashMemoStatusFilter, isRegMobileFilter, orderDateStart, orderDateEnd, cashMemoDateStart, cashMemoDateEnd, activeReportFilter]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const availableIsRegMobileOptions = useMemo(() => sortedUniqueValues(applyStructuredFilters(parsedData, ['isRegMobileFilter']).map(row => (row['Is Reg Mobile'] && row['Is Reg Mobile'] !== '' ? 'Yes' : 'No'))), [parsedData, searchTerm, eKycFilter, areaFilter, natureFilter, mobileStatusFilter, consumerStatusFilter, connectionTypeFilter, onlineRefillPaymentStatusFilter, orderStatusFilter, orderSourceFilter, orderTypeFilter, cashMemoStatusFilter, deliveryManFilter, orderDateStart, orderDateEnd, cashMemoDateStart, cashMemoDateEnd, activeReportFilter]);

  useEffect(() => {
    if (eKycFilter !== 'All' && !availableEkycOptions.includes(eKycFilter)) setEKycFilter('All');
    if (areaFilter !== 'All' && !availableAreaOptions.includes(areaFilter)) setAreaFilter('All');
    if (natureFilter !== 'All' && !availableNatureOptions.includes(natureFilter)) setNatureFilter('All');
    if (mobileStatusFilter !== 'All' && !availableMobileStatusOptions.includes(mobileStatusFilter)) setMobileStatusFilter('All');
    if (consumerStatusFilter !== 'All' && !availableConsumerStatusOptions.includes(consumerStatusFilter)) setConsumerStatusFilter('All');
    if (connectionTypeFilter !== 'All' && !availableConnectionTypeOptions.includes(connectionTypeFilter)) setConnectionTypeFilter('All');
    if (onlineRefillPaymentStatusFilter !== 'All' && !availableOnlinePaymentOptions.includes(onlineRefillPaymentStatusFilter)) setOnlineRefillPaymentStatusFilter('All');
    if (orderStatusFilter !== 'All' && !availableOrderStatusOptions.includes(orderStatusFilter)) setOrderStatusFilter('All');
    if (orderSourceFilter !== 'All' && !availableOrderSourceOptions.includes(orderSourceFilter)) setOrderSourceFilter('All');
    if (orderTypeFilter !== 'All' && !availableOrderTypeOptions.includes(orderTypeFilter)) setOrderTypeFilter('All');
    if (cashMemoStatusFilter !== 'All' && !availableCashMemoStatusOptions.includes(cashMemoStatusFilter)) setCashMemoStatusFilter('All');
    if (deliveryManFilter !== 'All' && !availableDeliveryManOptions.includes(deliveryManFilter)) setDeliveryManFilter('All');
    if (isRegMobileFilter !== 'All' && !availableIsRegMobileOptions.includes(isRegMobileFilter)) setIsRegMobileFilter('All');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eKycFilter, areaFilter, natureFilter, mobileStatusFilter, consumerStatusFilter, connectionTypeFilter, onlineRefillPaymentStatusFilter, orderStatusFilter, orderSourceFilter, orderTypeFilter, cashMemoStatusFilter, deliveryManFilter, isRegMobileFilter, availableEkycOptions, availableAreaOptions, availableNatureOptions, availableMobileStatusOptions, availableConsumerStatusOptions, availableConnectionTypeOptions, availableOnlinePaymentOptions, availableOrderStatusOptions, availableOrderSourceOptions, availableOrderTypeOptions, availableCashMemoStatusOptions, availableDeliveryManOptions, availableIsRegMobileOptions]);

  const addColumn = (header) => {
    if (!visibleHeaders.includes(header)) {
      setVisibleHeaders(prev => [...prev, header]);
    }
  };

  const removeColumn = (header) => {
    setVisibleHeaders(prev => prev.filter(h => h !== header));
  };

  const handleSaveRatesForUser = async (rates) => {
    if (!loggedInUser?.id) return;
    const normalizedRates = Array.isArray(rates) ? rates : [];
    await submitUpdateApprovalRequest({
      type: 'rates',
      payload: normalizedRates,
      localKey: 'ratesData',
      successMessage: 'Rate update request submitted. Your request is pending with admin for approval.',
    });
  };

  const persistCashMemoLabelSettings = (settings) => {
    const mergedSettings = mergeCashMemoLabelSettings(settings);
    const storageKey = getCashMemoLabelSettingsStorageKey(loggedInUser?.dealerCode);
    localStorage.setItem(storageKey, JSON.stringify(mergedSettings));
    if (!loggedInUser?.id) return;

    updateUserInStore(
      loggedInUser.id,
      (user) => ({ ...user, cashMemoLabelSettings: mergedSettings }),
      loggedInUser.dealerCode
    );

    updateUserInFirebase(loggedInUser.id, { cashMemoLabelSettings: mergedSettings }, loggedInUser.dealerCode)
      .catch(() => {
        pushToast('Label update saved locally, but Firebase sync failed.', 'error');
      });
  };

  const handleSaveCashMemoLabels = () => {
    const nextSettings = mergeCashMemoLabelSettings(labelDraftSettings);
    setCashMemoLabelSettings(nextSettings);
    persistCashMemoLabelSettings(nextSettings);
    pushToast('Label settings updated.', 'success');
  };
//test
  const updateCashMemoLabelSetting = (targetPageType, labelKey, checked) => {
    setLabelDraftSettings((prev) => {
      const next = mergeCashMemoLabelSettings(prev);
      next[targetPageType] = {
        ...next[targetPageType],
        [labelKey]: checked,
      };
      return next;
    });
  };

  const setAllCashMemoLabelsForPage = (targetPageType, checked) => {
    setLabelDraftSettings((prev) => {
      const next = mergeCashMemoLabelSettings(prev);
      next[targetPageType] = CASHMEMO_LABEL_OPTIONS.reduce((acc, item) => {
        acc[item.key] = checked;
        return acc;
      }, {});
      return next;
    });
  };

  const resetCashMemoLabelsForPage = (targetPageType) => {
    setLabelDraftSettings((prev) => {
      const defaults = createDefaultCashMemoLabelSettings();
      const next = mergeCashMemoLabelSettings(prev);
      next[targetPageType] = defaults[targetPageType];
      return next;
    });
  };

  const LabelUpdatePage = () => {
    const activeSettings = labelDraftSettings[labelUpdatePageType] || {};
    const groupedLabels = CASHMEMO_LABEL_OPTIONS.reduce((acc, item) => {
      if (!acc[item.group]) acc[item.group] = [];
      acc[item.group].push(item);
      return acc;
    }, {});

    return (
      <div className="placeholder-container label-update-page">
        <div className="label-update-header">
          <div>
            <h2>Label Update</h2>
            <p>Cashmemo print labels, page type select.</p>
          </div>
          <div className="label-update-actions">
            <select className="form-input" value={labelUpdatePageType} onChange={(e) => setLabelUpdatePageType(e.target.value)}>
              {CASHMEMO_PAGE_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <button type="button" onClick={() => setAllCashMemoLabelsForPage(labelUpdatePageType, true)}>Select All</button>
            <button type="button" onClick={() => setAllCashMemoLabelsForPage(labelUpdatePageType, false)}>Clear All</button>
            <button type="button" onClick={() => resetCashMemoLabelsForPage(labelUpdatePageType)}>Reset Default</button>
          </div>
        </div>

        <div className="label-update-grid">
          {Object.entries(groupedLabels).map(([group, items]) => (
            <section key={group} className="label-update-section">
              <h3>{group}</h3>
              <div className="label-checkbox-list">
                {items.map((item) => (
                  <label key={item.key} className="label-checkbox-item">
                    <input
                      type="checkbox"
                      checked={activeSettings[item.key] !== false}
                      onChange={(e) => updateCashMemoLabelSetting(labelUpdatePageType, item.key, e.target.checked)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="form-actions">
          <button onClick={handleSaveCashMemoLabels}>Save</button>
          <button onClick={() => {
            setLabelDraftSettings(mergeCashMemoLabelSettings(cashMemoLabelSettings));
            navigateToHome();
          }}>Close</button>
        </div>
      </div>
    );
  };

  const availableHeadersToAdd = headers.filter(header => !visibleHeaders.includes(header));
  const hideUserNavbar = showAdminPanel;
  const pendingTypesFromUpdates = Object.entries(loggedInUser?.pendingUpdates || {})
    .filter(([, value]) => String(value?.status || '').toLowerCase() === 'pending')
    .map(([type]) => normalizePendingTypeLabel(type));
  const pendingTypesFromStatus = Object.entries(loggedInUser?.approvalStatus || {})
    .filter(([, status]) => status === 'pending')
    .map(([type]) => normalizePendingTypeLabel(type));
  const pendingUserApprovalTypes = Array.from(new Set([...pendingTypesFromUpdates, ...pendingTypesFromStatus]));
  const deliveryAreaUpdates = Array.isArray(loggedInUser?.deliveryAreaUpdates) ? loggedInUser.deliveryAreaUpdates : [];
  const deliveryStaffUpdates = Array.isArray(loggedInUser?.deliveryStaffUpdates) ? loggedInUser.deliveryStaffUpdates : [];
  const navbarPackageName = formatPackageNameForNavbar(loggedInUser?.package);
  const packageValidityText = loggedInUser?.validTill
    ? isPlanExpired
      ? `& Expired on ${formatDisplayDate(loggedInUser.validTill)}`
      : `& It will expire in ${getRemainingDays(loggedInUser.validTill)} Days`
    : '';
  const approvalReplyMap = readApprovalRepliesFromStorage();
  const planUpgradeReplyKey = getPlanUpgradeReplyStorageKey({
    userId: loggedInUser?.id,
    dealerCode: loggedInUser?.dealerCode,
    dealerName: loggedInUser?.dealerName,
  });
  const planUpgradeReplyText = String(
    loggedInUser?.pendingUpdates?.planUpgrade?.adminReply
    || approvalReplyMap[planUpgradeReplyKey]
    || ''
  ).trim();
  const userMenuStatusText = isPlanExpired ? 'Expired' : (loggedInUser?.status || 'Active');
  const menuDisabledReason = isPlanExpired ? 'Available after plan renewal' : '';
  const pendingRequestCount = pendingUserApprovalTypes.length;
  const pendingDictionaryCount = getPendingDictionaryRequestCount(loggedInUser);
  const currentUserView = showUpgradePlan ? 'upgradePlan'
    : showUserProfile ? 'userProfile'
    : showContactForm ? 'support'
    : showParsedData ? 'dataUpload'
    : showProfileUpdate ? 'profileUpdate'
    : showRateUpdate ? 'rateUpdate'
    : showBankDetails ? 'bankUpdate'
    : showDictionaryForm
      ? (dictionaryFormMode === 'deliveryArea'
        ? 'deliveryAreaUpdate'
        : dictionaryFormMode === 'deliveryStaff'
          ? 'deliveryStaffUpdate'
          : 'dictionaryUpdate')
      : showLabelUpdate ? 'labelUpdate'
      : showHeaderUpdate ? 'headerUpdate'
      : showInvoicePage ? 'invoice'
      : showAboutInfo ? 'about'
      : showHomeInfo ? 'home'
      : '';
  const updateInboxCount = pendingRequestCount + pendingDictionaryCount + contactReplyCount + (planUpgradeReplyText ? 1 : 0);
  const userMenuBadgeCount = updateInboxCount > 0 ? (updateInboxCount > 9 ? '9+' : updateInboxCount) : '';
  const userRole = String(loggedInUser?.role || 'user').toLowerCase();
  const profileData = loggedInUser?.profileData || {};
  const bankDetailsData = loggedInUser?.bankDetailsData || {};
  const headerData = loggedInUser?.hindiHeaderData || {};
  const ratesData = Array.isArray(loggedInUser?.ratesData) ? loggedInUser.ratesData : [];
  const profileCompletenessChecks = [
    { key: 'profile', label: 'Profile', complete: Boolean(profileData.distributorName && profileData.contact && profileData.address && profileData.gst) },
    { key: 'bank', label: 'Bank', complete: Boolean(bankDetailsData.bankName && bankDetailsData.accountNo && bankDetailsData.ifsc) },
    { key: 'header', label: 'Header', complete: Boolean(headerData.distributorName && headerData.address && headerData.email) },
    { key: 'rates', label: 'Rates', complete: ratesData.length > 0 },
  ];
  const incompleteProfileAreas = profileCompletenessChecks.filter((item) => !item.complete);
  const profileCompletenessLabel = `${profileCompletenessChecks.length - incompleteProfileAreas.length}/${profileCompletenessChecks.length} complete`;
  const profileCompletionPercent = Math.round(((profileCompletenessChecks.length - incompleteProfileAreas.length) / profileCompletenessChecks.length) * 100);
  const userAvatarLabel = (() => {
    const source = String(loggedInUser?.dealerName || loggedInUser?.dealerCode || 'U').trim();
    if (!source) return 'U';
    const words = source.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  })();
  const userAvatarImage = profileData.photoDataUrl || '';
  const userMenuPackageTips = isHindiEnterprisePackage(loggedInUser?.package)
    ? [
        {
          text: 'Hindi package active: dictionary, delivery area/staff, and header tools are available.',
          actionLabel: 'Open Hindi Tools',
          onClick: handleDictionaryOpen,
          viewKey: 'dictionaryUpdate',
          disabled: isPlanExpired || !isEnterpriseHindiPackage(loggedInUser?.package),
        },
        {
          text: 'Use approval badges to quickly track pending Hindi updates.',
          actionLabel: 'Open Request History',
          onClick: handleRequestHistoryOpen,
          beforeOpen: () => setUserProfileInitialSection('history'),
          viewKey: 'userProfile',
          allowSameView: true,
        },
      ]
    : String(loggedInUser?.package || '').toLowerCase().includes('premium')
      ? [
          {
            text: 'Review rates, labels, and invoice workflow regularly with your Premium package.',
            actionLabel: 'Open Work Tools',
            onClick: hasWorkingData ? handleInvoiceOpen : handleReUploadClick,
            viewKey: hasWorkingData ? 'invoice' : 'dataUpload',
            disabled: isPlanExpired && hasWorkingData,
          },
          {
            text: 'Use support replies and request history to track approvals.',
            actionLabel: 'Track Updates',
            onClick: contactReplyCount > 0 ? handleContactOpen : handleRequestHistoryOpen,
            beforeOpen: contactReplyCount > 0 ? undefined : () => setUserProfileInitialSection('history'),
            viewKey: contactReplyCount > 0 ? 'support' : 'userProfile',
            allowSameView: true,
          },
        ]
      : [
          {
            text: 'Complete your profile and bank details to speed up onboarding on the Demo package.',
            actionLabel: incompleteProfileAreas.some((item) => item.key === 'profile') ? 'Complete Profile' : 'Update Bank',
            onClick: incompleteProfileAreas.some((item) => item.key === 'profile') ? handleProfileUpdate : handleBankDetails,
            viewKey: incompleteProfileAreas.some((item) => item.key === 'profile') ? 'profileUpdate' : 'bankUpdate',
            disabled: isPlanExpired,
          },
          {
            text: 'Renew your plan to unlock full work tools and advanced updates.',
            actionLabel: 'Open Renewal',
            onClick: handleUpgradePlanOpen,
            viewKey: 'upgradePlan',
            requiresConfirm: isPlanExpired,
            confirmMessage: 'Do you want to open the renewal form now?',
          },
        ];
  const hasWorkingData = Array.isArray(parsedData) && parsedData.length > 0;
  const collectMenuNames = (labels = [], predicate) => labels.filter((label) => {
    try {
      return Boolean(predicate(label));
    } catch {
      return false;
    }
  });
  const menuAccessRules = {
    profileOverview: () => true,
    requestHistory: () => true,
    about: () => !isPlanExpired,
    invoice: () => !isPlanExpired,
    profileUpdate: () => !isPlanExpired,
    bankUpdate: () => !isPlanExpired,
    rateUpdate: () => !isPlanExpired,
    labelUpdate: () => !isPlanExpired,
    dictionaryUpdate: () => !isPlanExpired && isEnterpriseHindiPackage(loggedInUser?.package),
    deliveryAreaUpdate: () => !isPlanExpired && isHindiEnterprisePackage(loggedInUser?.package),
    deliveryStaffUpdate: () => !isPlanExpired && isHindiEnterprisePackage(loggedInUser?.package),
    headerUpdate: () => !isPlanExpired && isHindiEnterprisePackage(loggedInUser?.package),
    upgradePlan: () => true,
    support: () => true,
  };
  const canAccessMenuFeature = (featureKey) => {
    const rule = menuAccessRules[featureKey];
    return typeof rule === 'function' ? rule() : true;
  };

  const getRequestBadge = (type) => {
    const pendingUpdate = loggedInUser?.pendingUpdates?.[type];
    const approvalStatus = String(loggedInUser?.approvalStatus?.[type] || '').toLowerCase();
    const pendingStatus = String(pendingUpdate?.status || approvalStatus || '').toLowerCase();

    if (type === 'planUpgrade' && planUpgradeReplyText) {
      return { label: 'Reply', tone: 'reply' };
    }
    if (pendingStatus === 'pending') {
      return { label: 'Pending', tone: 'pending' };
    }
    if (approvalStatus === 'approved') {
      return { label: 'Approved', tone: 'approved' };
    }
    if (approvalStatus === 'rejected') {
      return { label: 'Rejected', tone: 'rejected' };
    }
    if (type === 'planUpgrade' && isPlanExpired) {
      return { label: 'Expired', tone: 'rejected' };
    }
    return null;
  };

  const unreadMenuItems = new Set([
    ...(contactReplyCount > 0 ? ['Open Support & Replies'] : []),
    ...(planUpgradeReplyText ? ['Open Renewal'] : []),
    ...collectMenuNames(
      ['Update Profile', 'Update Bank Details', 'Update Rates', 'Update Dictionary', 'Update Delivery Area', 'Update Delivery Staff', 'Update Header'],
      (label) => {
        const lookup = {
          'Update Profile': 'profile',
          'Update Bank Details': 'bank',
          'Update Rates': 'rates',
          'Update Dictionary': 'dictionary',
          'Update Delivery Area': 'deliveryArea',
          'Update Delivery Staff': 'deliveryStaff',
          'Update Header': 'header',
        };
        const tone = getRequestBadge(lookup[label])?.tone;
        return tone === 'pending' || tone === 'reply';
      },
    ),
  ]);

  const getRequestActivityText = (type) => {
    const pendingUpdate = loggedInUser?.pendingUpdates?.[type];
    if (!pendingUpdate) return '';
    const requestedAt = pendingUpdate?.requestedAt || '';
    const approvedAt = pendingUpdate?.approvedAt || '';
    const rejectedAt = pendingUpdate?.rejectedAt || '';
    const adminReplyAt = pendingUpdate?.adminReplyAt || '';
    const status = String(pendingUpdate?.status || loggedInUser?.approvalStatus?.[type] || '').toLowerCase();

    if (status === 'pending' && requestedAt) {
      const elapsedDays = getElapsedDays(requestedAt);
      return elapsedDays === 0 ? 'Sent today' : `Waiting since ${elapsedDays} day${elapsedDays > 1 ? 's' : ''}`;
    }
    if (status === 'approved' && approvedAt) {
      return `Approved on ${formatDisplayDate(approvedAt) || 'recently'}`;
    }
    if (status === 'rejected' && rejectedAt) {
      return pendingUpdate?.adminReply ? 'Rejected with admin reply' : `Rejected on ${formatDisplayDate(rejectedAt) || 'recently'}`;
    }
    if (adminReplyAt) {
      return `Reply updated on ${formatDisplayDate(adminReplyAt) || 'recently'}`;
    }
    return '';
  };

  const getRequestHint = (type, fallbackHint = '') => {
    const badge = getRequestBadge(type);
    const activityText = getRequestActivityText(type);
    if (badge?.tone === 'reply') return 'Admin reply received. Open to review and continue.';
    if (badge?.tone === 'pending') return activityText || 'Request sent and waiting for admin approval.';
    if (badge?.tone === 'approved') return activityText || 'Latest request was approved.';
    if (badge?.tone === 'rejected') {
      if (type === 'planUpgrade' && isPlanExpired) {
        return 'Renew now to unlock uploads, invoice, and updates again.';
      }
      return activityText || 'Latest request was rejected. You can review and submit again.';
    }
    return fallbackHint;
  };

  const getDisabledReason = (featureKey, fallback = menuDisabledReason) => {
    if (!isPlanExpired) return fallback;
    const unlockMap = {
      about: 'Renew plan to open about resources with active account context.',
      invoice: 'Renew plan to access invoice tools again.',
      profileUpdate: 'Renew plan to submit profile changes again.',
      bankUpdate: 'Renew plan to submit bank changes again.',
      rateUpdate: 'Renew plan to upload or update rate data again.',
      labelUpdate: 'Renew plan to adjust label settings again.',
      dictionaryUpdate: 'Renew plan to send dictionary changes again.',
      deliveryAreaUpdate: 'Renew plan to update delivery areas again.',
      deliveryStaffUpdate: 'Renew plan to update delivery staff again.',
      headerUpdate: 'Renew plan to edit header details again.',
    };
    return unlockMap[featureKey] || fallback;
  };

  const closeUserMenu = (restoreFocus = false) => {
    setShowUserMenu(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        userMenuButtonRef.current?.focus();
      });
    }
  };

  const closeUserMenuAndRun = (action) => () => {
    closeUserMenu(false);
    if (typeof action === 'function') action();
  };

  const runUserMenuItem = (item) => () => {
    closeUserMenu(false);
    if (item?.viewKey && item.viewKey === currentUserView && !item?.allowSameView) return;
    if (item?.requiresConfirm && !window.confirm(item.confirmMessage || `Open ${item.label}?`)) return;
    if (typeof item?.beforeOpen === 'function') {
      item.beforeOpen();
    }
    if (typeof item?.onClick === 'function') {
      item.onClick();
    }
  };

  const primaryQuickAction = isPlanExpired
    ? { label: 'Renew Plan', onClick: handleUpgradePlanOpen, viewKey: 'upgradePlan' }
    : incompleteProfileAreas.some((item) => item.key === 'profile')
      ? { label: 'Complete Profile', onClick: handleProfileUpdate, viewKey: 'profileUpdate' }
      : ratesData.length === 0
        ? { label: 'Update Rates', onClick: handleRateUpdate, viewKey: 'rateUpdate' }
        : { label: 'View Profile', onClick: handleUserProfile, viewKey: 'userProfile', allowSameView: true };
  const secondaryQuickAction = pendingRequestCount > 0 || planUpgradeReplyText
    ? { label: 'Request History', onClick: handleRequestHistoryOpen, viewKey: 'userProfile', beforeOpen: () => setUserProfileInitialSection('history'), allowSameView: true }
    : !bankDetailsData.bankName
      ? { label: 'Update Bank', onClick: handleBankDetails, viewKey: 'bankUpdate' }
      : { label: 'Open Support', onClick: handleContactOpen, viewKey: 'support' };
  const userMenuEmptyGuidance = isPlanExpired
    ? 'Renew your plan to restore uploads, invoice tools, and update requests.'
    : !hasWorkingData
      ? 'No working data has been uploaded yet. Start with Upload Data.'
      : updateInboxCount === 0 && incompleteProfileAreas.length === 0
        ? 'Everything looks up to date. You can open Data View or Invoice tools next.'
        : 'Use the quick actions to complete the next best step.';
  const handleOpenRenewalHistory = () => {
    setUserProfileInitialSection('history');
    handleRequestHistoryOpen();
  };
  const profileCompletenessActions = {
    profile: {
      label: 'Complete Profile',
      onClick: handleProfileUpdate,
      viewKey: 'profileUpdate',
    },
    bank: {
      label: 'Complete Bank',
      onClick: handleBankDetails,
      viewKey: 'bankUpdate',
    },
    header: {
      label: 'Complete Header',
      onClick: handleHeaderUpdate,
      viewKey: 'headerUpdate',
      disabled: !canAccessMenuFeature('headerUpdate'),
    },
    rates: {
      label: 'Complete Rates',
      onClick: handleRateUpdate,
      viewKey: 'rateUpdate',
    },
  };
  const incompleteProfileActionItems = incompleteProfileAreas
    .map((item) => ({
      ...item,
      ...(profileCompletenessActions[item.key] || {}),
    }))
    .filter((item) => item.onClick);

  const userMenuConfig = [
    {
      title: 'Updates',
      items: [
        { label: 'View Request History', onClick: handleRequestHistoryOpen, viewKey: 'userProfile', beforeOpen: () => setUserProfileInitialSection('history'), allowSameView: true, hint: pendingRequestCount > 0 ? `${pendingRequestCount} request pending or recently updated.` : 'See past approval and request activity.' },
        { label: 'Open Support & Replies', onClick: handleContactOpen, viewKey: 'support', badge: contactReplyCount > 0 ? { label: contactReplyCount > 9 ? '9+' : String(contactReplyCount), tone: 'unread' } : null, hint: contactReplyCount > 0 ? `${contactReplyCount} unread admin repl${contactReplyCount > 1 ? 'ies are' : 'y is'} waiting.` : 'Open support chat and reply history.' },
        { label: 'Open Renewal', onClick: handleUpgradePlanOpen, viewKey: 'upgradePlan', badge: getRequestBadge('planUpgrade'), hint: getRequestHint('planUpgrade', isPlanExpired ? 'Renew your plan to restore full access.' : 'Review renewal options before expiry.'), requiresConfirm: isPlanExpired, confirmMessage: 'Do you want to open the renewal form now?' },
      ],
    },
    {
      title: 'Work',
      items: [
        { label: 'Update Profile', onClick: handleProfileUpdate, viewKey: 'profileUpdate', disabled: !canAccessMenuFeature('profileUpdate'), reason: getDisabledReason('profileUpdate'), badge: getRequestBadge('profile'), hint: getRequestHint('profile', 'Update distributor profile details.') },
        { label: 'Update Bank Details', onClick: handleBankDetails, viewKey: 'bankUpdate', disabled: !canAccessMenuFeature('bankUpdate'), reason: getDisabledReason('bankUpdate'), badge: getRequestBadge('bank'), hint: getRequestHint('bank', 'Update bank details for records and billing.') },
        { label: 'Update Rates', onClick: handleRateUpdate, viewKey: 'rateUpdate', disabled: !canAccessMenuFeature('rateUpdate'), reason: getDisabledReason('rateUpdate'), badge: getRequestBadge('rates'), hint: getRequestHint('rates', 'Send revised rate data for approval.') },
        { label: showParsedData ? 'Open Data View' : 'Upload Data', onClick: showParsedData ? handleShowData : handleReUploadClick, viewKey: 'dataUpload', disabled: isPlanExpired, reason: isPlanExpired ? 'Renew plan to upload and manage working data again.' : '', hint: showParsedData ? `Return to your uploaded data view${hasWorkingData ? ` (${parsedData.length} rows loaded)` : ''}.` : 'Upload distributor working data.' },
        { label: 'Open Invoice', onClick: handleInvoiceOpen, viewKey: 'invoice', disabled: !canAccessMenuFeature('invoice'), reason: getDisabledReason('invoice'), hint: isPlanExpired ? getDisabledReason('invoice') : 'Open invoice tools and exports.' },
        { label: 'Update Labels', onClick: handleLabelUpdate, viewKey: 'labelUpdate', disabled: !canAccessMenuFeature('labelUpdate'), reason: getDisabledReason('labelUpdate'), hint: isPlanExpired ? getDisabledReason('labelUpdate') : 'Adjust print layout labels for cashmemo output.' },
        {
          label: 'Update Dictionary',
          onClick: handleDictionaryOpen,
          viewKey: 'dictionaryUpdate',
          disabled: !canAccessMenuFeature('dictionaryUpdate'),
          reason: !isEnterpriseHindiPackage(loggedInUser?.package) ? 'Available in Hindi enterprise package.' : getDisabledReason('dictionaryUpdate'),
          badge: pendingDictionaryCount > 0 ? { label: String(pendingDictionaryCount), tone: 'pending' } : null,
          hint: pendingDictionaryCount > 0 ? 'Dictionary changes are waiting for admin approval.' : 'Manage Hindi translation dictionary updates.',
          show: isEnterpriseHindiPackage(loggedInUser?.package),
        },
        {
          label: 'Upgrade Plan',
          onClick: handleUpgradePlanOpen,
          viewKey: 'upgradePlan',
          badge: getRequestBadge('planUpgrade'),
          hint: getRequestHint('planUpgrade', isPlanExpired ? 'Renew your plan to restore full access.' : 'Review renewal options before expiry.'),
        },
        {
          label: 'Update Delivery Area',
          onClick: handleDeliveryAreaUpdate,
          viewKey: 'deliveryAreaUpdate',
          disabled: !canAccessMenuFeature('deliveryAreaUpdate'),
          reason: !isHindiEnterprisePackage(loggedInUser?.package) ? 'Available in Hindi enterprise package.' : getDisabledReason('deliveryAreaUpdate'),
          badge: getRequestBadge('deliveryArea'),
          hint: getRequestHint('deliveryArea', 'Update delivery area mappings for approval.'),
          show: isHindiEnterprisePackage(loggedInUser?.package),
        },
        {
          label: 'Update Delivery Staff',
          onClick: handleDeliveryStaffUpdate,
          viewKey: 'deliveryStaffUpdate',
          disabled: !canAccessMenuFeature('deliveryStaffUpdate'),
          reason: !isHindiEnterprisePackage(loggedInUser?.package) ? 'Available in Hindi enterprise package.' : getDisabledReason('deliveryStaffUpdate'),
          badge: getRequestBadge('deliveryStaff'),
          hint: getRequestHint('deliveryStaff', 'Update delivery staff list for approval.'),
          show: isHindiEnterprisePackage(loggedInUser?.package),
        },
        {
          label: 'Update Header',
          onClick: handleHeaderUpdate,
          viewKey: 'headerUpdate',
          disabled: !canAccessMenuFeature('headerUpdate'),
          reason: !isHindiEnterprisePackage(loggedInUser?.package) ? 'Available in Hindi enterprise package.' : getDisabledReason('headerUpdate'),
          badge: getRequestBadge('header'),
          hint: getRequestHint('header', 'Update Hindi header information for approval.'),
          show: isHindiEnterprisePackage(loggedInUser?.package),
        },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'View Profile', onClick: handleUserProfile, viewKey: 'userProfile', allowSameView: true, hint: 'View account details, package info, and profile summary.' },
        { label: 'Open About', onClick: handleAboutOpen, viewKey: 'about', disabled: !canAccessMenuFeature('about'), reason: getDisabledReason('about') },
      ],
    },
  ];

  const userMenuSections = userMenuConfig
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) => item.show !== false)
        .map((item) => ({
          ...item,
          unread: unreadMenuItems.has(item.label),
          active: item.viewKey === 'userProfile'
            ? (currentUserView === 'userProfile'
              && ((item.beforeOpen && userProfileInitialSection === 'history')
                || (!item.beforeOpen && userProfileInitialSection !== 'history')))
            : item.viewKey === currentUserView,
        })),
    }))
    .filter((section) => section.items.length > 0);

  const userMenuSummaryPills = [
    updateInboxCount > 0 ? { label: `${updateInboxCount} Updates`, tone: 'unread' } : null,
    pendingRequestCount > 0 ? { label: `${pendingRequestCount} Pending`, tone: 'pending' } : null,
    pendingDictionaryCount > 0 ? { label: `${pendingDictionaryCount} Dictionary`, tone: 'pending' } : null,
    contactReplyCount > 0 ? { label: `${contactReplyCount} Replies`, tone: 'unread' } : null,
    isPlanExpired ? { label: 'Plan Expired', tone: 'rejected' } : { label: userMenuStatusText, tone: 'approved' },
    { label: profileCompletenessLabel, tone: incompleteProfileAreas.length > 0 ? 'pending' : 'approved' },
  ].filter(Boolean);

  return (
    <>
      {isLoggedIn && !isPlanExpired && <FileUpload onFileUpload={handleFileUpload} ref={fileInputRef} />}
      {toastItems.length > 0 && (
        <div className="toast-stack" aria-live="polite" aria-atomic="true">
          {toastItems.map((toast) => (
            <div key={toast.id} className={`toast-item toast-item--${toast.tone}`}>
              <span>{toast.message}</span>
              <button type="button" onClick={() => setToastItems((prev) => prev.filter((item) => item.id !== toast.id))}>
                Close
              </button>
            </div>
          ))}
        </div>
      )}
      {!hideUserNavbar && (
        <nav className="navbar">
          <div className="navbar-left">
            <button className="navbar-button" onClick={handleHomeOpen} disabled={isPlanExpired}>Home</button>
            <button className="navbar-button" onClick={handleContactOpen}>
              Support & Replies{contactReplyCount > 0 ? ` (${contactReplyCount})` : ''}
            </button>
            {isLoggedIn && !isPlanExpired && !showDataButton && (
              <button className="navbar-button" onClick={handleReUploadClick} disabled={isPlanExpired}>
                Upload Data
              </button>
            )}
            {isTestUser && !sampleDataLoaded && !sampleDataLoading && (
              <button className="navbar-button" onClick={loadTestSampleFile}>
                Load Sample Data
              </button>
            )}
            {isTestUser && sampleDataLoading && (
              <button className="navbar-button" disabled>
                Loading Sample...
              </button>
            )}
            {isLoggedIn && !isPlanExpired && showDataButton && (
              <>
                <button onClick={handleShowData} className="navbar-button" disabled={isPlanExpired}>{showParsedData ? 'Hide Data' : 'Show Data'}</button>
                <button onClick={handleReUploadClick} className="navbar-button" disabled={isPlanExpired}>Re-Upload</button>
                {showParsedData && !showBookingReport && (
                  <button onClick={() => setShowBookingReport(true)} className="navbar-button" disabled={isPlanExpired}>Show Report</button>
                )}
              </>
            )}
            {/* {isLoggedIn && uploadMetadata && (
              <div className="upload-meta-badge" title={uploadMetadata.fileName}>
                <strong>{uploadMetadata.totalRows}</strong> rows
                <span>{formatDisplayDateTime(uploadMetadata.uploadedAt)}</span>
              </div>
            )} */}
          </div>
          <div className="navbar-right">
            {isLoggedIn ? (
            <div className="user-menu-container" ref={userMenuRef}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginRight: '10px' }}>
                <span className="navbar-welcome" style={{ marginRight: 0 }}>Welcome, {dealerWelcome}</span>
                <span style={{ fontSize: '10.5px', marginTop: '2px', fontWeight: 'normal', opacity: 0.85, whiteSpace: 'nowrap' }}>
                  Current Package:- {navbarPackageName} {packageValidityText}
                </span>
                {isPlanExpired && (
                  <span className="navbar-expired-msg">Plan Expired, Please contact Admin or Upgrade Plan</span>
                )}
              </div>
                <button
                  type="button"
                  className="user-icon"
                  ref={userMenuButtonRef}
                  onClick={() => setShowUserMenu((prev) => !prev)}
                  aria-label="Open user menu"
                  aria-haspopup="menu"
                  aria-expanded={showUserMenu}
                  aria-controls="user-menu-dropdown"
                >
                  {userAvatarImage ? (
                    <img className="user-icon__photo" src={userAvatarImage} alt="Profile" />
                  ) : (
                    <span className="user-icon__avatar">{userAvatarLabel}</span>
                  )}
                  {userMenuBadgeCount && (
                    <span className="user-icon-badge user-icon-badge--pulse">
                      {userMenuBadgeCount}
                    </span>
                  )}
                </button>
                {showUserMenu && (
                  <UserMenuDropdown
                    dealerWelcome={dealerWelcome}
                    loggedInUser={loggedInUser}
                    userAvatarLabel={userAvatarLabel}
                    userAvatarImage={userAvatarImage}
                    navbarPackageName={navbarPackageName}
                    userMenuStatusText={userMenuStatusText}
                    userMenuSummaryPills={userMenuSummaryPills}
                    profileCompletionPercent={profileCompletionPercent}
                    userRole={userRole}
                    userMenuPackageTips={userMenuPackageTips}
                    userMenuEmptyGuidance={userMenuEmptyGuidance}
                    incompleteProfileAreas={incompleteProfileAreas}
                    incompleteProfileActionItems={incompleteProfileActionItems}
                    runUserMenuItem={runUserMenuItem}
                    getDisabledReason={getDisabledReason}
                    isPlanExpired={isPlanExpired}
                    pendingRequestCount={pendingRequestCount}
                    contactReplyCount={contactReplyCount}
                    updateInboxCount={updateInboxCount}
                    primaryQuickAction={primaryQuickAction}
                    secondaryQuickAction={secondaryQuickAction}
                    userMenuSections={userMenuSections}
                    adminContacts={ADMIN_CONTACTS}
                    handleLogout={handleLogoutWithConfirm}
                    closeUserMenuAndRun={closeUserMenuAndRun}
                    firstUserMenuActionRef={firstUserMenuActionRef}
                    formatDisplayDate={formatDisplayDate}
                  />
                )}
              </div>
            ) : (
              <>
                <button onClick={handleLogin}>Login</button>
                <button onClick={handleRegister}>Register</button>
              </>
            )}
            {!isLoggedIn && (
              <button className="admin-nav-button" onClick={handleAdminLoginOpen}>
                <span aria-hidden="true">&#128274;</span> 
              </button>
            )}
          </div>
        </nav>
      )}
      {isLoggedIn && isPlanExpired && (
        <section className="expired-recovery-panel">
          <div className="expired-recovery-panel__content">
            <div>
              <p className="expired-recovery-panel__eyebrow">Plan Expired</p>
              <h3>Working tools are paused until renewal is approved.</h3>
              <p>
                Upload, invoice, and update tools are currently blocked for this account.
                Choose the next step below to continue faster.
              </p>
            </div>
            <div className="expired-recovery-panel__actions">
              <button type="button" className="expired-recovery-panel__primary" onClick={handleUpgradePlanOpen}>
                Renew Now
              </button>
              <button type="button" className="expired-recovery-panel__secondary" onClick={handleContactOpen}>
                Contact Admin
              </button>
              <button type="button" className="expired-recovery-panel__secondary" onClick={handleOpenRenewalHistory}>
                See Renewal History
              </button>
            </div>
          </div>
        </section>
      )}
      {(showUpgradePlan || showUserProfile || showContactForm || (!isPlanExpired && (showProfileUpdate || showRateUpdate || showBankDetails || showRegisterForm || showDictionaryForm || showHomeInfo || showAboutInfo || showInvoicePage || showLabelUpdate || showHeaderUpdate || showAdminPanel || showAdminLogin || showUserLogin))) && (
        <div className="book-view">
          {showUpgradePlan && <UpgradePlanForm onClose={navigateToHome} />}
          {showDictionaryForm && <DictionaryRequestForm mode={dictionaryFormMode} onClose={navigateToHome} />}
          {showHomeInfo && <HomeInfo />}
          {showAboutInfo && <AboutInfo />}
          {showInvoicePage && (
            <Suspense fallback={<div className="placeholder-container">Loading invoice...</div>}>
              <LazyInvoicePage loggedInUser={loggedInUser} />
            </Suspense>
          )}
          {showLabelUpdate && <LabelUpdatePage />}
          {showHeaderUpdate && <HeaderUpdateForm onClose={navigateToHome} />}
          {showAdminPanel && <AdminPanel onClose={navigateToHome} onAdminLogout={handleAdminLogout} />}
          {showAdminLogin && (
            <div className="placeholder-container admin-login-panel">
              <h2>Admin Login</h2>
              <form
                className="register-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAdminLoginSubmit();
                }}
              >
                <input
                  className="form-input"
                  placeholder="Admin Email"
                  autoComplete="username"
                  value={adminLoginId}
                  onChange={(e) => setAdminLoginId(e.target.value)}
                />
                <input
                  className="form-input"
                  type="password"
                  placeholder="Password"
                  autoComplete="current-password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
              </form>
              <div className="form-actions">
                <button onClick={handleAdminLoginSubmit} type="button" disabled={isAdminLoginSubmitting}>{isAdminLoginSubmitting ? 'Logging in...' : 'Login'}</button>
                <button onClick={navigateToHome} disabled={isAdminLoginSubmitting}>Close</button>
              </div>
            </div>
          )}
          {showUserLogin && (
            <div className="placeholder-container admin-login-panel">
              <h2>User Login</h2>
              <p className="login-helper-text">
                Dealer Code aur 4-digit PIN se login kijiye. Agar PIN yaad nahi hai, to Support & Replies ya admin contact use karke help le sakte hain.
              </p>
              <form
                className="register-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleUserLoginSubmit();
                }}
              >
                <input
                  className="form-input"
                  placeholder="Dealer Code"
                  autoComplete="username"
                  value={userDealerCode}
                  onChange={(e) => setUserDealerCode(e.target.value)}
                />
                <input
                  className="form-input"
                  type={userPinVisible ? 'text' : 'password'}
                  placeholder="PIN"
                  autoComplete="current-password"
                  value={userPin}
                  onChange={(e) => setUserPin(e.target.value)}
                />
                <div className="login-help-row">
                  <label className="login-help-checkbox">
                    <input
                      type="checkbox"
                      checked={userPinVisible}
                      onChange={(e) => setUserPinVisible(e.target.checked)}
                    />
                    <span>Show PIN</span>
                  </label>
                  <button type="button" className="login-help-link" onClick={handleContactOpen}>
                    Forgot PIN / Contact Admin
                  </button>
                </div>
              </form>
              <div className="form-actions">
                <button onClick={handleUserLoginSubmit} type="button" disabled={isUserLoginSubmitting}>{isUserLoginSubmitting ? 'Logging in...' : 'Login'}</button>
                <button onClick={navigateToHome} disabled={isUserLoginSubmitting}>Close</button>
              </div>
            </div>
          )}
          {showProfileUpdate && <ProfileUpdateForm onClose={navigateToHome} />}
          {showRateUpdate && (
            <RateUpdatePage
              onClose={navigateToHome}
              initialRatesData={Array.isArray(loggedInUser?.ratesData) ? loggedInUser.ratesData : null}
              onSaveRates={handleSaveRatesForUser}
            />
          )}
          {showBankDetails && <BankDetailsForm onClose={navigateToHome} />}
          {showRegisterForm && <RegisterForm onClose={navigateToHome} />}
          {showUserProfile && <UserProfile onClose={navigateToHome} initialSection={userProfileInitialSection} />}
          {showContactForm && <ContactForm onClose={navigateToHome} />}
        </div>
      )}
      
      <style>{`
        input[type="checkbox"] {
          -webkit-appearance: checkbox;
          -moz-appearance: checkbox;
          appearance: checkbox;
          width: 16px;
          height: 16px;
          border: 1px solid #ccc;
          background-color: #fff;
          vertical-align: middle;
          position: relative;
        }

        input[type="checkbox"]:checked::before {
          content: '✔';
          display: block;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 12px;
          color: #000; /* Or any color that makes it visible */
        }
      `}</style>


      {!isPlanExpired && parsedData.length > 0 && showParsedData && (
        <div className="filters-shell">

          {showBookingReport && (
            <div className="booking-report-panel">
              <div className="booking-report-header">
                <div>
                  <h3>Pending Booking Report</h3>
                </div>
                <div className="booking-report-actions">
                  <span className="booking-report-badge">Records: {filteredData.length}</span>
                  {activeReportFilter && (
                    <button className="booking-report-clear" onClick={() => setActiveReportFilter('')}>
                      Clear Report Filter
                    </button>
                  )}
                  <button className="booking-report-clear" onClick={() => setShowBookingReport(false)}>
                    Hide Report
                  </button>
                </div>
              </div>

              <div className="booking-report-grid">
                {reportCards.map((card) => (
                  <button
                    key={card.key}
                    type="button"
                    className={`booking-report-card booking-report-card--button ${activeReportFilter === card.key ? 'is-active' : ''}`}
                    onClick={() => setActiveReportFilter((prev) => (prev === card.key || card.key === 'totalPendingBooking' ? '' : card.key))}
                  >
                    <span className="booking-report-label">{card.label}</span>
                    <strong>{card.value}</strong>
                  </button>
                ))}
              </div>

            </div>
          )}





          <div className="filters-overview">
            {uploadInProgress && (
              <div className="inline-status-banner inline-status-banner--info">
                <span className="inline-status-banner__spinner" />
                <span>Uploading and preparing your file...</span>
              </div>
            )}
            {/* {uploadMetadata && (
              <div className="upload-info-card">
                <div>
                  <p className="upload-info-card__eyebrow">Last Uploaded File</p>
                  <h4>{uploadMetadata.fileName}</h4>
                </div>
                <div className="upload-info-card__stats">
                  <span>{uploadMetadata.totalRows} rows</span>
                  <span>{uploadMetadata.validConsumerRows} valid consumers</span>
                  <span>{formatDisplayDateTime(uploadMetadata.uploadedAt)}</span>
                </div>
              </div>
            )} */}
            {activeFilterChips.length > 0 && (
              <div className="filter-chip-row">
                {activeFilterChips.map((chip) => (
                  <button key={chip.key} type="button" className="filter-chip" onClick={chip.clear}>
                    <span>{chip.label}</span>
                    <strong>×</strong>
                  </button>
                ))}
                <button type="button" className="filter-chip filter-chip--clear" onClick={handleResetAllFilters}>
                  Clear All
                </button>
              </div>
            )}
            <div className="preset-toolbar">
              <div className="preset-toolbar__actions">
                <button type="button" className="filter-action filter-action--secondary" onClick={handleSaveCurrentPreset}>
                  Save Current Preset
                </button>
                <button type="button" className="filter-action filter-action--secondary" onClick={() => setShowAdvancedFilters((prev) => !prev)}>
                  {showAdvancedFilters ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
                </button>
              </div>
              {savedFilterPresets.length > 0 && (
                <div className="preset-chip-row">
                  {savedFilterPresets.map((preset) => (
                    <div key={preset.id} className="preset-chip">
                      <button type="button" onClick={() => applyFilterPreset({ ...preset.filters, name: preset.name })}>
                        {preset.name}
                      </button>
                      <button type="button" className="preset-chip__delete" onClick={() => handleDeletePreset(preset.id)}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedCustomerIds.length > 0 && (
              <div className="bulk-action-bar">
                <strong>{selectedCustomerIds.length} selected</strong>
                <span>{selectedFilteredRows.length} visible in current filters</span>
                <div className="bulk-action-bar__actions">
                  <button type="button" className="table-action table-action--blue" onClick={handlePrintCashmemo}>
                    Print Selected
                  </button>
                  <button
                    type="button"
                    className="table-action table-action--green"
                    onClick={() => exportRowsToCsvFile('selected-cashmemo.csv', selectedFilteredRows, visibleHeaders)}
                  >
                    Export Selected
                  </button>
                  <button
                    type="button"
                    className="filter-action filter-action--secondary"
                    onClick={() => {
                      clearSelection();
                      pushToast('Selection cleared.', 'info');
                    }}
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}
            {/* {recentActivities.length > 0 && (
              <div className="recent-activity-panel">
                <div className="recent-activity-panel__header">
                  <h4>Recent Activity</h4>
                  <span>{recentActivities.length} recent actions</span>
                </div>
                <div className="recent-activity-list">
                  {recentActivities.map((item) => (
                    <div key={item.id} className="recent-activity-item">
                      <strong>{item.message}</strong>
                      <span>{formatDisplayDateTime(item.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )} */}
          </div>

          <div className="filters-container filters-container--basic">
            <select className="filter-select" value={activeReportFilter || 'All'} onChange={(e) => setActiveReportFilter(e.target.value === 'All' ? '' : e.target.value)}>
              <option value="All">All Report Filters</option>
              {reportFilterOptions.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
            <select className="filter-select" value={eKycFilter} onChange={(e) => setEKycFilter(e.target.value)}>
              <option value="All">All eKYC</option>
              {availableEkycOptions.map((status, index) => (
                <option key={index} value={status}>{status}</option>
              ))}
            </select>
            <select className="filter-select" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
              <option value="All">All Areas</option>
              {availableAreaOptions.map((area, index) => (
                <option key={index} value={area}>{area}</option>
              ))}
            </select>
            <select className="filter-select" value={onlineRefillPaymentStatusFilter} onChange={(e) => setOnlineRefillPaymentStatusFilter(e.target.value)}>
              <option value="All">All Online Refill Payment Status</option>
              {availableOnlinePaymentOptions.map((status, index) => (
                <option key={index} value={status}>{status}</option>
              ))}
            </select>
            <select className="filter-select" value={orderTypeFilter} onChange={(e) => setOrderTypeFilter(e.target.value)}>
              <option value="All">All Order Type</option>
              {availableOrderTypeOptions.map((type, index) => (
                <option key={index} value={type}>{type}</option>
              ))}
            </select>
            <div className="filter-date-group">
              <span className="filter-date-label">Order Date</span>
              <input className="filter-date-input" type="date" value={orderDateStart} onChange={(e) => setOrderDateStart(e.target.value)} />
              <span className="filter-date-divider">to</span>
              <input className="filter-date-input" type="date" value={orderDateEnd} onChange={(e) => setOrderDateEnd(e.target.value)} />
            </div>
          </div>

          {showAdvancedFilters && (
            <div className="filters-container">
              <select className="filter-select" value={natureFilter} onChange={(e) => setNatureFilter(e.target.value)}>
                <option value="All">All Nature</option>
                {availableNatureOptions.map((nature, index) => (
                  <option key={index} value={nature}>{nature}</option>
                ))}
              </select>
              <select className="filter-select" value={mobileStatusFilter} onChange={(e) => setMobileStatusFilter(e.target.value)}>
                <option value="All">All Mobile Status</option>
                {availableMobileStatusOptions.map((status, index) => (
                  <option key={index} value={status}>{status}</option>
                ))}
              </select>
              <select className="filter-select" value={consumerStatusFilter} onChange={(e) => setConsumerStatusFilter(e.target.value)}>
                <option value="All">All Consumer Status</option>
                {availableConsumerStatusOptions.map((status, index) => (
                  <option key={index} value={status}>{status}</option>
                ))}
              </select>
              <select className="filter-select" value={connectionTypeFilter} onChange={(e) => setConnectionTypeFilter(e.target.value)}>
                <option value="All">All Connection Types</option>
                {availableConnectionTypeOptions.map((type, index) => (
                  <option key={index} value={type}>{type}</option>
                ))}
              </select>
              <select className="filter-select" value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)}>
                <option value="All">All Order Status</option>
                {availableOrderStatusOptions.map((status, index) => (
                  <option key={index} value={status}>{status}</option>
                ))}
              </select>
              <select className="filter-select" value={orderSourceFilter} onChange={(e) => setOrderSourceFilter(e.target.value)}>
                <option value="All">All Order Source</option>
                {availableOrderSourceOptions.map((source, index) => (
                  <option key={index} value={source}>{source}</option>
                ))}
              </select>
              <select className="filter-select" value={cashMemoStatusFilter} onChange={(e) => setCashMemoStatusFilter(e.target.value)}>
                <option value="All">All Cash Memo Status</option>
                {availableCashMemoStatusOptions.map((status, index) => (
                  <option key={index} value={status}>{status}</option>
                ))}
              </select>
              <select className="filter-select" value={deliveryManFilter} onChange={(e) => setDeliveryManFilter(e.target.value)}>
                <option value="All">All Delivery Man</option>
                {availableDeliveryManOptions.map((man, index) => (
                  <option key={index} value={man}>{man}</option>
                ))}
              </select>
              <select className="filter-select" value={isRegMobileFilter} onChange={(e) => setIsRegMobileFilter(e.target.value)}>
                <option value="All">All Is Reg Mobile</option>
                {availableIsRegMobileOptions.map((status, index) => (
                  <option key={index} value={status}>{status}</option>
                ))}
              </select>
              <div className="filter-date-group">
                <span className="filter-date-label">Cash Memo Date</span>
                <input className="filter-date-input" type="date" value={cashMemoDateStart} onChange={(e) => setCashMemoDateStart(e.target.value)} />
                <span className="filter-date-divider">to</span>
                <input className="filter-date-input" type="date" value={cashMemoDateEnd} onChange={(e) => setCashMemoDateEnd(e.target.value)} />
              </div>
              <select className="filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="">Sort By</option>
                {headers.map((header, index) => (
                  <option key={index} value={header}>{header}</option>
                ))}
              </select>
              <select className="filter-select" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                <option value="asc">asc</option>
                <option value="desc">desc</option>
              </select>
              <div className="filters-reset-wrap">
                <button className="filter-action filter-action--secondary" onClick={handleResetAllFilters}>Reset Filters</button>
              </div>
            </div>
          )}

          <div className="table-controls">
            <div className="table-control-group">
              <label className="table-control-label" htmlFor="searchDataInput">Search</label>
              <input id="searchDataInput" className="search-input" type="text" placeholder="Search within data..." value={searchTerm} onChange={handleSearchChange} />
            </div>

            <div className="table-control-group">
              <label className="table-control-label" htmlFor="addColumnSelect">Add Column</label>
              <select className="table-select" id="addColumnSelect" onChange={(e) => addColumn(e.target.value)} value="">
              <option value="" disabled>Select a column</option>
              {availableHeadersToAdd.map(header => <option key={header} value={header}>{header}</option>)}
              </select>
            </div>

            <div className="table-control-group">
              <label className="table-control-label" htmlFor="removeColumnSelect">Remove Column</label>
              <select className="table-select" id="removeColumnSelect" onChange={(e) => removeColumn(e.target.value)} value="">
              <option value="" disabled>Select a column</option>
              {visibleHeaders.map(header => <option key={header} value={header}>{header}</option>)}
              </select>
            </div>

            <div className="table-control-group">
              <label className="table-control-label" htmlFor="pageTypeSelect">Page Type</label>
              <select className="table-select" id="pageTypeSelect" onChange={(e) => setPageType(e.target.value)} value={pageType}>
              <option value="2 Cashmemo/Page">2 Cashmemo/Page</option>
              <option value="3 Cashmemo/Page">3 Cashmemo/Page</option>
              <option value="4 Cashmemo/Page">4 Cashmemo/Page</option>
              </select>
            </div>

            {isHindiEnterprisePackage(loggedInUser?.package) && (
              <div className="table-control-group">
                <label className="table-control-label" htmlFor="printLanguageSelect">Print Language</label>
                <select className="table-select" id="printLanguageSelect" onChange={(e) => setPrintLanguage(e.target.value)} value={printLanguage}>
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                </select>
              </div>
            )}

            <button className="table-action table-action--green action-button" onClick={handlePrintData}>Print Data</button>
            <button className="table-action table-action--blue action-button" onClick={handlePrintCashmemo}>Print Cashmemo</button>
            <button className="filter-action filter-action--secondary action-button" onClick={() => exportRowsToCsvFile('filtered-cashmemo.csv', filteredData, visibleHeaders)}>Export Filtered</button>

            </div>

          <div className="table-container">
            {shouldShowFilteredEmptyState ? (
              <div className="data-empty-state">
                <p className="data-empty-state__eyebrow">No Records Found</p>
                <h3>No bookings match the current filters.</h3>
                <p>
                  {hasActiveDataFilters
                    ? 'Try clearing one or more filters, changing the date range, or searching with a broader term.'
                    : 'No visible rows are available right now. Try re-uploading the latest Pending Booking file.'}
                </p>
                <div className="data-empty-state__actions">
                  {hasActiveDataFilters && (
                    <button type="button" className="filter-action filter-action--secondary" onClick={handleResetAllFilters}>
                      Reset Filters
                    </button>
                  )}
                  <button type="button" className="table-action table-action--blue" onClick={handleReUploadClick}>
                    Re-Upload Data
                  </button>
                </div>
              </div>
            ) : (
              <>
                <table className="data-table">
                <thead>
                  <tr>
                        <th className="data-table__sticky-col" style={{ border: '1px solid black', padding: '8px', textAlign: 'left' }}>
                          <input
                            type="checkbox"
                            onChange={handleSelectAllChange}
                            checked={isAllFilteredRowsSelected}
                          />
                        </th>
                        {visibleHeaders.map((header, index) => (
                      <th key={index} style={{ border: '1px solid black', padding: '8px', textAlign: 'left' }}>
                        {header}
                      </th>
                    ))}
      
                  </tr>
                </thead>
                <tbody>
                      {currentTableData.map((customer, index) => {
                        const isEkycStatusPending = customer['EKYC Status'] === 'Pending' || customer['EKYC Status'] === 'EKYC NOT DONE';
                        return (
                          <tr
                            key={index}
                            style={{
                              border: '1px solid black',
                              color: isEkycStatusPending ? 'red' : 'inherit',
                              fontWeight: isEkycStatusPending ? 'bold' : 'normal',
                            }}
                          >
                            <td className="data-table__sticky-col" style={{ border: '1px solid black', padding: '8px' }}>
                              <input
                                  type="checkbox"
                                  checked={selectedCustomerIds.includes(String(customer['Consumer No.']))}
                                  onChange={() => handleCheckboxChange(customer['Consumer No.'])}
                                />
                            </td>
                        {visibleHeaders.map((header, colIndex) => {
                              return (
                                <td
                                  key={colIndex}
                                  style={{
                                    border: '1px solid black',
                                    padding: '8px',
                                  }}
                                >
                                  {String(
                                      header === 'Online Refill Payment status'
                                        ? (customer[header] === 'PAID' ? 'PAID' : 'COD')
                                        : (header === 'Order Date' || header === 'Cash Memo Date'
                                          ? formatDateToDDMMYYYY(
                                              typeof customer[header] === 'number'
                                                ? excelSerialDateToJSDate(customer[header])
                                                : parseDateString(customer[header])
                                            )
                                          : (customer[header] === undefined || customer[header] === null ? '' : customer[header]))
                                     )}
                                </td>
                              );
                            })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p>Total Records: {filteredData.length}</p>

            <div className="pagination">
              <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>Previous</button>
              <span>Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Next</button>
            </div>
              </>
            )}
          </div>
        </div>
      )}
      {!isPlanExpired && shouldShowEmptyUploadState && (
        <div className="filters-shell">
          <div className="data-empty-state data-empty-state--upload">
            <p className="data-empty-state__eyebrow">No Data Loaded</p>
            <h3>Upload a Pending Booking file to start working.</h3>
            <p>
              Cashmemo print, data filtering, and invoice work begin after you upload the latest
              `Pending Booking` CSV or XLSX file from cDCMS.
            </p>
            <p>
              Current access: {formatPackageNameForNavbar(loggedInUser?.package)}. If upload is not available later,
              renew plan or contact admin from Support & Replies.
            </p>
            <div className="data-empty-state__actions">
              <button type="button" className="table-action table-action--blue" onClick={handleReUploadClick}>
                Upload Data
              </button>
              <button type="button" className="filter-action filter-action--secondary" onClick={handleAboutOpen}>
                View Steps
              </button>
            </div>
          </div>
        </div>
      )}



      {customersToPrint.length > 0 && (
        <div style={{ marginTop: '40px' }}>

          <div ref={cashMemoRef}>
            {customersToPrint.map((item, index) => (
              <div
                key={index}
                style={{
                  pageBreakAfter: (index + 1) % getCashMemoPerPage(pageType) === 0 ? 'always' : 'auto',
                }}
              >
                  <CashMemoEnglish customerData={item.customer} />
              </div>
            ))}
          </div>
        </div>
      )}

      {adminFlashMessage && (
        <div className="admin-flash-message-overlay" onClick={() => setAdminFlashMessage(null)}>
          <div className="admin-flash-message" onClick={(e) => e.stopPropagation()}>
            <div className="admin-flash-message-header">
              <h3>Admin Reply</h3>
              <button type="button" className="admin-flash-message-close" onClick={() => setAdminFlashMessage(null)}>×</button>
            </div>
            <div className="admin-flash-message-body">
              <p>{adminFlashMessage.message}</p>
            </div>
            <div className="admin-flash-message-actions">
              <button onClick={() => setAdminFlashMessage(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
