import { loadAdminSnapshot } from './services/adminDataRepository';
import { buildAdminUserRestoreData } from './utils/adminUserRestore';
import AdminDataStatus from './components/AdminDataStatus';
import LoginDeviceDetails from './components/LoginDeviceDetails';
import { clearLegacyRegistrationStorage } from './utils/registrationStorage';
import { resolveRatesForDate } from './utils/rateUtils';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Suspense, useCallback } from 'react';
import FileUpload from './FileUpload';
import CashMemoEnglish from './CashMemoEnglish';
import CashmemoLayoutPage, { CASHMEMO_LAYOUT_PRINT_STYLES, CashmemoHeaderPreviewSheet, getLayoutPrintStyles } from './CashmemoLayoutPage';
import UserMenuDropdown from './components/UserMenuDropdown';
import { auth, db } from './firebase';
import { addDoc, collection, deleteDoc, doc, getDocs, getDoc, getDocFromCache, getDocsFromCache, setDoc, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
//TEST
import './App.css';
import {
  buildPrintDataHtml,
} from './utils/printSelection';
import { getHindiValue, setHindiRuntimeDictionary } from './hindiPrint';
import {
  buildDictionaryEntriesForSave,
  DICTIONARY_TEMPLATE_ROWS,
  filterChangedDictionaryEntries,
  getDictionaryTranslation,
  getExistingDictionaryEntry,
  buildDictionaryApprovalPayload,
  splitDictionaryImportEntries,
  mergeDictionaryWithEntries,
} from './utils/dictionaryWorkflow';
import {
  formatDrawerFieldLabel,
  formatDrawerFieldValue,
  getDeviceStatusLabel,
  getDrawerDetailSections,
  getDrawerSummaryRows,
  normalizeLoginDevices,
  readDeviceUserName,
  rememberDeviceUserName,
  sanitizeUserForCache,
} from './utils/adminUiHelpers';
import {
  ADMIN_ROLE_PERMISSIONS,
  CASHMEMO_LABEL_OPTIONS,
  CASHMEMO_PAGE_TYPES,
  DEFAULT_EXPORT_HEADERS,
  DEFAULT_HIDDEN_LABELS_BY_PAGE_TYPE,
  HEADER_MAPPING,
  HINDI_ENTERPRISE_PACKAGE_NAMES,
  PACKAGE_OPTIONS,
  PACKAGE_PRICING,
  PAYMENT_UPI_ID,
  SMART_SEARCH_FIELDS,
} from './utils/appConfig';
import { useAdminData } from './hooks/useAdminData';
import { useApprovalQueue } from './hooks/useApprovalQueue';
import { useCashmemoSelection } from './hooks/useCashmemoSelection';
import { useParsedDataFilters } from './hooks/useParsedDataFilters';
import {
  AdminFlashMessage,
  CashmemoPrintPreview,
  ConfirmDialog,
  InputDialog,
  OnboardingTourDialog,
} from './components/app/AppDialogs';
import HeaderUpdateForm from './components/app/HeaderUpdateForm';
import UpgradePlanForm from './components/app/UpgradePlanForm';
import AboutInfo from './components/app/AboutInfo';
import { BrandedLoading, BrandedNotFound } from './components/BrandMark';
import CredentialInput from './components/CredentialInput';
import LabelUpdatePage from './components/app/LabelUpdatePage';
import CashmemoPrintGuide from './components/CashmemoPrintGuide';
import ExpiredPlanGuide from './components/ExpiredPlanGuide';
import {
  excelSerialDateToJSDate,
  formatDateToDDMMYYYY,
  parseDateString,
  getNormalizedRowDate,
  getStartOfDay,
  getElapsedDays,
  formatDisplayDate,
  formatDisplayDateTime,
  getRemainingDays,
} from './utils/dateHelpers';
import {
  isEkycNotDoneStatus,
  normalizeMultiValueFilter,
  getMultiValueFilterValues,
  hasMultiValueFilterSelection,
  matchesMultiValueFilter,
  formatMultiValueFilterLabel,
  isAadhaarNotSeededStatus,
  isOnlinePaidStatus,
  isPendingSvRow,
  isConsumerStatusMatch,
  isOrderSourceCategoryMatch,
  hasMeaningfulCellValue,
  isRegisteredMobileRow,
  hasValidPendingConsumerNo,
  isCashMemoNotGeneratedRow,
  getReportPercentage,
  sortedUniqueValues,
  matchesSmartSearch,
} from './utils/filterHelpers';
import {
  isHindiEnterprisePackage,
  computeValidityDates,
  formatPackageNameForNavbar,
} from './utils/packageHelpers';
import {
  USER_SESSION_STORAGE_KEY,
  APPROVAL_REPLIES_STORAGE_KEY,
  FILTER_PRESET_STORAGE_KEY_PREFIX,
  RECENT_ACTIVITY_STORAGE_KEY_PREFIX,
  USER_LAST_UPLOADED_DATA_LIMIT,
  ONBOARDING_TOUR_STORAGE_KEY_PREFIX,
  WORKSPACE_MODE_STORAGE_KEY_PREFIX,
  ANNOUNCEMENTS_STORAGE_KEY,
  createDefaultAnnouncementDraft,
  getPlanUpgradeReplyStorageKey,
  getOnboardingTourStorageKey,
  getWorkspaceModeStorageKey,
  getAnnouncementScopeLabel,
  sanitizeFilenamePart,
  normalizeDealerCode,
  readImageFileAsDataUrl,
} from './utils/storageHelpers';
import {
  getApiDictionaryPreviewEntry,
  getDictionaryDocId,
  normalizePendingTypeLabel,
} from './utils/dictionaryHelpers';
import {
  getCashMemoPerPage,
  createDefaultCashMemoLabelSettings,
  mergeCashMemoLabelSettings,
  getCashMemoLabelSettingsStorageKey,
} from './utils/cashmemoHelpers';
import {
  HEADER_MAPPING_LOCAL,
  normalizeData,
} from './utils/dataNormalization';
import {
  buildAuditEntry,
  writeLocalAuditTrail,
  writeFirestoreAuditEntry,
} from './services/logging';
import {
  lookupDealerByCode,
  registerLoginDevice,
  markUserExpiredIfDue,
  buildPinWritePatch,
} from './auth/userAuth';
import { updateUserData } from './services/userSubcollections';
import { retryDeniedFirestoreReads } from './services/firestoreRest';
import { fetchAdminUserDetail, getAdminUserStatistics, saveAdminUser, patchAdminUser, deleteAdminUser, completeAdminDictionaryRequest, saveAdminApprovalReply, rejectAdminRegistrationRequest } from './services/adminUserRepository';
import { getUserAccountStatus } from './utils/userAccountStatus';
import { adminSignIn, adminSignOut, validateAdminCredentials } from './auth/adminAuth';
import {
  readUsersCache as readUsersData,
  writeUsersCache as writeUsersData,
  persistUserSession,
  clearUserSession,
} from './services/storage';
import {
  mergeDealerIntoCache,
  mergeDealerLabelSettings,
} from './dealer/dealerRepository';
import {
  getAccessState,
  buildMenuAccessRules,
  canAccessMenuFeature as canAccessMenuFeatureByRules,
  buildPackageAccessBreakdown,
  getAdminTabAccess,
} from './app/permissions';
import {
  LazyInvoicePage,
  LazyHomeDashboard,
  LazyDataWorkspace,
  LazyRateUpdatePage,
  LazyRegisterPanel,
  LazyAdminLoginPanel,
  LazyUserLoginPanel,
  LazyProfileUpdatePanel,
  LazyBankDetailsPanel,
  LazyUserProfilePanel,
  LazyContactSupportPanel,
  LazyDictionaryRequestPanel,
  LazyAttendancePage,
  LazyIdCardPage,
  LazyEmployeeProfilePage,
  LazySalarySlipPage,
  LazyAttendanceReportPage,
  LazyEmployeeReportPage,
  LazyStockRegisterPage,
} from './app/routes';

const PLAN_UPGRADE_OPTIONS = PACKAGE_OPTIONS;

export const AdminPanel = ({
  onAdminLogout,
  announcementDraft,
  announcementDraftFormKey,
  announcementDraftRef,
  announcements,
  confirmAdminActionWithDialog,
  createDictionaryApprovalRecords,
  deleteAnnouncement,
  handleCreateAnnouncement,
  openInputDialog,
  permanentlyDeleteBinItem,
  persistDictionaryRowsToFirebase,
  pushToast,
  readRecentActivitiesForDealer,
  restoreDeletedUser,
  setLoggedInUser,
  setTranslationDictionary,
  toggleAnnouncementStatus,
  translationDictionary,
  translationObservability,
  updateUserInStore,
}) => {
    const [adminUserDetails, setAdminUserDetails] = useState({});
    const loadAdminUserDetail = async (userId) => {
      const detail = await fetchAdminUserDetail(userId);
      if (!detail) throw new Error('User detail no longer exists.');
      setAdminUserDetails((previous) => ({ ...previous, [userId]: detail }));
      return detail;
    };
    const adminSnapshotRef = useRef(null);
    const adminLoadRef = useRef(null);
    const adminHealthRef = useRef({ source: 'unknown' });
    const adminImportRef = useRef(null);
    const dictionaryImportRef = useRef(null);
    const [adminItemsPerPage] = useState(30);
    const [adminRowDensity, setAdminRowDensity] = useState(() => {
      const savedDensity = localStorage.getItem('adminRowDensity');
      return savedDensity === 'compact' ? 'compact' : 'comfortable';
    });
    const {
      requests,
      setRequests,
      users,
      setUsers,
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
      approvalReplies,
      setApprovalReplies,
      savedAdminViews,
      setSavedAdminViews,
      deletedUsersBin,
      setDeletedUsersBin,
      adminDataHealth,
      setAdminDataHealth,
      hiddenApprovalIds,
      setHiddenApprovalIds,
      completeRegistrationRequest,
      reconcileRegistrationRequests,
      confirmAdminAction,
      paginateAdminRows,
    } = useAdminData({ confirmAdminAction: confirmAdminActionWithDialog });
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
      profileData: {
        distributorCode: '',
        distributorName: '',
        contact: '',
        email: '',
        gst: '',
        address: '',
        photoDataUrl: '',
        paymentQrDataUrl: '',
      },
      bankDetailsData: {
        bankName: '',
        branch: '',
        accountNo: '',
        ifsc: '',
      },
    });
    const [editingUserId, setEditingUserId] = useState('');
    const [dictionaryApprovalEdits, setDictionaryApprovalEdits] = useState({});
    const [dictionaryRequestViewState, setDictionaryRequestViewState] = useState(() => {
      try {
        const savedView = JSON.parse(localStorage.getItem('dictionaryRequestView') || '"new"');
        return ['new', 'duplicate', 'api-request'].includes(savedView) ? savedView : 'new';
      } catch {
        return 'new';
      }
    });
    const setDictionaryRequestView = (nextView) => {
      setDictionaryRequestViewState((prevView) => {
        const resolvedView = typeof nextView === 'function' ? nextView(prevView) : nextView;
        const safeView = ['new', 'duplicate', 'api-request'].includes(resolvedView) ? resolvedView : 'new';
        localStorage.setItem('dictionaryRequestView', JSON.stringify(safeView));
        return safeView;
      });
    };
    const dictionaryRequestView = dictionaryRequestViewState;
    const [apiWordsCurrentPage, setApiWordsCurrentPage] = useState(1);
    const [selectedApiWordApprovalIds, setSelectedApiWordApprovalIds] = useState([]);
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
        paymentQrDataUrl: '',
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
    const [auditSyncState, setAuditSyncState] = useState({ source: 'local fallback', lastSyncAt: '', detail: '' });
    const [auditSyncDisabled, setAuditSyncDisabled] = useState(false);
    const [bulkActionState, setBulkActionState] = useState({ active: false, label: '', processed: 0, total: 0, failures: [] });
    const toggleAdminRowDensity = () => {
      setAdminRowDensity((prev) => {
        const next = prev === 'compact' ? 'comfortable' : 'compact';
        localStorage.setItem('adminRowDensity', next);
        return next;
      });
    };
    const activeAdminEmail = String(auth?.currentUser?.email || '').trim().toLowerCase();

    const resetBulkActionState = () => {
      setBulkActionState({ active: false, label: '', processed: 0, total: 0, failures: [] });
    };

    const runBulkAdminAction = async (label, items, runner, { onComplete } = {}) => {
      if (!requireLiveAdminData()) return { ok: false, reason: 'Live Firebase sync required.' };
      const targets = Array.isArray(items) ? items : [];
      if (targets.length === 0) return;
      setBulkActionState({ active: true, label, processed: 0, total: targets.length, failures: [] });
      const failures = [];
      for (let index = 0; index < targets.length; index += 1) {
        const item = targets[index];
        try {
          const result = await runner(item, index);
          if (result?.ok === false) {
            failures.push({
              key: item?.id || item?.dealerCode || `${label}-${index}`,
              target: item?.dealerCode || item?.dealerName || item?.id || `Row ${index + 1}`,
              reason: result?.reason || 'Action was not completed.',
            });
          }
        } catch (error) {
          failures.push({
            key: item?.id || item?.dealerCode || `${label}-${index}`,
            target: item?.dealerCode || item?.dealerName || item?.id || `Row ${index + 1}`,
            reason: error instanceof Error ? error.message : 'Unexpected failure.',
          });
        } finally {
          setBulkActionState((prev) => ({
            ...prev,
            processed: index + 1,
          }));
        }
      }
      setBulkActionState((prev) => ({ ...prev, active: false, failures }));
      if (typeof onComplete === 'function') {
        await onComplete(failures);
      }
    };

    const exportBulkFailureReport = () => {
      if (!bulkActionState.failures.length) {
        pushToast('No bulk failures to export.', 'info');
        return;
      }
      exportRowsAsCsv('admin-bulk-failures.csv', bulkActionState.failures);
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

    const getApprovalReplyRequestSummary = (approval) => {
      if (!approval) return 'Approval request details are not available.';
      const approvalType = normalizeApprovalType(approval.type);
      const payload = approval.payload || {};
      if (approvalType === 'planUpgrade') {
        return `Plan upgrade request from ${approval.dealerCode || 'user'} - ${payload.package || payload.selectedPackage || 'unknown plan'}`;
      }
      if (approvalType === 'dictionary') {
        return `Dictionary request for "${payload.englishWord || payload.eng || '-'}" -> "${payload.hindiTranslation || payload.hin || '-'}"`;
      }
      if (approvalType === 'deliveryArea' || approvalType === 'deliveryStaff') {
        const rowCount = Array.isArray(payload) ? payload.length : 1;
        return `${approvalType === 'deliveryArea' ? 'Delivery area' : 'Delivery staff'} request with ${rowCount} row${rowCount === 1 ? '' : 's'}.`;
      }
      const payloadKeys = payload && typeof payload === 'object' ? Object.keys(payload).slice(0, 4) : [];
      return `${approvalType || 'update'} request from ${approval.dealerCode || 'user'}${payloadKeys.length > 0 ? ` covering ${payloadKeys.join(', ')}` : ''}.`;
    };

    const submitApprovalReply = async () => {
      if (!requireLiveAdminData()) return { ok: false, reason: 'Live Firebase sync required.' };
      if (!activeApprovalReply) return;
      if (!approvalReplyDraft.trim()) {
        pushToast('Please enter a reply before saving.', 'error');
        return;
      }
      const replyMessage = approvalReplyDraft.trim();
      const key = activeApprovalReply.replyKey || getApprovalReplyKey(activeApprovalReply);
      const nextReplies = {
        ...approvalReplies,
        [key]: replyMessage,
      };
      try {
        const approvalDocId = activeApprovalReply.source === 'userDoc'
          ? activeApprovalReply.approvalId
          : activeApprovalReply.id;
        const targetUser = users.find((u) => (
          u.id === activeApprovalReply.userId
          || String(u?.dealerCode || '').trim() === String(activeApprovalReply?.dealerCode || '').trim()
        ));

        const approvalType = normalizeApprovalType(activeApprovalReply.type);
        if (approvalType !== 'dictionary' && !targetUser?.id) throw new Error('User not found for reply.');
        await saveAdminApprovalReply({ approvalDocId, userId: activeApprovalReply.userId || targetUser?.id, type: approvalType,
          pendingType: activeApprovalReply.type, source: activeApprovalReply.source, message: replyMessage,
          approval: activeApprovalReply,
        });
      } catch (error) {
        const reason = error?.message || 'Reply could not be saved to Firestore. Please retry.';
        pushToast(`Reply save failed. ${reason}`, 'error');
        return { ok: false, reason };
      }
      try {
        persistApprovalReplies(nextReplies);
      } catch {
        pushToast('Reply saved in Firestore, but its browser cache could not be updated.', 'warning');
      }
      logAdminActivity('approval_reply_saved', { id: key, dealerCode: activeApprovalReply.dealerCode || '' });
      closeApprovalReplyPopup();
      pushToast('Reply saved in Firestore.', 'success');
      try {
        await loadData();
      } catch {
        pushToast('Reply saved, but the dashboard could not refresh. Please refresh.', 'warning');
      }
      return { ok: true };
    };
    const loadData = () => {
      if (adminLoadRef.current) return adminLoadRef.current;
      const previous = adminSnapshotRef.current ? { ...adminSnapshotRef.current,
        users, approvals: updateApprovals, audit: auditTrail } : null;
      const syncingHealth = { source: 'syncing', lastSyncAt: previous?.lastSyncAt || '', firebaseReachable: false, error: '' };
      adminHealthRef.current = syncingHealth;
      setAdminDataHealth(syncingHealth);
      const operation = (async () => {
        if (!auth.currentUser) {
          const health = { ...syncingHealth, source: 'unavailable', error: 'Admin sign-in required.' };
          adminHealthRef.current = health;
          setAdminDataHealth(health);
          return;
        }
        const { snapshot, health } = await loadAdminSnapshot(previous);
        if (snapshot) {
          const reconciled = { ...snapshot, requests: reconcileRegistrationRequests(snapshot.requests, health.source === 'live') };
          adminSnapshotRef.current = reconciled;
          setRequests(reconciled.requests);
          setUsers(snapshot.users);
          setUpdateApprovals(snapshot.approvals);
          setAuditTrail(snapshot.audit);
        } else {
          setRequests([]);
          setUsers([]);
          setUpdateApprovals([]);
          setAuditTrail([]);
        }
        if (health.source === 'live') {
          setAdminUserDetails({});
          setAuditSyncDisabled(false);
          // Remove obsolete browser-only workflow overrides.
          try { localStorage.removeItem('registrationStatusOverrides'); } catch { /* Optional cache. */ }
        }
        setAuditSyncState({ source: health.source === 'live' ? 'firebase' : health.source,
          lastSyncAt: health.lastSyncAt, detail: health.error });
        adminHealthRef.current = health;
        setAdminDataHealth(health);
      })().finally(() => { adminLoadRef.current = null; });
      adminLoadRef.current = operation;
      return operation;
    };

    const requireLiveAdminData = () => {
      if (adminHealthRef.current.source === 'live') return true;
      pushToast('Admin changes require a successful live Firebase sync. Refresh Data first.', 'error');
      return false;
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
      const entry = buildAuditEntry(action, details, activeAdminEmail || 'admin');
      // Local audit events stay separate from the verified history on screen.
      try { writeLocalAuditTrail([entry, ...auditTrail].slice(0, 150)); } catch { /* Optional cache. */ }
      const reportPendingAudit = () => setAuditSyncState({
        source: 'pending local event', lastSyncAt: adminSnapshotRef.current?.lastSyncAt || '',
        detail: 'Audit event saved locally; verified Firebase history is unchanged.',
      });
      if (auditSyncDisabled || adminHealthRef.current.source !== 'live') {
        reportPendingAudit();
        return;
      }
      void (async () => {
        try {
          await writeFirestoreAuditEntry(action, details, activeAdminEmail || 'admin');
          if (adminHealthRef.current.source === 'live') {
            setAuditTrail((prev) => [entry, ...prev].slice(0, 150));
          }
          setAuditSyncState({ source: 'firebase', lastSyncAt: new Date().toISOString(), detail: 'Firestore audit active' });
        } catch {
          setAuditSyncDisabled(true);
          reportPendingAudit();
        }
      })();
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
    const persistApprovalReplies = (nextReplies) => {
      setApprovalReplies(nextReplies);
      localStorage.setItem(APPROVAL_REPLIES_STORAGE_KEY, JSON.stringify(nextReplies));
    };

    const persistSavedAdminViews = (nextViews) => {
      setSavedAdminViews(nextViews);
      localStorage.setItem('savedAdminViews', JSON.stringify(nextViews));
    };

    const saveCurrentAdminView = () => {
      openInputDialog({
        title: 'Save Admin View',
        message: 'Enter a label for this saved admin view.',
        placeholder: 'e.g. Pending approvals today',
        defaultValue: '',
        confirmLabel: 'Save View',
        onSubmit: (label) => {
          const trimmedLabel = String(label || '').trim();
          if (!trimmedLabel) {
            pushToast('Saved view name is required.', 'error');
            return false;
          }
          const nextViews = [
            {
              id: `view-${Date.now()}`,
              label: trimmedLabel,
              activeAdminTab,
              adminSearchTerm,
              adminDateRange,
              adminSubFilter,
            },
            ...savedAdminViews,
          ].slice(0, 20);
          persistSavedAdminViews(nextViews);
          logAdminActivity('saved_view_created', { label: trimmedLabel });
          pushToast('Admin view saved.', 'success');
          return true;
        },
      });
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
      if (!requireLiveAdminData()) return { ok: false, reason: 'Live Firebase sync required.' };
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
          const seenDealerCodes = new Set();
          const validationFailures = [];
          // Hash every row's PIN up front, so nothing plaintext is ever carried
          // into local storage. A hashing failure aborts preparation.
          let pinPatches;
          try {
            pinPatches = new Map(
            await Promise.all(rows.map(async (row, index) => [
              index,
              await buildPinWritePatch(row.pin || row.PIN || ''),
            ])),
            );
          } catch {
            pushToast('PIN hashing failed. No users were imported. Please try again.', 'error');
            return;
          }

          const importedUsers = rows.reduce((acc, row, index) => {
            const candidate = {
              dealerCode: String(row.dealerCode || row['Dealer Code'] || '').trim(),
              dealerName: String(row.dealerName || row['Dealer Name'] || '').trim(),
              mobile: String(row.mobile || row.Mobile || '').trim(),
              email: String(row.email || row.Email || '').trim(),
              package: String(row.package || row.Package || '').trim(),
              // `pin` is only used for validation below; the hashed patch is
              // merged in at push time so plaintext is never stored.
              pin: String(row.pin || row.PIN || '').trim(),
              role: String(row.role || row.Role || 'operator').trim().toLowerCase() || 'operator',
              status: String(row.status || row.Status || 'active').trim().toLowerCase() || 'active',
              validFrom: toIsoDate(row.validFrom || row['Valid From']) || new Date().toISOString(),
              validTill: toIsoDate(row.validTill || row['Valid Till']) || computeValidityDates(String(row.package || row.Package || '')).validTill,
            };
            const failureReason = !candidate.dealerCode || !candidate.dealerName
              ? 'Dealer code and dealer name required.'
              : !PACKAGE_OPTIONS.includes(candidate.package)
                ? 'Invalid package.'
                : !/^\d{4,6}$/.test(candidate.pin)
                  ? 'PIN must be 4 to 6 digits.'
                  : seenDealerCodes.has(candidate.dealerCode.toLowerCase())
                    ? 'Duplicate dealer code.'
                    : '';
            if (failureReason) {
              validationFailures.push({
                row: index + 2,
                dealerCode: candidate.dealerCode || '-',
                reason: failureReason,
              });
              return acc;
            }
            seenDealerCodes.add(candidate.dealerCode.toLowerCase());
            // Drop the plaintext PIN and store only the hashed patch.
            const { pin: _plainPin, ...rest } = candidate;
            acc.push({ ...rest, ...pinPatches.get(index) });
            return acc;
          }, []);
          const acceptedUsers = [];
          for (const candidate of importedUsers) {
            try {
              const saved = await saveAdminUser(candidate);
              acceptedUsers.push({ ...candidate, id: saved.id });
            } catch (error) {
              validationFailures.push({ dealerCode: candidate.dealerCode, reason: error?.message || 'Import failed.' });
            }
          }
          await loadData();
          logAdminActivity('bulk_users_imported', { count: acceptedUsers.length });
          if (validationFailures.length > 0) {
            setBulkActionState({
              active: false,
              label: 'Import validation',
              processed: acceptedUsers.length,
              total: rows.length,
              failures: validationFailures,
            });
            pushToast(`${acceptedUsers.length} users imported. ${validationFailures.length} rows skipped.`, acceptedUsers.length > 0 ? 'info' : 'error');
          } else {
            resetBulkActionState();
            pushToast(`${acceptedUsers.length} users imported.`, 'success');
          }
        };
        reader.readAsArrayBuffer(file);
      } catch (error) {
        void error;
        pushToast('Import failed.', 'error');
      } finally {
        event.target.value = null;
      }
    };

    const persistDeletedUsersBin = (nextBin) => {
      setDeletedUsersBin(nextBin);
      localStorage.setItem('deletedUsersBin', JSON.stringify(nextBin));
    };

    // Admin panel is intentionally a single-admin workspace: the only role is
    // `admin`, and it is only resolved from a real Firebase-authenticated admin
    // session (`auth.currentUser`). Without that session the engine falls back
    // to view-only, so a stale `showAdminPanel` flag cannot grant write access.
    const adminRole = auth?.currentUser ? 'admin' : undefined;
    const { canAccessTab, canMutateAdminData: roleCanMutate } = getAdminTabAccess(adminRole);
    const canMutateAdminData = roleCanMutate && adminDataHealth.source === 'live';

    const completeRegistrationInView = (id, status) => {
      completeRegistrationRequest(id, status);
      if (adminSnapshotRef.current) {
        adminSnapshotRef.current = { ...adminSnapshotRef.current,
          requests: reconcileRegistrationRequests(adminSnapshotRef.current.requests) };
      }
      setSelectedRequestIds((prev) => prev.filter((requestId) => requestId !== id));
      setViewRequest((current) => current?.id === id ? null : current);
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
      if (!canAccessTab(activeAdminTab)) {
        setActiveAdminTab('dashboard');
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeAdminTab]);

    useEffect(() => {
      setAdminSubFilter('all');
      setAdminSearchTerm('');
      clearAllSelections();
      setAdminCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeAdminTab]);

    const approveRequest = async (id, options = {}) => {
      if (!requireLiveAdminData()) return { ok: false, reason: 'Live Firebase sync required.' };
      const req = requests.find((r) => r.id === id);
      if (!req) return { ok: false, reason: 'Registration request not found.' };
      if (!options.skipConfirm && !(await confirmAdminAction(`Approve registration request for ${req.dealerCode || 'this dealer'}?`))) return { ok: false, reason: 'Action cancelled.' };
      try {
        const validity = computeValidityDates(req.package || '');
        const normalizedDealerCode = normalizeDealerCode(req?.dealerCode);
        await saveAdminUser({
          dealerCode: normalizedDealerCode,
          dealerName: req.dealerName || '',
          mobile: req.mobile || '',
          email: req.email || '',
          package: req.package || '',
          packageDays: validity.packageDays,
          validFrom: validity.validFrom,
          validTill: validity.validTill,
          ...(await buildPinWritePatch(req.pin)),
          status: 'active',
        }, { mode: 'approve', requestId: id });
      } catch (error) {
        const reason = error?.message || 'Approve failed. Check server configuration.';
        pushToast(reason, 'error');
        return { ok: false, reason };
      }
      // Approval and its audit are already committed. Cache/refresh failures
      // must not turn a confirmed approval into a reported write failure.
      completeRegistrationInView(id, 'approved');
      pushToast('Registration approved.', 'success');
      try {
        await loadData();
      } catch {
        pushToast('Registration approved in Firestore, but the dashboard could not refresh. Please refresh.', 'warning');
      }
      return { ok: true };
    };

    const rejectRequest = async (id, options = {}) => {
      if (!requireLiveAdminData()) return { ok: false, reason: 'Live Firebase sync required.' };
      const req = requests.find((r) => r.id === id);
      if (!req) return { ok: false, reason: 'Registration request not found.' };
      if (!options.skipConfirm && !(await confirmAdminAction(`Reject registration request for ${req?.dealerCode || 'this dealer'}?`))) return { ok: false, reason: 'Action cancelled.' };
      try {
        await rejectAdminRegistrationRequest(id);
      } catch (error) {
        const reason = error?.message || 'Reject failed. Check server configuration.';
        pushToast(reason, 'error');
        return { ok: false, reason };
      }
      completeRegistrationInView(id, 'rejected');
      pushToast('Registration rejected.', 'success');
      try {
        await loadData();
      } catch {
        pushToast('Registration rejected in Firestore, but the dashboard could not refresh. Please refresh.', 'warning');
      }
      return { ok: true };
    };

    const addManualUser = async () => {
      if (!requireLiveAdminData()) return { ok: false, reason: 'Live Firebase sync required.' };
      if (!newUser.dealerCode || !newUser.dealerName || !newUser.pin || !newUser.package) {
        pushToast('Dealer code, dealer name, package and PIN required.', 'error');
        return;
      }
      const normalizedDealerCode = normalizeDealerCode(newUser.dealerCode);
      if (!(await confirmAdminAction(`Create manual user ${normalizedDealerCode}?`))) return;
      if (!requireLiveAdminData()) return;
      try {
        const validity = computeValidityDates(newUser.package);
        await saveAdminUser({
          dealerCode: normalizedDealerCode,
          dealerName: newUser.dealerName.trim(),
          mobile: newUser.mobile.trim(),
          email: newUser.email.trim(),
          package: newUser.package,
          packageDays: validity.packageDays,
          validFrom: validity.validFrom,
          validTill: validity.validTill,
          ...(await buildPinWritePatch(newUser.pin)),
          role: newUser.role,
          status: 'active',
          approvalStatus: {},
          profileData: { ...newUser.profileData },
          bankDetailsData: { ...newUser.bankDetailsData },
          createdAt: serverTimestamp(),
          approvedAt: serverTimestamp(),
        });
        setNewUser({
          dealerCode: '', dealerName: '', mobile: '', email: '', package: '', pin: '', role: 'operator',
          profileData: { distributorCode: '', distributorName: '', contact: '', email: '', gst: '', address: '', photoDataUrl: '', paymentQrDataUrl: '' },
          bankDetailsData: { bankName: '', branch: '', accountNo: '', ifsc: '' },
        });
        await loadData();
        logAdminActivity('manual_user_created', { dealerCode: normalizedDealerCode });
      } catch (error) {
        pushToast(error?.message || 'Create user failed.', 'error');
      }
    };

    const handleAdminUserImageChange = async (event, target = 'new', field = 'photoDataUrl') => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        pushToast('Please choose an image file.', 'error');
        return;
      }
      if (file.size > 1024 * 1024) {
        pushToast('Image must be under 1 MB.', 'error');
        return;
      }
      try {
        const dataUrl = await readImageFileAsDataUrl(file);
        if (target === 'edit') {
          setEditUser((prev) => ({
            ...prev,
            profileData: { ...prev.profileData, [field]: dataUrl },
          }));
        } else {
          setNewUser((prev) => ({
            ...prev,
            profileData: { ...prev.profileData, [field]: dataUrl },
          }));
        }
      } catch {
        pushToast('Image upload failed. Please try another image.', 'error');
      }
    };

    const toggleUserStatus = async (userOrId, options = {}) => {
      if (!requireLiveAdminData()) return { ok: false, reason: 'Live Firebase sync required.' };
      const target = typeof userOrId === 'object'
        ? userOrId
        : users.find((u) => u.id === userOrId);
      if (!target) return { ok: false, reason: 'User not found.' };
      const nextStatus = getUserAccountStatus(target) === 'active' ? 'disabled' : 'active';
      if (!options.skipConfirm && !(await confirmAdminAction(`${nextStatus === 'disabled' ? 'Disable' : 'Enable'} ${target.dealerCode || 'this user'}?`))) return { ok: false, reason: 'Action cancelled.' };
      try {
        if (target.id) {
          await patchAdminUser(target.id, {
            status: nextStatus,
            updatedAt: serverTimestamp(),
          });
          await loadData();
          logAdminActivity('user_status_changed', { dealerCode: target.dealerCode || '', status: nextStatus });
          return { ok: true };
        }
        throw new Error('LOCAL_ONLY_USER');
      } catch (error) {
        const reason = error?.message || 'Status update failed.';
        pushToast(reason, 'error');
        return { ok: false, reason };
      }
    };

    const deleteUser = async (userOrId) => {
      if (!requireLiveAdminData()) return { ok: false, reason: 'Live Firebase sync required.' };
      const target = typeof userOrId === 'object'
        ? userOrId
        : users.find((u) => u.id === userOrId);
      if (!target) return;
      openInputDialog({
        title: 'Delete User',
        message: `Enter a delete reason for ${target.dealerCode || 'this user'}.`,
        submitLabel: 'Delete User',
        onSubmit: async (deleteReason) => {
          if (!requireLiveAdminData()) return false;
          try {
            const fullUser = await loadAdminUserDetail(target.id);
            const nextDeletedUsersBin = [{
              ...fullUser,
              deletedAt: new Date().toISOString(),
              deletedBy: activeAdminEmail || 'admin',
              deleteReason,
              restoreCount: Number(target?.restoreCount || 0),
            }, ...deletedUsersBin].slice(0, 200);
            if (target.id) {
              await deleteAdminUser(target.id);
              persistDeletedUsersBin(nextDeletedUsersBin);
              await loadData();
              logAdminActivity('user_deleted', { dealerCode: target.dealerCode || '', deleteReason });
              return true;
            }
            throw new Error('LOCAL_ONLY_USER');
          } catch (error) {
            pushToast(error?.message || 'User delete failed.', 'error');
            return false;
          }
        },
      });
    };

    const startEditUser = async (u) => {
      // List pages skip heavy payloads; fetch the full doc before editing so
      // profile/bank fields don't get blanked out on save.
      let source;
      try { source = await loadAdminUserDetail(u.id); } catch (error) {
        pushToast(error?.message || 'User detail could not be read.', 'error');
        return;
      }
      setEditingUserId(resolveEditToken(source));
      setEditUser({
        dealerCode: source.dealerCode || '',
        dealerName: source.dealerName || '',
        mobile: source.mobile || '',
        email: source.email || '',
        package: source.package || '',
        validFrom: toDateInputValue(source.validFrom),
        validTill: toDateInputValue(source.validTill),
        // The stored PIN is a one-way hash, so it cannot be prefilled. Leaving
        // this blank keeps the existing PIN untouched on save.
        pin: '',
        role: source.role || 'operator',
        status: getUserAccountStatus(source),
        profileData: {
          ...(source.profileData || {}),
          distributorCode: source.profileData?.distributorCode || '',
          distributorName: source.profileData?.distributorName || '',
          contact: source.profileData?.contact || '',
          email: source.profileData?.email || '',
          gst: source.profileData?.gst || '',
          address: source.profileData?.address || '',
          photoDataUrl: source.profileData?.photoDataUrl || '',
          paymentQrDataUrl: source.profileData?.paymentQrDataUrl || '',
        },
        bankDetailsData: {
          ...(source.bankDetailsData || {}),
          bankName: source.bankDetailsData?.bankName || '',
          branch: source.bankDetailsData?.branch || '',
          accountNo: source.bankDetailsData?.accountNo || '',
          ifsc: source.bankDetailsData?.ifsc || '',
        },
      });
    };

    const saveEditedUser = async () => {
      if (!requireLiveAdminData()) return { ok: false, reason: 'Live Firebase sync required.' };
      if (!editingUserId) return;
      const targetUser = users.find((u) => isSameUserByToken(u, editingUserId));
      if (!targetUser) {
        pushToast('User not found.', 'error');
        return;
      }
      if (!(await confirmAdminAction(`Save changes for ${targetUser.dealerCode || 'this user'}?`))) return;
      if (!requireLiveAdminData()) return;
      try {
        const fallbackValidity = computeValidityDates(editUser.package);
        const validFromIso = toIsoDate(editUser.validFrom) || fallbackValidity.validFrom;
        const validTillIso = toIsoDate(editUser.validTill) || fallbackValidity.validTill;
        const diffDays = Math.max(0, Math.ceil((new Date(validTillIso).getTime() - new Date(validFromIso).getTime()) / (1000 * 60 * 60 * 24)));
        if (!targetUser.id) {
          throw new Error('LOCAL_ONLY_USER');
        }
        const savedUser = await saveAdminUser({
          dealerCode: editUser.dealerCode.trim(),
          dealerName: editUser.dealerName.trim(),
          mobile: editUser.mobile.trim(),
          email: editUser.email.trim(),
          package: editUser.package,
          packageDays: Number.isFinite(diffDays) ? diffDays : fallbackValidity.packageDays,
          validFrom: validFromIso,
          validTill: validTillIso,
          ...(await buildPinWritePatch(editUser.pin)),
          role: editUser.role,
          status: editUser.status,
          profileData: { ...editUser.profileData },
          bankDetailsData: { ...editUser.bankDetailsData },
          updatedAt: serverTimestamp(),
        }, { mode: 'update', userId: targetUser.id });
        setLoggedInUser((currentUser) => {
          if (!currentUser || (currentUser.id !== targetUser.id && String(currentUser.dealerCode || '').trim() !== String(targetUser.dealerCode || '').trim())) return currentUser;
        const safeCurrentUser = sanitizeUserForCache({
          ...currentUser,
          dealerCode: savedUser.dealerCode,
          dealerName: editUser.dealerName.trim(),
          mobile: editUser.mobile.trim(),
          email: editUser.email.trim(),
          package: editUser.package,
          validFrom: validFromIso,
          validTill: validTillIso,
          // PIN is never mirrored into local/runtime state.
          role: editUser.role,
          status: editUser.status,
          profileData: { ...editUser.profileData },
          bankDetailsData: { ...editUser.bankDetailsData },
        });
        return safeCurrentUser;
        });
        setEditingUserId('');
        setEditUser((prev) => ({ ...prev, pin: '' }));
        await loadData();
        logAdminActivity('user_updated', { dealerCode: targetUser.dealerCode || '' });
      } catch (error) {
        pushToast(error?.message || 'User update failed.', 'error');
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
    const collectionDictionaryPendingApprovals = pendingApprovalRequests.filter((approval) => (
      normalizeApprovalType(approval.type) === 'dictionary'
    ));
    const collectionPendingApprovals = pendingApprovalRequests.filter((approval) => {
      const approvalType = normalizeApprovalType(approval.type);
      if (approvalType === 'dictionary') {
        return false;
      }
      return true;
    });
    const getApprovalKey = (approval) => {
      if (!approval) return '';
      const approvalType = normalizeApprovalType(approval.type);
      if (approvalType === 'dictionary') {
        return `${approvalType}-${approval.approvalId || approval.clientRequestId || approval?.payload?.clientRequestId || approval.id || approval.userId || approval.dealerCode || ''}`;
      }
      const userKey = approval.userId || approval.dealerCode || approval.dealerName || '';
      if (userKey) {
        return `${approvalType}-${userKey}`;
      }
      return `${approvalType}-${approval.id || approval?.payload?.clientRequestId || ''}`;
    };

    const combinedApprovalMap = new Map();
    [...collectionPendingApprovals, ...collectionDictionaryPendingApprovals].forEach((approval) => {
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

    const isApiDictionaryApproval = (approval) => {
      const payload = getDictionaryApprovalPayload(approval);
      const requestSource = String(payload?.requestSource || approval?.requestSource || '').toLowerCase();
      const queueLabel = String(payload?.queueLabel || approval?.queueLabel || '').toLowerCase();
      const source = String(approval?.source || '').toLowerCase();
      const importMode = String(payload?.importMode || approval?.importMode || '').toLowerCase();
      const requestedFrom = String(payload?.requestedFrom || approval?.requestedFrom || '').toLowerCase();

      return requestSource === 'api'
        || queueLabel === 'api request dictionary'
        || source === 'api-print'
        || importMode === 'api-request'
        || requestedFrom === 'hindi cashmemo print';
    };

    const apiRequestDictionaryApprovals = dictionaryPendingApprovals.filter((approval) => isApiDictionaryApproval(approval));
    const manualDictionaryApprovals = dictionaryPendingApprovals.filter((approval) => !isApiDictionaryApproval(approval));
    const apiWordDisplayRows = apiRequestDictionaryApprovals.map((approval) => ({
      ...getApiDictionaryPreviewEntry(approval),
      approval,
    }));
    const apiWordTotalPages = Math.max(1, Math.ceil(apiWordDisplayRows.length / adminItemsPerPage));
    const pagedApiWordDisplayRows = paginateAdminRows(apiWordDisplayRows, adminItemsPerPage, apiWordsCurrentPage);
    const toggleApiWordSelection = (approvalId) => {
      if (!approvalId) return;
      setSelectedApiWordApprovalIds((prev) => (
        prev.includes(approvalId)
          ? prev.filter((item) => item !== approvalId)
          : [...prev, approvalId]
      ));
    };
    const clearSelectedApiWordApprovalIds = () => setSelectedApiWordApprovalIds([]);
    const selectedApiWordApprovals = apiWordDisplayRows
      .filter((entry) => entry.approval && selectedApiWordApprovalIds.includes(entry.approval.id))
      .map((entry) => entry.approval);
    const duplicateDictionaryApprovals = manualDictionaryApprovals.filter((approval) => {
      const payload = getDictionaryApprovalPayload(approval);
      return Boolean(getExistingDictionaryEntry(translationDictionary, payload?.englishWord || payload?.eng));
    });
    const newDictionaryApprovals = manualDictionaryApprovals.filter((approval) => {
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

    const dictionaryChangesRef = useRef({});
    const completedDictionaryIdsRef = useRef([]);
    const clearCompletedDictionaryRows = () => {
      const ids = completedDictionaryIdsRef.current;
      completedDictionaryIdsRef.current = [];
      setHiddenApprovalIds((prev) => [...new Set([...prev, ...ids])]);
      setSelectedApiWordApprovalIds((prev) => prev.filter((id) => !ids.includes(id)));
      setDictionaryApprovalEdits((prev) => Object.fromEntries(
        Object.entries(prev).filter(([id]) => !ids.includes(id)),
      ));
    };
    const completeDictionaryRequest = async (approval, status) => {
      const approvalDocId = approval.source === 'userDoc' ? approval.approvalId : approval.id;
      const targetUser = users.find((user) => user.id === approval.userId
        || (approval.dealerCode && user.dealerCode === approval.dealerCode));
      await completeAdminDictionaryRequest(approval.userId || targetUser?.id, approvalDocId,
        approval, status,
        approval.pendingType || (approval.id === `userdoc-${targetUser?.id}-${approval.type}` ? approval.type : null));
    };

    const flushDictionaryChanges = () => {
      const changes = dictionaryChangesRef.current;
      dictionaryChangesRef.current = {};
      if (Object.keys(changes).length > 0) {
        setTranslationDictionary((current) => ({ ...current, ...changes }));
      }
    };

    const approveUpdateRequest = async (approval, options = {}) => {
      if (!requireLiveAdminData()) return { ok: false, reason: 'Live Firebase sync required.' };
      if (!approval?.id) return { ok: false, reason: 'Approval request missing.' };
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
        pushToast(`Unsupported approval type: ${approval.type || 'unknown'}`, 'error');
        return { ok: false, reason: `Unsupported approval type: ${approval.type || 'unknown'}` };
      }
      if (!options.skipConfirm && !(await confirmAdminAction(`Approve ${approval.type || 'update'} request for ${approval.dealerCode || 'this dealer'}?`))) return { ok: false, reason: 'Action cancelled.' };
      try {
        const targetSummary = users.find((u) => u.id === approval.userId || String(u?.dealerCode || '').trim() === String(approval?.dealerCode || '').trim());
        const targetUser = targetSummary?.id ? await loadAdminUserDetail(targetSummary.id) : null;
        if (approvalType !== 'dictionary' && !targetUser?.id) {
          pushToast('User not found for approval.', 'error');
          return { ok: false, reason: 'User not found for approval.' };
        }
        const nextStatus = { ...(targetUser?.approvalStatus || {}), [approvalType]: 'approved' };
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
        const approvedTargetValue = approvalType === 'rates' && Array.isArray(approval.payload)
          ? approval.payload.map((row) => ({ ...row, RateStatus: 'Approved', RateApprovedAt: new Date().toISOString() }))
          : (approvalType === 'profile' || approvalType === 'bank')
            ? { ...(targetUser?.[targetField] || {}), ...(approval.payload || {}) }
            : approval.payload;
        if (approvalType === 'dictionary') {
          const dictionaryPayload = getDictionaryApprovalPayload(approval);
          const englishWord = String(dictionaryPayload?.englishWord || dictionaryPayload?.eng || '').trim();
          const hindiTranslation = String(dictionaryPayload?.hindiTranslation || dictionaryPayload?.hin || '').trim();
          if (!englishWord || !hindiTranslation) {
            if (!options.skipAlert) pushToast('Dictionary request needs both English word and Hindi translation.', 'error');
            return { ok: false, reason: 'Dictionary request needs both English word and Hindi translation.' };
          }
          await setDoc(doc(db, 'settings', 'translationDictionary'), { [englishWord]: hindiTranslation }, { merge: true });
          await setDoc(doc(db, 'translationDictionary', getDictionaryDocId(englishWord)), {
            englishWord,
            hindiTranslation,
            dealerCode: approval.dealerCode || targetUser?.dealerCode || '',
            dealerName: approval.dealerName || targetUser?.dealerName || '',
            approvalId: approval.id || '',
            status: 'approved',
            requestSource: dictionaryPayload?.requestSource || 'manual',
            requestedFrom: dictionaryPayload?.requestedFrom || '',
            phraseKind: dictionaryPayload?.phraseKind || 'token',
            matchedExistingEntry: dictionaryPayload?.matchedExistingEntry || '',
            approvedBy: activeAdminEmail || 'admin',
            approvedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await completeDictionaryRequest(approval, 'approved');
          dictionaryChangesRef.current[englishWord] = hindiTranslation;
        } else if (approvalType === 'planUpgrade') {
          const nextPackage = approval.payload?.package || approval.payload?.selectedPackage || '';
          if (!nextPackage) {
            pushToast('Plan upgrade request has no selected package.', 'error');
            return { ok: false, reason: 'Plan upgrade request has no selected package.' };
          }
          const validity = computeValidityDates(nextPackage);
          await patchAdminUser(targetUser.id, {
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

          await patchAdminUser(targetUser.id, {
            [targetField]: nextUpdates,
            approvalStatus: nextStatus,
            [`pendingUpdates.${approvalType}.status`]: 'approved',
            [`pendingUpdates.${approvalType}.approvedAt`]: new Date().toISOString(),
            updatedAt: serverTimestamp(),
          });
          await persistDictionaryRowsToFirebase(nextUpdates, {
            source: approvalType,
            status: 'approved',
            notifyEmpty: false,
            notifySuccess: false,
          });
        } else {
          await patchAdminUser(targetUser.id, {
            [targetField]: approvedTargetValue,
            approvalStatus: nextStatus,
            [`pendingUpdates.${approvalType}.status`]: 'approved',
            [`pendingUpdates.${approvalType}.approvedAt`]: new Date().toISOString(),
            updatedAt: serverTimestamp(),
          });
        }
        if (targetUser?.id && targetField) {
          const approvedAt = new Date().toISOString();
          updateUserInStore(targetUser.id, (currentUser) => ({
            ...currentUser,
            [targetField]: approvedTargetValue,
            approvalStatus: nextStatus,
            pendingUpdates: {
              ...(currentUser.pendingUpdates || {}),
              [approvalType]: {
                ...(currentUser.pendingUpdates?.[approvalType] || {}),
                status: 'approved',
                approvedAt,
              },
            },
          }), targetUser.dealerCode);
          setLoggedInUser((currentUser) => {
            if (!currentUser || (currentUser.id !== targetUser.id && String(currentUser.dealerCode || '').trim() !== String(targetUser.dealerCode || '').trim())) return currentUser;
            return {
              ...currentUser,
              [targetField]: approvedTargetValue,
              approvalStatus: nextStatus,
              pendingUpdates: {
                ...(currentUser.pendingUpdates || {}),
                [approvalType]: {
                  ...(currentUser.pendingUpdates?.[approvalType] || {}),
                  status: 'approved',
                  approvedAt,
                },
              },
            };
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
        completedDictionaryIdsRef.current.push(approval.id);
        if (!options.skipRefresh) {
          clearCompletedDictionaryRows();
          await loadData();
          flushDictionaryChanges();
        }
        logAdminActivity('update_approved', { id: approval.id, dealerCode: approval.dealerCode || '', type: approval.type || '' });
        if (!options.skipAlert) {
          pushToast('Request approved successfully.', 'success');
        }
        return { ok: true };
      } catch {
        if (!options.skipAlert) pushToast('Approval failed.', 'error');
        return { ok: false, reason: 'Approval failed.' };
      }
    };

    const rejectUpdateRequest = async (approval, options = {}) => {
      if (!requireLiveAdminData()) return { ok: false, reason: 'Live Firebase sync required.' };
      if (!approval?.id) return { ok: false, reason: 'Approval request missing.' };
      const approvalType = normalizeApprovalType(approval.type);
      if (!options.skipConfirm && !(await confirmAdminAction(`Reject ${approval.type || 'update'} request for ${approval.dealerCode || 'this dealer'}?`))) return { ok: false, reason: 'Action cancelled.' };
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
          if (approvalType !== 'dictionary') {
            await patchAdminUser(targetUser.id, {
              approvalStatus: nextStatus,
              [`pendingUpdates.${approvalType}.status`]: 'rejected',
              [`pendingUpdates.${approvalType}.rejectedAt`]: new Date().toISOString(),
              updatedAt: serverTimestamp(),
            });
          }
        }
        if (approvalType === 'dictionary') await completeDictionaryRequest(approval, 'rejected');
        const approvalDocId = approval.source === 'userDoc' ? approval.approvalId : approval.id;
        if (approvalDocId && approvalType !== 'dictionary') {
          try {
            await deleteDoc(doc(db, 'updateApprovals', approvalDocId));
          } catch (error) {
            void error;
          }
        }
        completedDictionaryIdsRef.current.push(approval.id);
        if (!options.skipRefresh) {
          clearCompletedDictionaryRows();
          await loadData();
          flushDictionaryChanges();
        }
        logAdminActivity('update_rejected', { id: approval.id, dealerCode: approval.dealerCode || '', type: approval.type || '' });
        return { ok: true };
      } catch {
        if (!options.skipAlert) pushToast('Reject failed.', 'error');
        return { ok: false, reason: 'Reject failed.' };
      }
    };

    const openDetailView = async (user, type) => {
      // Admin list rows intentionally contain only lightweight fields. Fetch
      // the complete record on demand before opening a profile/bank/rate view.
      // Without this, the controls below were hidden because those fields are
      // not part of the paginated list payload.
      let fullUser = user;
      if (user?.id) {
        try {
          const fetched = await loadAdminUserDetail(user.id);
          if (fetched) fullUser = fetched;
        } catch {
          pushToast('Full user details Firebase se load nahi ho paayi; available data dikhaya gaya hai.', 'error');
        }
      }
      if (type === 'profile') {
        setDetailView({ title: `Profile - ${fullUser?.dealerCode || ''}`, data: fullUser?.profileData || {}, noteKey: `user:${fullUser?.id || fullUser?.dealerCode}:profile` });
        return;
      }
      if (type === 'bank') {
        setDetailView({ title: `Bank - ${fullUser?.dealerCode || ''}`, data: fullUser?.bankDetailsData || {}, noteKey: `user:${fullUser?.id || fullUser?.dealerCode}:bank` });
        return;
      }
      if (type === 'header') {
        setDetailView({ title: `Header - ${fullUser?.dealerCode || ''}`, data: fullUser?.hindiHeaderData || {}, noteKey: `user:${fullUser?.id || fullUser?.dealerCode}:header` });
        return;
      }
      setDetailView({ title: `Rates - ${fullUser?.dealerCode || ''}`, data: fullUser?.ratesData || [], noteKey: `user:${fullUser?.id || fullUser?.dealerCode}:rates` });
    };

    // Registration workflow state is independent of account state. Legacy
    // partial approvals must remain visible for review rather than disappear.
    const pendingRegistrationRequests = requests.filter((request) =>
      String(request.status || 'pending').trim().toLowerCase() === 'pending');
    const pendingCount = pendingRegistrationRequests.length;
    const userStatistics = getAdminUserStatistics(users);
    const activeUsers = userStatistics.byStatus.active || 0;
    const activeUsersList = users.filter((u) => getUserAccountStatus(u) === 'active');
    const approvalTypeCounts = combinedPendingApprovals.reduce((acc, item) => {
      const key = normalizeApprovalType(item?.type);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const expiringUsers = users
      .filter((u) => getUserAccountStatus(u) === 'active')
      .map((u) => ({ ...u, remainingDays: getRemainingDays(u.validTill) }))
      .filter((u) => u.remainingDays !== null && u.remainingDays >= 0 && u.remainingDays <= 7)
      .sort((a, b) => a.remainingDays - b.remainingDays);
    const activeAnnouncementCount = announcements.filter((item) => item?.active).length;
    const searchLower = adminSearchTerm.trim().toLowerCase();
    const rangeDaysMap = { today: 0, '7d': 7, '30d': 30 };
    const matchesAdminSearch = (values) => {
      if (!searchLower) return true;
      return values.some((value) => String(value || '').toLowerCase().includes(searchLower));
    };
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
    const getDealerHealthSummary = (user = {}) => {
      const activities = readRecentActivitiesForDealer(user?.dealerCode);
      const uploadCount = activities.filter((item) => /uploaded/i.test(item?.message || '')).length;
      const printCount = activities.filter((item) => /(print|cashmemo)/i.test(item?.message || '')).length;
      const completionChecks = [
        Boolean(user?.profileData?.distributorName),
        Boolean(user?.bankDetailsData?.bankName),
        ...(Number.isFinite(user?.ratesDataCount) ? [user.ratesDataCount > 0] : []),
        Boolean(user?.hindiHeaderData?.distributorName),
      ];
      const completionPercent = Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100);
      const remainingDays = getRemainingDays(user?.validTill);
      const risk = remainingDays !== null && remainingDays <= 3
        ? 'high'
        : remainingDays !== null && remainingDays <= 7
          ? 'medium'
          : 'stable';
      const score = Math.max(0, Math.min(100, 40 + (uploadCount * 6) + (printCount * 5) + Math.round(completionPercent * 0.3) - (risk === 'high' ? 20 : risk === 'medium' ? 10 : 0)));
      return { uploadCount, printCount, completionPercent, remainingDays, risk, score };
    };
    const getUserLastUploadedDataRows = (user = {}) => readRecentActivitiesForDealer(user?.dealerCode)
      .filter((item) => /uploaded/i.test(item?.message || ''))
      .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime())
      .slice(0, USER_LAST_UPLOADED_DATA_LIMIT)
      .map((item) => ({
        id: item?.id || `${item?.createdAt || ''}-${item?.message || ''}`,
        message: item?.message || 'Uploaded data',
        createdAt: item?.createdAt || '',
      }));
    const buildAdminRequestTimeline = (entry = {}) => {
      const status = String(entry?.status || '').toLowerCase();
      return [
        { key: 'submitted', label: 'Submitted', at: entry?.requestedAt || entry?.createdAt || '', complete: Boolean(entry?.requestedAt || entry?.createdAt) },
        { key: 'pending', label: 'Pending', at: entry?.requestedAt || entry?.createdAt || '', complete: ['pending', 'approved', 'rejected'].includes(status) },
        {
          key: status === 'rejected' ? 'rejected' : 'approved',
          label: status === 'rejected' ? 'Rejected' : 'Approved',
          at: status === 'rejected' ? entry?.rejectedAt || '' : entry?.approvedAt || '',
          complete: status === 'approved' || status === 'rejected',
          tone: status === 'rejected' ? 'danger' : 'success',
        },
        { key: 'reply', label: 'Reply Sent', at: entry?.adminReplyAt || '', complete: Boolean(entry?.adminReply), tone: 'info' },
      ];
    };
    const getUserRequestTimelineRows = (user = {}) => (
      Object.entries(user?.pendingUpdates || {}).map(([type, entry]) => ({
        type,
        status: entry?.status || user?.approvalStatus?.[type] || 'draft',
        adminReply: entry?.adminReply || '',
        timeline: buildAdminRequestTimeline(entry),
      }))
    );
    const getUserAdminActivityRows = (user = {}) => {
      const dealerCode = String(user?.dealerCode || '').trim().toLowerCase();
      const email = String(user?.email || '').trim().toLowerCase();
      const userId = String(user?.id || '').trim().toLowerCase();
      return auditTrail
        .filter((item) => {
          const haystack = [
            item?.dealerCode,
            item?.email,
            item?.userId,
            item?.message,
            serializeSearchData(item?.payload),
          ].join(' ').toLowerCase();
          return Boolean(
            (dealerCode && haystack.includes(dealerCode))
            || (email && haystack.includes(email))
            || (userId && haystack.includes(userId))
          );
        })
        .slice(0, 6);
    };
    const serializeSearchData = (value) => {
      try {
        return JSON.stringify(value || '');
      } catch {
        return String(value || '');
      }
    };
    const dealerScorecards = users
      .map((user) => ({ user, health: getDealerHealthSummary(user) }))
      .sort((a, b) => b.health.score - a.health.score)
      .slice(0, 6);
    const filteredPendingRegistrationRequests = pendingRegistrationRequests.filter((r) =>
      isWithinAdminDateRange(r.createdAt || r.approvedAt) &&
      (adminSubFilter === 'all' || String(r.package || '') === adminSubFilter) &&
      matchesAdminSearch([r.dealerCode, r.dealerName, r.mobile, r.email, r.package, r.utr, r.status, r.date, serializeSearchData(r)])
    );
    const filteredUsersList = (activeAdminTab === 'active-user' ? activeUsersList : users).filter((u) => {
      const matchesSubFilter = adminSubFilter === 'all'
        || (adminSubFilter === 'expiring' && getRemainingDays(u.validTill) !== null && getRemainingDays(u.validTill) >= 0 && getRemainingDays(u.validTill) <= 7)
        || getUserAccountStatus(u) === adminSubFilter
        || String(u.role || '').toLowerCase() === adminSubFilter;
      return isWithinAdminDateRange(u.createdAt || u.approvedAt || u.updatedAt)
        && matchesSubFilter
        && matchesAdminSearch([
          u.dealerCode,
          u.dealerName,
          u.mobile,
          u.email,
          u.package,
          getUserAccountStatus(u),
          u.role,
          serializeSearchData(u.pendingUpdates),
          serializeSearchData(u.approvalStatus),
          serializeSearchData(u.profileData),
          serializeSearchData(u.bankDetailsData),
          ...normalizeLoginDevices(u.loginDevices).flatMap((device) => [
            device.deviceName,
            device.platform,
            device.browser,
            device.deviceId,
            getDeviceStatusLabel(device),
          ]),
        ]);
    });
    const filteredApprovals = nonDictionaryPendingApprovals.filter((a) =>
      isWithinAdminDateRange(a.requestedAt || a.approvedAt || a.rejectedAt) &&
      (adminSubFilter === 'all' || normalizeApprovalType(a.type) === adminSubFilter) &&
      matchesAdminSearch([a.dealerCode, a.dealerName, a.type, a.status, a.requestedAt, getApprovalReplyMessage(a), serializeSearchData(a.payload)])
    );
    const activeDictionaryApprovals = dictionaryRequestView === 'duplicate'
      ? duplicateDictionaryApprovals
      : dictionaryRequestView === 'api-request'
        ? apiRequestDictionaryApprovals
        : newDictionaryApprovals;
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
    const currentTabRows = activeAdminTab === 'pending-registration'
      ? filteredPendingRegistrationRequests
      : activeAdminTab === 'approval'
        ? filteredApprovals
          : (activeAdminTab === 'active-user' || activeAdminTab === 'total-user')
            ? filteredUsersList
            : activeAdminTab === 'dictionary'
              ? filteredDictionaryApprovals
              : activeAdminTab === 'announcements'
                ? announcements
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
    const pagedAnnouncements = paginateAdminRows(announcements, adminItemsPerPage, adminCurrentPage);
    const pagedDeletedUsers = paginateAdminRows(deletedUsersBin, adminItemsPerPage, adminCurrentPage);
    const pagedAuditTrail = paginateAdminRows(auditTrail, adminItemsPerPage, adminCurrentPage);
    const adminNotifications = [
      pendingCount > 0 ? { id: 'pending-requests', text: `${pendingCount} registration requests pending`, tone: 'blue' } : null,
      nonDictionaryPendingApprovals.length > 0 ? { id: 'pending-approvals', text: `${nonDictionaryPendingApprovals.length} approval requests waiting`, tone: 'amber' } : null,
      dictionaryPendingApprovals.length > 0 ? { id: 'pending-dictionary', text: `${dictionaryPendingApprovals.length} dictionary requests waiting`, tone: 'blue' } : null,
      expiringUsers.length > 0 ? { id: 'expiring-users', text: `${expiringUsers.length} active users expiring within 7 days`, tone: 'rose' } : null,
    ].filter(Boolean);
    const exportRowsAsCsv = (filename, rows) => {
      if (!Array.isArray(rows) || rows.length === 0) {
        pushToast('No data available to export.', 'error');
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
    const downloadDictionaryTemplate = () => {
      exportRowsAsCsv('dictionary-template.csv', DICTIONARY_TEMPLATE_ROWS);
    };
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
    const rejectedRequestCount = [
      ...requests.filter((item) => String(item?.status || '').toLowerCase() === 'rejected'),
      ...updateApprovals.filter((item) => String(item?.status || '').toLowerCase() === 'rejected'),
    ].length;
    const todayActivityCount = countItemsInDays(auditTrail, (item) => item.createdAt, 0);
    const adminStats = [
      { label: 'Pending Registration', value: pendingCount, tone: 'blue' },
      { label: 'Pending Approval', value: nonDictionaryPendingApprovals.length, tone: 'amber' },
      { label: 'Expiring Users', value: expiringUsers.length, tone: 'amber' },
      { label: 'Rejected Requests', value: rejectedRequestCount, tone: 'rose' },
      { label: "Today's Activity", value: todayActivityCount, tone: 'green' },
      { label: 'Active Users', value: activeUsers, tone: 'green' },
      { label: 'Total Users', value: userStatistics.total, tone: 'navy' },
    ];
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
      { key: 'active-user', label: 'Active User', count: activeUsers },
      { key: 'total-user', label: 'Total User', count: userStatistics.total },
      { key: 'create-user', label: 'Create User', count: null },
      { key: 'announcements', label: 'Announcements', count: activeAnnouncementCount },
      { key: 'recycle-bin', label: 'Recycle Bin', count: deletedUsersBin.length },
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
      'announcements': [{ value: 'all', label: 'All announcements' }],
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
      'announcements': {
        title: 'Global Announcement Center',
        subtitle: `${announcements.length} announcements created, ${activeAnnouncementCount} currently active`,
      },
      'dictionary': {
        title: 'Translation Dictionary',
        subtitle: `${newDictionaryApprovals.length} new requests, ${duplicateDictionaryApprovals.length} duplicate requests, ${apiRequestDictionaryApprovals.length} API requests waiting.`,
      },
      'recycle-bin': {
        title: 'Recycle Bin',
        subtitle: `${deletedUsersBin.length} deleted users available for restore`,
      },
      audit: {
        title: 'Audit Trail',
        subtitle: `${auditTrail.length} recent admin events recorded`,
      },
    }[activeAdminTab] || {
      title: 'Admin Dashboard',
      subtitle: 'Analytics, alerts, notifications, and quick admin control.',
    };
    const activeDrawer = detailView
      ? { ...detailView, type: 'detail' }
      : viewApproval
        ? { title: `Approval - ${viewApproval?.dealerCode || ''}`, data: viewApproval?.payload || {}, noteKey: `approval:${viewApproval?.id || ''}`, type: 'approval' }
        : viewRequest
          ? { title: `Request - ${viewRequest?.dealerCode || ''}`, data: viewRequest || {}, noteKey: `request:${viewRequest?.id || ''}`, type: 'request' }
          : null;
    const activeDrawerData = sanitizeUserForCache(activeDrawer?.data || {});
    const activeDrawerDetailSections = getDrawerDetailSections(activeDrawerData);
    const activeSubFilterOptions = adminSubFilterOptions[activeAdminTab] || [{ value: 'all', label: 'All' }];
    const getBulkPreviewItems = (items = []) => items.slice(0, 5).map((item, index) => {
      if (typeof item === 'string') {
        const request = requests.find((row) => row.id === item) || updateApprovals.find((row) => row.id === item);
        return request
          ? `${request.dealerCode || request.email || item} - ${request.dealerName || request.type || request.package || 'Request'}`
          : item;
      }
      return [
        item?.dealerCode,
        item?.dealerName,
        item?.type,
        item?.englishWord || item?.english || item?.word,
        item?.email,
      ].filter(Boolean).join(' - ') || `Row ${index + 1}`;
    });
    const confirmBulkAdminAction = async ({ action, count, items, tone = 'normal' }) => confirmAdminAction({
      title: 'Confirm Bulk Action',
      message: `You are ${action} ${count} record${count === 1 ? '' : 's'}. Continue?`,
      confirmLabel: 'Continue',
      previewTitle: 'Preview',
      previewItems: getBulkPreviewItems(items),
      previewMoreText: count > 5 ? `+${count - 5} more selected records` : '',
      dangerNote: tone === 'danger' ? 'This action can affect multiple users/requests at once.' : '',
    });

    const bulkApproveRegistrations = async () => {
      if (selectedRequestIds.length === 0) return;
      if (!(await confirmBulkAdminAction({ action: 'approving', count: selectedRequestIds.length, items: selectedRequestIds }))) return;
      await runBulkAdminAction(
        'Approve registrations',
        selectedRequestIds,
        (id) => approveRequest(id, { skipConfirm: true }),
        {
          onComplete: (failures) => {
            clearSelectedRequestIds();
            pushToast(
              failures.length === 0
                ? `${selectedRequestIds.length} registration requests approved.`
                : `${selectedRequestIds.length - failures.length} approved, ${failures.length} failed.`,
              failures.length === 0 ? 'success' : 'info',
            );
          },
        },
      );
    };
    const bulkRejectRegistrations = async () => {
      if (selectedRequestIds.length === 0) return;
      if (!(await confirmBulkAdminAction({ action: 'rejecting', count: selectedRequestIds.length, items: selectedRequestIds, tone: 'danger' }))) return;
      await runBulkAdminAction(
        'Reject registrations',
        selectedRequestIds,
        (id) => rejectRequest(id, { skipConfirm: true }),
        {
          onComplete: (failures) => {
            clearSelectedRequestIds();
            pushToast(
              failures.length === 0
                ? `${selectedRequestIds.length} registration requests rejected.`
                : `${selectedRequestIds.length - failures.length} rejected, ${failures.length} failed.`,
              failures.length === 0 ? 'info' : 'error',
            );
          },
        },
      );
    };
    const bulkApproveUpdates = async () => {
      const targets = filteredApprovals.filter((item) => selectedApprovalIds.includes(item.id));
      if (targets.length === 0) return;
      if (!(await confirmBulkAdminAction({ action: 'approving', count: targets.length, items: targets }))) return;
      await runBulkAdminAction(
        'Approve updates',
        targets,
        (item) => approveUpdateRequest(item, { skipConfirm: true, skipAlert: true }),
        {
          onComplete: (failures) => {
            clearSelectedApprovalIds();
            pushToast(
              failures.length === 0 ? `${targets.length} requests approved.` : `${targets.length - failures.length} approved, ${failures.length} failed.`,
              failures.length === 0 ? 'success' : 'info',
            );
          },
        },
      );
    };
    const bulkRejectUpdates = async () => {
      const targets = filteredApprovals.filter((item) => selectedApprovalIds.includes(item.id));
      if (targets.length === 0) return;
      if (!(await confirmBulkAdminAction({ action: 'rejecting', count: targets.length, items: targets, tone: 'danger' }))) return;
      await runBulkAdminAction(
        'Reject updates',
        targets,
        (item) => rejectUpdateRequest(item, { skipConfirm: true, skipAlert: true }),
        {
          onComplete: (failures) => {
            clearSelectedApprovalIds();
            pushToast(
              failures.length === 0 ? `${targets.length} requests rejected.` : `${targets.length - failures.length} rejected, ${failures.length} failed.`,
              failures.length === 0 ? 'info' : 'error',
            );
          },
        },
      );
    };
    const bulkApproveDictionaryRequests = async () => {
      const targets = filteredDictionaryApprovals.filter((item) => selectedApprovalIds.includes(item.id));
      if (targets.length === 0) return;
      if (!(await confirmBulkAdminAction({ action: 'approving', count: targets.length, items: targets }))) return;
      await runBulkAdminAction(
        'Approve dictionary requests',
        targets,
        (item) => approveUpdateRequest(item, { skipConfirm: true, skipAlert: true, skipRefresh: true }),
        {
          onComplete: async (failures) => {
            clearCompletedDictionaryRows();
            await loadData();
            flushDictionaryChanges();
            clearSelectedApprovalIds();
            pushToast(
              failures.length === 0 ? `${targets.length} dictionary requests approved.` : `${targets.length - failures.length} approved, ${failures.length} failed.`,
              failures.length === 0 ? 'success' : 'info',
            );
          },
        },
      );
    };
    const bulkRejectDictionaryRequests = async () => {
      const targets = filteredDictionaryApprovals.filter((item) => selectedApprovalIds.includes(item.id));
      if (targets.length === 0) return;
      if (!(await confirmBulkAdminAction({ action: 'rejecting', count: targets.length, items: targets, tone: 'danger' }))) return;
      await runBulkAdminAction(
        'Reject dictionary requests',
        targets,
        (item) => rejectUpdateRequest(item, { skipConfirm: true, skipAlert: true, skipRefresh: true }),
        {
          onComplete: async (failures) => {
            clearCompletedDictionaryRows();
            await loadData();
            flushDictionaryChanges();
            clearSelectedApprovalIds();
            pushToast(
              failures.length === 0 ? `${targets.length} dictionary requests rejected.` : `${targets.length - failures.length} rejected, ${failures.length} failed.`,
              failures.length === 0 ? 'info' : 'error',
            );
          },
        },
      );
    };
    const bulkApproveApiWords = async () => {
      if (selectedApiWordApprovals.length === 0) return;
      if (!(await confirmBulkAdminAction({ action: 'approving', count: selectedApiWordApprovals.length, items: selectedApiWordApprovals }))) return;
      await runBulkAdminAction(
        'Approve API word requests',
        selectedApiWordApprovals,
        (item) => approveUpdateRequest(item, { skipConfirm: true, skipAlert: true, skipRefresh: true }),
        {
          onComplete: async (failures) => {
            clearCompletedDictionaryRows();
            await loadData();
            flushDictionaryChanges();
            clearSelectedApiWordApprovalIds();
            pushToast(
              failures.length === 0
                ? `${selectedApiWordApprovals.length} API word requests approved.`
                : `${selectedApiWordApprovals.length - failures.length} approved, ${failures.length} failed.`,
              failures.length === 0 ? 'success' : 'info',
            );
          },
        },
      );
    };
    const bulkRejectApiWords = async () => {
      if (selectedApiWordApprovals.length === 0) return;
      if (!(await confirmBulkAdminAction({ action: 'rejecting', count: selectedApiWordApprovals.length, items: selectedApiWordApprovals, tone: 'danger' }))) return;
      await runBulkAdminAction(
        'Reject API word requests',
        selectedApiWordApprovals,
        (item) => rejectUpdateRequest(item, { skipConfirm: true, skipAlert: true, skipRefresh: true }),
        {
          onComplete: async (failures) => {
            clearCompletedDictionaryRows();
            await loadData();
            flushDictionaryChanges();
            clearSelectedApiWordApprovalIds();
            pushToast(
              failures.length === 0
                ? `${selectedApiWordApprovals.length} API word requests rejected.`
                : `${selectedApiWordApprovals.length - failures.length} rejected, ${failures.length} failed.`,
              failures.length === 0 ? 'info' : 'error',
            );
          },
        },
      );
    };
    const bulkToggleUsers = async () => {
      const targets = filteredUsersList.filter((u) => selectedUserTokens.includes(resolveEditToken(u)));
      if (targets.length === 0) return;
      if (!(await confirmBulkAdminAction({ action: 'toggling status for', count: targets.length, items: targets, tone: 'danger' }))) return;
      await runBulkAdminAction(
        'Toggle user status',
        targets,
        (item) => toggleUserStatus(item, { skipConfirm: true }),
        {
          onComplete: (failures) => {
            clearSelectedUserTokens();
            pushToast(
              failures.length === 0 ? `${targets.length} user statuses updated.` : `${targets.length - failures.length} updated, ${failures.length} failed.`,
              failures.length === 0 ? 'success' : 'info',
            );
          },
        },
      );
    };

    const toggleUserDeviceBlock = async (user, deviceId) => {
      if (!requireLiveAdminData()) return { ok: false, reason: 'Live Firebase sync required.' };
      if (!user || !deviceId) return;
      const devices = normalizeLoginDevices(user.loginDevices);
      const targetDevice = devices.find((device) => device.deviceId === deviceId);
      if (!targetDevice) {
        pushToast('Device record nahi mila.', 'error');
        return;
      }
      const shouldBlock = !targetDevice.blocked;
      const deviceLabel = targetDevice.deviceName || targetDevice.platform || deviceId;
      if (!(await confirmAdminAction({
        title: shouldBlock ? 'Block Device' : 'Unblock Device',
        message: `${shouldBlock ? 'Block' : 'Unblock'} device "${deviceLabel}" for ${user.dealerCode || user.email || 'this user'}?`,
        confirmLabel: shouldBlock ? 'Block Device' : 'Unblock Device',
        dangerNote: shouldBlock ? 'Blocked device will lose access until an admin unblocks it.' : '',
      }))) {
        return;
      }
      if (!requireLiveAdminData()) return;
      const updatedAt = new Date().toISOString();
      const loginDevices = devices.map((device) => (
        device.deviceId === deviceId
          ? {
            ...device,
            blocked: shouldBlock,
            blockedAt: shouldBlock ? updatedAt : device.blockedAt || '',
            unblockedAt: shouldBlock ? '' : updatedAt,
          }
          : device
      ));
      try {
        await patchAdminUser(user.id, { loginDevices });
        setAdminUserDetails((previous) => ({ ...previous, [user.id]: { ...user, loginDevices, updatedAt } }));
        logAdminActivity(shouldBlock ? 'device_blocked' : 'device_unblocked', {
          dealerCode: user.dealerCode || '',
          deviceId,
        });
        pushToast(`Device ${shouldBlock ? 'blocked' : 'unblocked'} successfully.`, 'success');
      } catch {
        await loadData();
        pushToast('Device status update failed. Please try again.', 'error');
      }
    };

    const saveDictionaryRowsToFirebase = async (rows, source = 'admin') => {
      const { entries, newEntries, duplicateEntries } = splitDictionaryImportEntries(translationDictionary, rows);
      if (!entries.length) {
        pushToast('No valid dictionary rows found. Use columns like English Word and Hindi Translation.', 'error');
        return;
      }

      const savedEntries = await persistDictionaryRowsToFirebase(newEntries, {
        source,
        status: 'approved',
        notifyEmpty: false,
        notifySuccess: false,
      });
      const queuedDuplicates = await createDictionaryApprovalRecords(duplicateEntries, {
        source: 'admin-import-duplicate',
        importMode: 'duplicate-review',
        queueLabel: 'Duplicate Dictionary',
        requestSource: 'admin-import',
      });

      if (savedEntries.length > 0) {
        logAdminActivity('dictionary_bulk_imported', { count: savedEntries.length, source });
      }
      if (queuedDuplicates.length > 0) {
        logAdminActivity('dictionary_bulk_duplicate_review_created', { count: queuedDuplicates.length, source });
      }

      await loadData();
      if (savedEntries.length > 0 && queuedDuplicates.length > 0) {
        pushToast(`${savedEntries.length} new words saved. ${queuedDuplicates.length} duplicate words review ke liye dictionary queue me bhej diye gaye.`, 'success');
        return;
      }
      if (savedEntries.length > 0) {
        pushToast(`${savedEntries.length} new dictionary words Firebase me save ho gaye.`, 'success');
        return;
      }
      if (queuedDuplicates.length > 0) {
        pushToast(`${queuedDuplicates.length} duplicate words review ke liye dictionary queue me bhej diye gaye.`, 'info');
        return;
      }
      pushToast('All imported rows already match stored dictionary.', 'info');
    };

    const handleDictionaryImport = async (event) => {
      if (!requireLiveAdminData()) return { ok: false, reason: 'Live Firebase sync required.' };
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
            pushToast('Dictionary import failed.', 'error');
          }
        };
        reader.readAsArrayBuffer(file);
      } catch {
        pushToast('Dictionary import failed.', 'error');
      } finally {
        event.target.value = null;
      }
    };

    useEffect(() => {
      setAdminCurrentPage((prev) => Math.min(prev, adminTotalPages));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [adminTotalPages]);

    useEffect(() => {
      setApiWordsCurrentPage((prev) => Math.min(prev, apiWordTotalPages));
    }, [apiWordTotalPages]);

    return (
      <div className={`placeholder-container admin-panel admin-panel--${adminRowDensity}`}>
        <div className="admin-header">
          <div className="admin-header-copy">
            <div className="admin-kicker">Control Center</div>
            <h2>Admin Panel</h2>
            <p>Registrations, approvals, and users ko ek jagah se manage kijiye.</p>
          </div>
          <div className="admin-header-actions">
            <button className="admin-ghost-btn" onClick={() => { retryDeniedFirestoreReads(); void loadData(); }}>Refresh Data</button>
            <button className="admin-logout-btn" onClick={onAdminLogout}>Log Out</button>
          </div>
        </div>

        <AdminDataStatus health={adminDataHealth} />

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
            <button
              type="button"
              className="admin-density-toggle"
              onClick={toggleAdminRowDensity}
              aria-pressed={adminRowDensity === 'compact' ? 'true' : 'false'}
              title="Toggle table row density"
            >
              {adminRowDensity === 'compact' ? 'Compact' : 'Comfortable'}
            </button>
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
            {activeAdminTab === 'announcements' && (
              <button className="admin-ghost-btn" onClick={() => exportRowsAsCsv('announcements.csv', announcements)}>Export CSV</button>
            )}
            {activeAdminTab !== 'create-user' && (
              <input
                className="form-input admin-search-input"
                type="text"
              aria-label="Search current tab"
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

        {(bulkActionState.active || bulkActionState.failures.length > 0) && (
          <div className="admin-bulk-progress" aria-live="polite">
            <div>
              <strong>{bulkActionState.label || 'Bulk action'}</strong>
              <span>
                {bulkActionState.active
                  ? ` ${bulkActionState.processed}/${bulkActionState.total} processed`
                  : ` completed with ${bulkActionState.failures.length} failure${bulkActionState.failures.length === 1 ? '' : 's'}`}
              </span>
            </div>
            <div className="admin-bulk-actions">
              {bulkActionState.failures.length > 0 && (
                <button className="admin-ghost-btn" onClick={exportBulkFailureReport}>Export Failures</button>
              )}
              {!bulkActionState.active && (
                <button className="admin-ghost-btn" onClick={resetBulkActionState}>Clear</button>
              )}
            </div>
          </div>
        )}

        {activeAdminTab === 'dashboard' && (
          <>
            <div className="admin-dashboard-grid">
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
                    <strong>{adminDataHealth.source === 'live' ? 'Live' : 'Not live'}</strong>
                  </div>
                  <div className="admin-health-card">
                    <span>Last Sync</span>
                    <strong>{adminDataHealth.lastSyncAt ? formatDisplayDateTime(adminDataHealth.lastSyncAt) : 'Unknown'}</strong>
                  </div>
                  <div className="admin-health-card">
                    <span>Audit Sync</span>
                    <strong>{`${auditSyncState.source || 'local fallback'}${auditSyncState.lastSyncAt ? ` - ${formatDisplayDate(auditSyncState.lastSyncAt)}` : ''}`}</strong>
                  </div>
                  {adminDataHealth.error && (
                    <div className="admin-health-card">
                      <span>Sync Detail</span>
                      <strong title={adminDataHealth.error}>{adminDataHealth.error}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="admin-dashboard-grid">
              <div className="admin-section">
                <h3>Dealer Scorecard</h3>
                <div className="admin-scorecard-list">
                  {dealerScorecards.map(({ user, health }) => (
                    <button
                      key={`scorecard-${user.id || user.dealerCode}`}
                      type="button"
                      className="admin-scorecard-item"
                      onClick={() => setDetailView({ title: `User - ${user?.dealerCode || ''}`, data: user, noteKey: `user:${user?.id || user?.dealerCode}:general` })}
                    >
                      <strong>{user.dealerCode || '-'}</strong>
                      <span>{user.dealerName || '-'}</span>
                      <small>Score {health.score} | Uploads {health.uploadCount} | Prints {health.printCount}</small>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {activeAdminTab === 'pending-registration' && (
        <div className="admin-section">
          <div className="admin-bulk-bar">
            <span>{selectedRequestIds.length} selected</span>
            <div className="admin-bulk-actions">
              <button className="admin-ghost-btn" onClick={() => setSelectedRequestIds(filteredPendingRegistrationRequests.map((r) => r.id))}>Select All</button>
              <button className="admin-ghost-btn" onClick={bulkApproveRegistrations} disabled={!canMutateAdminData}>Bulk Approve</button>
              <button className="admin-ghost-btn" onClick={bulkRejectRegistrations} disabled={!canMutateAdminData}>Bulk Reject</button>
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
              <button className="admin-ghost-btn" onClick={() => adminImportRef.current?.click()} disabled={!canMutateAdminData}>Import CSV/XLSX</button>
              <input ref={adminImportRef} type="file" accept=".csv,.xlsx" className="hidden-file-input" onChange={handleAdminImport} />
            </div>
          </div>
          <div className="admin-form">
            <input className="form-input" aria-label="New User Dealer Code" placeholder="Dealer Code" value={newUser.dealerCode} onChange={(e) => setNewUser((p) => ({ ...p, dealerCode: e.target.value }))} />
            <input className="form-input" aria-label="New User Dealer Name" placeholder="Dealer Name" value={newUser.dealerName} onChange={(e) => setNewUser((p) => ({ ...p, dealerName: e.target.value }))} />
            <input className="form-input" aria-label="New User Mobile" placeholder="Mobile" value={newUser.mobile} onChange={(e) => setNewUser((p) => ({ ...p, mobile: e.target.value }))} />
            <input className="form-input" aria-label="New User Email" placeholder="Email" type="email" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} />
            <select className="form-input" aria-label="New User Package" value={newUser.package} onChange={(e) => setNewUser((p) => ({ ...p, package: e.target.value }))}>
              <option value="">Select Package</option>
              {PACKAGE_OPTIONS.map((pkg) => (
                <option key={pkg} value={pkg}>{pkg}</option>
              ))}
            </select>
            <CredentialInput className="form-input" aria-label="New User PIN" placeholder="PIN" type="password" maxLength={6} value={newUser.pin} onChange={(e) => setNewUser((p) => ({ ...p, pin: e.target.value }))} />
            <select className="form-input" aria-label="New User Role" value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}>
              <option value="operator">Operator</option>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
            <input className="form-input" aria-label="New User Profile Distributor Code" placeholder="Profile Distributor Code (optional)" value={newUser.profileData.distributorCode} onChange={(e) => setNewUser((p) => ({ ...p, profileData: { ...p.profileData, distributorCode: e.target.value } }))} />
            <input className="form-input" aria-label="New User Profile Distributor Name" placeholder="Profile Distributor Name (optional)" value={newUser.profileData.distributorName} onChange={(e) => setNewUser((p) => ({ ...p, profileData: { ...p.profileData, distributorName: e.target.value } }))} />
            <input className="form-input" aria-label="New User Profile Contact" placeholder="Profile Contact (optional)" value={newUser.profileData.contact} onChange={(e) => setNewUser((p) => ({ ...p, profileData: { ...p.profileData, contact: e.target.value } }))} />
            <input className="form-input" aria-label="New User Profile Email" placeholder="Profile Email (optional)" type="email" value={newUser.profileData.email} onChange={(e) => setNewUser((p) => ({ ...p, profileData: { ...p.profileData, email: e.target.value } }))} />
            <input className="form-input" aria-label="New User Profile GST" placeholder="GST (optional)" value={newUser.profileData.gst} onChange={(e) => setNewUser((p) => ({ ...p, profileData: { ...p.profileData, gst: e.target.value } }))} />
            <textarea className="form-textarea" aria-label="New User Profile Address" placeholder="Profile Address (optional)" rows="2" value={newUser.profileData.address} onChange={(e) => setNewUser((p) => ({ ...p, profileData: { ...p.profileData, address: e.target.value } }))} />
            <label className="admin-file-field">Profile Photo<input type="file" accept="image/*" onChange={(e) => handleAdminUserImageChange(e, 'new', 'photoDataUrl')} /></label>
            <label className="admin-file-field">Payment QR<input type="file" accept="image/*" onChange={(e) => handleAdminUserImageChange(e, 'new', 'paymentQrDataUrl')} /></label>
            <input className="form-input" aria-label="New User Bank Name" placeholder="Bank Name (optional)" value={newUser.bankDetailsData.bankName} onChange={(e) => setNewUser((p) => ({ ...p, bankDetailsData: { ...p.bankDetailsData, bankName: e.target.value } }))} />
            <input className="form-input" aria-label="New User Bank Branch" placeholder="Branch (optional)" value={newUser.bankDetailsData.branch} onChange={(e) => setNewUser((p) => ({ ...p, bankDetailsData: { ...p.bankDetailsData, branch: e.target.value } }))} />
            <input className="form-input" aria-label="New User Bank Account" placeholder="Account No (optional)" value={newUser.bankDetailsData.accountNo} onChange={(e) => setNewUser((p) => ({ ...p, bankDetailsData: { ...p.bankDetailsData, accountNo: e.target.value } }))} />
            <input className="form-input" aria-label="New User Bank IFSC" placeholder="IFSC (optional)" value={newUser.bankDetailsData.ifsc} onChange={(e) => setNewUser((p) => ({ ...p, bankDetailsData: { ...p.bankDetailsData, ifsc: e.target.value } }))} />
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
              <button className="admin-ghost-btn" onClick={bulkToggleUsers} disabled={!canMutateAdminData}>Bulk Toggle Status</button>
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
                  <th>Profile Updated</th>
                  <th>Bank Updated</th>
                  <th>Rate Updated</th>
                  <th>Header Updated</th>
                  <th>Login Devices <span title="Convenience only — user localStorage clear karke naya deviceId le sakta hai; strong security ke liye App Check / security rules chahiye.">ⓘ</span></th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedUsersList.length === 0 ? (
                  <tr>
                    <td colSpan="13" className="admin-empty-cell">No users match the current search.</td>
                  </tr>
                ) : (
                  pagedUsersList.map((u, idx) => {
                    const deviceDetail = adminUserDetails[u.id];
                    const loginDevices = normalizeLoginDevices(deviceDetail?.loginDevices);
                    return (
                      <tr key={u.id || `${u.dealerCode || 'user'}-${idx}`}>
                        <td><input type="checkbox" checked={selectedUserTokens.includes(resolveEditToken(u))} onChange={() => toggleUserSelection(resolveEditToken(u))} /></td>
                        <td>{u.dealerCode || '-'}</td>
                        <td>{u.dealerName || '-'}</td>
                        <td>{u.mobile || '-'}</td>
                        <td>{u.email || '-'}</td>
                        <td><span className="admin-status-chip admin-status-chip--info">{u.package || '-'}</span></td>
                        <td>
                          <span className={`admin-status-chip admin-status-chip--${getUserAccountStatus(u)}`}>
                            {getUserAccountStatus(u)}
                          </span>{' '}
                          {formatDisplayDate(u.validTill)}
                          {getRemainingDays(u.validTill) !== null ? ` (${getRemainingDays(u.validTill)}d)` : ''}
                        </td>
                        <td><button type="button" onClick={() => { void openDetailView(u, 'profile'); }}>View</button></td>
                        <td><button type="button" onClick={() => { void openDetailView(u, 'bank'); }}>View</button></td>
                        <td><button type="button" onClick={() => { void openDetailView(u, 'rates'); }}>View</button></td>
                        <td><button type="button" onClick={() => { void openDetailView(u, 'header'); }}>View</button></td>
                        <td>
                          {!deviceDetail ? (
                            <button type="button" onClick={() => {
                              void loadAdminUserDetail(u.id).catch((error) => pushToast(error.message, 'error'));
                            }}>Load devices</button>
                          ) : loginDevices.length === 0 ? (
                            <span className="admin-empty-device">No login yet</span>
                          ) : (
                            <div className="admin-device-list">
                              {loginDevices.map((device) => (
                                <div key={device.deviceId} className="admin-device-row">
                                  <LoginDeviceDetails device={device} accountName={deviceDetail.dealerName || deviceDetail.name} />
                                  <div className="admin-device-actions">
                                    <span className={`admin-status-chip admin-status-chip--${device.blocked ? 'disabled' : 'active'}`}>{getDeviceStatusLabel(device)}</span>
                                    <button
                                      type="button"
                                      className="admin-ghost-btn"
                                      onClick={() => toggleUserDeviceBlock(deviceDetail, device.deviceId)}
                                      disabled={!canMutateAdminData}
                                    >
                                      {device.blocked ? 'Unblock' : 'Block'}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="admin-actions">
                            <button onClick={async () => {
                              const detail = await loadAdminUserDetail(u.id).catch(() => null);
                              setDetailView({ title: `User - ${u?.dealerCode || ''}`, data: detail || u, noteKey: `user:${u?.id || u?.dealerCode}:general` });
                            }}>View</button>
                            <button onClick={() => startEditUser(u)} disabled={!canMutateAdminData}>Edit</button>
                            <button onClick={() => toggleUserStatus(u)} disabled={!canMutateAdminData}>
                              {getUserAccountStatus(u) === 'active' ? 'Disable' : 'Enable'}
                            </button>
                            <button onClick={() => deleteUser(u)} disabled={!canMutateAdminData}>Delete</button>
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

        {editingUserId && (
          <div className="admin-section">
            <h3>Edit User Details</h3>
            <div className="admin-edit-grid">
              <input className="form-input" aria-label="Edit User Dealer Code" placeholder="Dealer Code" value={editUser.dealerCode} onChange={(e) => setEditUser((p) => ({ ...p, dealerCode: e.target.value }))} />
              <input className="form-input" aria-label="Edit User Dealer Name" placeholder="Dealer Name" value={editUser.dealerName} onChange={(e) => setEditUser((p) => ({ ...p, dealerName: e.target.value }))} />
              <input className="form-input" aria-label="Edit User Mobile" placeholder="Mobile" value={editUser.mobile} onChange={(e) => setEditUser((p) => ({ ...p, mobile: e.target.value }))} />
              <input className="form-input" aria-label="Edit User Email" placeholder="Email" value={editUser.email} onChange={(e) => setEditUser((p) => ({ ...p, email: e.target.value }))} />
              <select className="form-input" aria-label="Edit User Package" value={editUser.package} onChange={(e) => {
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
              <input className="form-input" aria-label="Edit User Valid From" type="date" value={editUser.validFrom} onChange={(e) => setEditUser((p) => ({ ...p, validFrom: e.target.value }))} />
              <input className="form-input" aria-label="Edit User Valid Till" type="date" value={editUser.validTill} onChange={(e) => setEditUser((p) => ({ ...p, validTill: e.target.value }))} />
              <CredentialInput className="form-input" aria-label="Edit User PIN" placeholder="PIN" type="password" value={editUser.pin} onChange={(e) => setEditUser((p) => ({ ...p, pin: e.target.value }))} />
              <select className="form-input" aria-label="Edit User Role" value={editUser.role} onChange={(e) => setEditUser((p) => ({ ...p, role: e.target.value }))}>
                <option value="operator">Operator</option>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
              <select className="form-input" aria-label="Edit User Status" value={editUser.status} onChange={(e) => setEditUser((p) => ({ ...p, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div className="admin-edit-grid admin-edit-grid-profile">
              <input className="form-input" aria-label="Edit Profile Distributor Code" placeholder="Profile Distributor Code" value={editUser.profileData.distributorCode} onChange={(e) => setEditUser((p) => ({ ...p, profileData: { ...p.profileData, distributorCode: e.target.value } }))} />
              <input className="form-input" aria-label="Edit Profile Distributor Name" placeholder="Profile Distributor Name" value={editUser.profileData.distributorName} onChange={(e) => setEditUser((p) => ({ ...p, profileData: { ...p.profileData, distributorName: e.target.value } }))} />
              <input className="form-input" aria-label="Edit Profile Contact" placeholder="Profile Contact" value={editUser.profileData.contact} onChange={(e) => setEditUser((p) => ({ ...p, profileData: { ...p.profileData, contact: e.target.value } }))} />
              <input className="form-input" aria-label="Edit Profile Email" placeholder="Profile Email" value={editUser.profileData.email} onChange={(e) => setEditUser((p) => ({ ...p, profileData: { ...p.profileData, email: e.target.value } }))} />
              <input className="form-input" aria-label="Edit Profile GST" placeholder="Profile GST" value={editUser.profileData.gst} onChange={(e) => setEditUser((p) => ({ ...p, profileData: { ...p.profileData, gst: e.target.value } }))} />
              <input className="form-input" aria-label="Edit Profile Address" placeholder="Profile Address" value={editUser.profileData.address} onChange={(e) => setEditUser((p) => ({ ...p, profileData: { ...p.profileData, address: e.target.value } }))} />
              <label className="admin-file-field">Profile Photo
                <input type="file" accept="image/*" onChange={(e) => handleAdminUserImageChange(e, 'edit', 'photoDataUrl')} />
                {editUser.profileData.photoDataUrl && <img className="admin-image-preview" src={editUser.profileData.photoDataUrl} alt="Profile preview" />}
              </label>
              <label className="admin-file-field">Payment QR
                <input type="file" accept="image/*" onChange={(e) => handleAdminUserImageChange(e, 'edit', 'paymentQrDataUrl')} />
                {editUser.profileData.paymentQrDataUrl && <img className="admin-image-preview" src={editUser.profileData.paymentQrDataUrl} alt="Payment QR preview" />}
              </label>
            </div>
            <div className="admin-edit-grid admin-edit-grid-bank">
              <input className="form-input" aria-label="Edit Bank Name" placeholder="Bank Name" value={editUser.bankDetailsData.bankName} onChange={(e) => setEditUser((p) => ({ ...p, bankDetailsData: { ...p.bankDetailsData, bankName: e.target.value } }))} />
              <input className="form-input" aria-label="Edit Branch" placeholder="Branch" value={editUser.bankDetailsData.branch} onChange={(e) => setEditUser((p) => ({ ...p, bankDetailsData: { ...p.bankDetailsData, branch: e.target.value } }))} />
              <input className="form-input" aria-label="Edit Account No" placeholder="Account No" value={editUser.bankDetailsData.accountNo} onChange={(e) => setEditUser((p) => ({ ...p, bankDetailsData: { ...p.bankDetailsData, accountNo: e.target.value } }))} />
              <input className="form-input" aria-label="Edit IFSC" placeholder="IFSC" value={editUser.bankDetailsData.ifsc} onChange={(e) => setEditUser((p) => ({ ...p, bankDetailsData: { ...p.bankDetailsData, ifsc: e.target.value } }))} />
            </div>
            <div className="form-actions">
              <button onClick={saveEditedUser} disabled={!canMutateAdminData}>Save User Changes</button>
              <button onClick={() => { setEditingUserId(''); setEditUser((prev) => ({ ...prev, pin: '' })); }}>Cancel</button>
            </div>
          </div>
        )}

        {activeAdminTab === 'approval' && (
          <div className="admin-section">
            <div className="admin-bulk-bar">
              <span>{selectedApprovalIds.length} selected</span>
              <div className="admin-bulk-actions">
                <button className="admin-ghost-btn" onClick={() => setSelectedApprovalIds(filteredApprovals.map((a) => a.id))}>Select All</button>
                <button className="admin-ghost-btn" onClick={bulkApproveUpdates} disabled={!canMutateAdminData}>Bulk Approve</button>
                <button className="admin-ghost-btn" onClick={bulkRejectUpdates} disabled={!canMutateAdminData}>Bulk Reject</button>
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
                              <button type="button" className="admin-ghost-btn" onClick={(e) => { e.preventDefault(); openApprovalReplyPopup(a); }} disabled={!canMutateAdminData}>
                                Approval Reply
                              </button>
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
                      <p>{getApprovalReplyRequestSummary(activeApprovalReply)}</p>
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
                    <button type="button" className="form-button" onClick={submitApprovalReply} disabled={!canMutateAdminData}>Send Approval Reply</button>
                    <button type="button" className="form-button secondary" onClick={closeApprovalReplyPopup}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
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
                <button
                  className={`admin-ghost-btn ${dictionaryRequestView === 'api-request' ? 'dictionary-submenu-active' : ''}`}
                  onClick={() => {
                    setDictionaryRequestView('api-request');
                    clearSelectedApprovalIds();
                  }}
                >
                  API Request Dictionary ({apiRequestDictionaryApprovals.length})
                </button>
                <button className="admin-ghost-btn" onClick={() => dictionaryImportRef.current?.click()} disabled={!canMutateAdminData}>Import Excel</button>
                <button className="admin-ghost-btn" onClick={downloadDictionaryTemplate}>Sample Template</button>
                <input ref={dictionaryImportRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleDictionaryImport} />
                <button className="admin-ghost-btn" onClick={() => setSelectedApprovalIds(filteredDictionaryApprovals.map((a) => a.id))}>Select All Requests</button>
                <button className="admin-ghost-btn" onClick={bulkApproveDictionaryRequests} disabled={!canMutateAdminData}>Bulk Approve</button>
                <button className="admin-ghost-btn" onClick={bulkRejectDictionaryRequests} disabled={!canMutateAdminData}>Bulk Reject</button>
              </div>
            </div>
            <div className="dictionary-template-note">
              Bulk upload headers: <strong>English Word</strong>, <strong>Hindi Translation</strong>. Sample template button se exact format download kar sakte hain.
            </div>
            <div className="dictionary-observability-panel">
              <div className="dictionary-observability-panel__title">Translation Observability</div>
              <div className="dictionary-observability-grid">
                <div><span>API Words</span><strong>{translationObservability.apiCount}</strong></div>
                <div><span>Dictionary Hits</span><strong>{translationObservability.dictionaryCount}</strong></div>
                <div><span>Transliteration Fallbacks</span><strong>{translationObservability.transliterationCount}</strong></div>
                <div><span>Queued API Requests</span><strong>{translationObservability.queuedCount}</strong></div>
              </div>
              <div className="dictionary-observability-panel__meta">
                {translationObservability.lastUpdatedAt ? `Last Hindi print: ${formatDisplayDateTime(translationObservability.lastUpdatedAt)}` : 'Hindi print observability data will appear here after a print run.'}
              </div>
            </div>
            <div className="dictionary-template-preview">
              <div className="dictionary-template-preview__header">
                <strong>API Words List</strong>
                <span>Ye words API se aaye hain. Admin yahin se approve karke translation dictionary database me save kar sakta hai.</span>
              </div>
              <div className="admin-bulk-bar admin-bulk-bar--compact">
                <span>{selectedApiWordApprovalIds.length} API word request selected</span>
                <div className="admin-bulk-actions">
                  <button
                    className="admin-ghost-btn"
                    onClick={() => setSelectedApiWordApprovalIds(apiWordDisplayRows.filter((entry) => entry.approval?.id).map((entry) => entry.approval.id))}
                  >
                    Select All API Words
                  </button>
                  <button
                    className="admin-ghost-btn"
                    onClick={bulkApproveApiWords}
                    disabled={!canMutateAdminData || selectedApiWordApprovals.length === 0}
                  >
                    Bulk Approve
                  </button>
                  <button
                    className="admin-ghost-btn"
                    onClick={bulkRejectApiWords}
                    disabled={!canMutateAdminData || selectedApiWordApprovals.length === 0}
                  >
                    Bulk Reject
                  </button>
                  <button
                    className="admin-ghost-btn"
                    onClick={clearSelectedApiWordApprovalIds}
                    disabled={selectedApiWordApprovalIds.length === 0}
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table dictionary-template-preview__table">
                  <thead>
                    <tr>
                      <th>Select</th>
                      <th>English Word</th>
                      <th>Hindi Translation</th>
                      <th>Phrase/Token</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedApiWordDisplayRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="admin-empty-cell">No API words captured yet. Hindi print run ke baad yahan list dikhegi.</td>
                      </tr>
                    ) : (
                      pagedApiWordDisplayRows.map((entry, index) => (
                        <tr key={`${entry.approvalId || entry.englishWord}-${index}`}>
                          <td>
                            {entry.approval ? (
                              <input
                                type="checkbox"
                                checked={selectedApiWordApprovalIds.includes(entry.approval.id)}
                                onChange={() => toggleApiWordSelection(entry.approval.id)}
                              />
                            ) : null}
                          </td>
                          <td>
                            {entry.approval ? (
                              <input
                                className="form-input admin-inline-input"
                                aria-label="English Word for API request"
                                value={getDictionaryApprovalPayload(entry.approval)?.englishWord || entry.englishWord}
                                onChange={(e) => updateDictionaryApprovalEdit(entry.approval, 'englishWord', e.target.value)}
                                disabled={!canMutateAdminData}
                              />
                            ) : entry.englishWord}
                          </td>
                          <td>
                            {entry.approval ? (
                              <input
                                className="form-input admin-inline-input"
                                aria-label="Hindi Translation for API request"
                                value={getDictionaryApprovalPayload(entry.approval)?.hindiTranslation || entry.hindiTranslation}
                                onChange={(e) => updateDictionaryApprovalEdit(entry.approval, 'hindiTranslation', e.target.value)}
                                disabled={!canMutateAdminData}
                              />
                            ) : entry.hindiTranslation}
                          </td>
                          <td>{entry.phraseKind || 'token'}</td>
                          <td>
                            {entry.approval
                              ? 'Pending admin approval'
                              : entry.status && entry.status.toLowerCase() !== 'pending'
                                ? entry.status
                                : 'Captured'}
                          </td>
                          <td>
                            <div className="admin-actions">
                              {entry.approval ? (
                                <>
                                  <button
                                    type="button"
                                    className="admin-ghost-btn"
                                    onClick={() => approveUpdateRequest(entry.approval)}
                                    disabled={!canMutateAdminData}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-ghost-btn"
                                    onClick={() => rejectUpdateRequest(entry.approval)}
                                    disabled={!canMutateAdminData}
                                  >
                                    Reject
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="admin-ghost-btn"
                                  onClick={() => {
                                    setDictionaryRequestView('api-request');
                                    clearSelectedApprovalIds();
                                  }}
                                >
                                  Open API Queue
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {apiWordDisplayRows.length > adminItemsPerPage && (
                <div className="admin-pagination">
                  <button
                    className="admin-ghost-btn"
                    onClick={() => setApiWordsCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={apiWordsCurrentPage === 1}
                  >
                    Previous
                  </button>
                  <div className="admin-pagination__numbers">
                    {Array.from({ length: apiWordTotalPages }, (_, index) => index + 1).map((pageNumber) => (
                      <button
                        key={`api-word-page-${pageNumber}`}
                        type="button"
                        className={`admin-ghost-btn ${apiWordsCurrentPage === pageNumber ? 'admin-ghost-btn--active' : ''}`}
                        onClick={() => setApiWordsCurrentPage(pageNumber)}
                      >
                        {pageNumber}
                      </button>
                    ))}
                  </div>
                  <button
                    className="admin-ghost-btn"
                    onClick={() => setApiWordsCurrentPage((prev) => Math.min(apiWordTotalPages, prev + 1))}
                    disabled={apiWordsCurrentPage === apiWordTotalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
            <div className="dictionary-template-preview">
              <div className="dictionary-template-preview__header">
                <strong>Sample Template View</strong>
                <span>Admin chahe to isi format ko download karke bulk upload ke liye use kar sakta hai.</span>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table dictionary-template-preview__table">
                  <thead>
                    <tr>
                      <th>English Word</th>
                      <th>Hindi Translation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DICTIONARY_TEMPLATE_ROWS.map((row, index) => (
                      <tr key={`dictionary-template-${index}`}>
                        <td>{row['English Word']}</td>
                        <td>{row['Hindi Translation']}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="admin-table-wrap" style={{ marginBottom: '20px' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Request Source</th>
                    <th>Requested From</th>
                    <th>Phrase/Token</th>
                    <th>English Word</th>
                    {dictionaryRequestView !== 'new' && <th>Existing Hindi</th>}
                    <th>Hindi Translation</th>
                    <th>Approved By</th>
                    <th>Approved At</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedDictionaryApprovals.length === 0 ? (
                    <tr><td colSpan={dictionaryRequestView === 'new' ? 11 : 12} className="admin-empty-cell">No dictionary approval requests pending.</td></tr>
                  ) : (
                    pagedDictionaryApprovals.map((a) => {
                      const dictionaryPayload = getDictionaryApprovalPayload(a);
                      const existingEntry = getExistingDictionaryEntry(translationDictionary, dictionaryPayload?.englishWord || dictionaryPayload?.eng);
                      return (
                        <tr key={a.id}>
                          <td><input type="checkbox" checked={selectedApprovalIds.includes(a.id)} onChange={() => toggleApprovalSelection(a.id)} /></td>
                          <td>{a.dealerCode || '-'}</td>
                          <td>{a.dealerName || '-'}</td>
                          <td>{dictionaryPayload?.requestSource || '-'}</td>
                          <td>{dictionaryPayload?.requestedFrom || '-'}</td>
                          <td>{dictionaryPayload?.phraseKind || '-'}</td>
                          <td>
                            <input
                              className="form-input"
                              aria-label="English word"
                              value={dictionaryPayload?.englishWord || ''}
                              onChange={(e) => updateDictionaryApprovalEdit(a, 'englishWord', e.target.value)}
                              placeholder="English word"
                            />
                          </td>
                          {dictionaryRequestView !== 'new' && (
                            <td className="dictionary-existing-value">{existingEntry?.hindiTranslation || '-'}</td>
                          )}
                          <td>
                            <input
                              className="form-input"
                              aria-label="Hindi translation"
                              value={dictionaryPayload?.hindiTranslation || ''}
                              onChange={(e) => updateDictionaryApprovalEdit(a, 'hindiTranslation', e.target.value)}
                              placeholder="Hindi translation"
                            />
                          </td>
                          <td>{dictionaryPayload?.approvedBy || '-'}</td>
                          <td>{formatDisplayDate(dictionaryPayload?.approvedAt) || '-'}</td>
                          <td>{formatDisplayDate(a.requestedAt)}</td>
                          <td>
                            <div className="admin-actions">
                              <button onClick={() => setViewApproval({ ...a, payload: dictionaryPayload })}>View</button>
                              <button type="button" onClick={() => approveUpdateRequest(a)} disabled={!canMutateAdminData}>Approve</button>
                              <button type="button" onClick={() => rejectUpdateRequest(a)} disabled={!canMutateAdminData}>Reject</button>
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
              <div className="admin-drawer-summary-grid">
                {getDrawerSummaryRows({
                  drawer: {
                    ...activeDrawer,
                    data: activeDrawerData,
                    typeLabel: activeDrawer?.type === 'approval' ? normalizeApprovalType(viewApproval?.type) : '',
                    rawType: viewApproval?.type || '',
                    requestedAt: viewApproval?.requestedAt || viewRequest?.createdAt || '',
                    dealerCode: viewApproval?.dealerCode || viewRequest?.dealerCode || activeDrawerData?.dealerCode || '',
                  },
                  users,
                  formatDisplayDate,
                  formatDisplayDateTime,
                }).map((item) => (
                  <div key={`${activeDrawer.noteKey}-${item.label}`} className="admin-drawer-summary-card">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
              {activeDrawer?.type === 'detail' && /^User - /.test(activeDrawer?.title || '') && (
                <div className="admin-drawer-sections">
                  <div className="admin-drawer-section">
                    <h4>Profile Completeness</h4>
                    <ul>
                      <li>Profile: {activeDrawerData?.profileData?.distributorName ? 'Available' : 'Missing'}</li>
                      <li>Bank: {activeDrawerData?.bankDetailsData?.bankName ? 'Available' : 'Missing'}</li>
                      <li>Rates: {Array.isArray(activeDrawerData?.ratesData) && activeDrawerData.ratesData.length > 0 ? 'Available' : 'Missing'}</li>
                      <li>Header: {activeDrawerData?.hindiHeaderData ? 'Available' : 'Missing'}</li>
                    </ul>
                  </div>
                  <div className="admin-drawer-section">
                    <h4>Dealer Scorecard</h4>
                    <ul>
                      {(() => {
                        const health = getDealerHealthSummary(activeDrawerData);
                        return [
                          <li key="score">Score: {health.score}</li>,
                          <li key="uploads">Uploads logged: {health.uploadCount}</li>,
                          <li key="prints">Print actions: {health.printCount}</li>,
                          <li key="completion">Profile completion: {health.completionPercent}%</li>,
                          <li key="risk">Expiry risk: {health.risk}</li>,
                        ];
                      })()}
                    </ul>
                  </div>
                  <div className="admin-drawer-section">
                    <h4>Request History</h4>
                    {(() => {
                      const rows = getUserRequestTimelineRows(activeDrawerData);
                      return rows.length === 0 ? (
                        <div className="admin-drawer-empty">No approval history recorded.</div>
                      ) : (
                        <div className="admin-request-timeline">
                          {rows.map((row) => (
                            <div key={`${activeDrawer.noteKey}-request-${row.type}`} className="admin-request-row">
                              <div className="admin-request-row-head">
                                <strong>{formatDrawerFieldLabel(row.type)}</strong>
                                <span className={`admin-status-chip admin-status-chip--${String(row.status || '').toLowerCase() === 'rejected' ? 'danger' : String(row.status || '').toLowerCase() === 'approved' ? 'success' : 'warning'}`}>
                                  {row.status || 'draft'}
                                </span>
                              </div>
                              <div className="admin-request-steps">
                                {row.timeline.map((step) => (
                                  <div
                                    key={`${row.type}-${step.key}`}
                                    className={`admin-request-step ${step.complete ? 'is-complete' : ''} ${step.tone ? `admin-request-step--${step.tone}` : ''}`}
                                  >
                                    <strong>{step.label}</strong>
                                    <span>{formatDisplayDateTime(step.at) || (step.complete ? 'Done' : 'Waiting')}</span>
                                  </div>
                                ))}
                              </div>
                              {row.adminReply && <p className="admin-request-reply">Reply: {row.adminReply}</p>}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="admin-drawer-section">
                    <h4>Last Uploaded Data</h4>
                    <ul>
                      {(() => {
                        const lastUploadedRows = getUserLastUploadedDataRows(activeDrawerData);
                        return lastUploadedRows.length === 0 ? (
                          <li>No upload data recorded.</li>
                        ) : (
                          lastUploadedRows.map((item) => (
                            <li key={`${activeDrawer.noteKey}-upload-${item.id}`}>
                              {formatDisplayDateTime(item.createdAt)}: {item.message}
                            </li>
                          ))
                        );
                      })()}
                    </ul>
                  </div>
                  <div className="admin-drawer-section">
                    <h4>Login Devices</h4>
                    <ul>
                      {normalizeLoginDevices(activeDrawerData?.loginDevices).length === 0 ? (
                        <li>No device login recorded.</li>
                      ) : (
                        normalizeLoginDevices(activeDrawerData?.loginDevices).map((device) => (
                          <li key={`${activeDrawer.noteKey}-device-${device.deviceId}`}>
                            <span>{getDeviceStatusLabel(device)}</span>
                            <LoginDeviceDetails device={device} accountName={activeDrawerData.dealerName || activeDrawerData.name} />
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                  <div className="admin-drawer-section">
                    <h4>Recent Activity</h4>
                    <ul>
                      {getUserAdminActivityRows(activeDrawerData).length === 0 ? (
                        <li>No recent activity recorded.</li>
                      ) : (
                        getUserAdminActivityRows(activeDrawerData).map((item) => (
                          <li key={`${activeDrawer.noteKey}-activity-${item.id}`}>
                            {formatDisplayDateTime(item.createdAt)}: {item.message}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              )}
              {activeDrawer?.type === 'approval' && (
                <div className="admin-drawer-section">
                  <h4>Approval Payload</h4>
                  <div className="admin-drawer-field-list">
                    {activeDrawerDetailSections.simpleFields.length === 0 && activeDrawerDetailSections.groupedFields.length === 0 && activeDrawerDetailSections.listFields.length === 0 ? (
                      <div className="admin-drawer-empty">No approval payload available.</div>
                    ) : (
                      <>
                        {activeDrawerDetailSections.simpleFields.length > 0 && (
                          <div className="admin-drawer-section">
                            <h4>Basic Details</h4>
                            <ul>
                              {activeDrawerDetailSections.simpleFields.map((item) => (
                                <li key={`approval-basic-${item.key}`}>{formatDrawerFieldLabel(item.key)}: {formatDrawerFieldValue(item.value)}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {activeDrawerDetailSections.groupedFields.map((group) => (
                          <div key={`approval-group-${group.key}`} className="admin-drawer-section">
                            <h4>{formatDrawerFieldLabel(group.key)}</h4>
                            <ul>
                              {Object.entries(group.value || {}).map(([nestedKey, nestedValue]) => (
                                <li key={`approval-group-${group.key}-${nestedKey}`}>{formatDrawerFieldLabel(nestedKey)}: {formatDrawerFieldValue(nestedValue)}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                        {activeDrawerDetailSections.listFields.map((group) => (
                          <div key={`approval-list-${group.key}`} className="admin-drawer-section">
                            <h4>{formatDrawerFieldLabel(group.key)}</h4>
                            {group.value.length === 0 ? (
                              <div className="admin-drawer-empty">No items available.</div>
                            ) : (
                              <ul>
                                {group.value.map((item, index) => (
                                  <li key={`approval-list-${group.key}-${index}`}>
                                    {typeof item === 'object'
                                      ? Object.entries(item || {}).map(([nestedKey, nestedValue]) => `${formatDrawerFieldLabel(nestedKey)}: ${formatDrawerFieldValue(nestedValue)}`).join(', ')
                                      : formatDrawerFieldValue(item)}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
              {activeDrawer?.type !== 'approval' && (
                <div className="admin-drawer-sections">
                  {activeDrawerDetailSections.simpleFields.length > 0 && (
                    <div className="admin-drawer-section">
                      <h4>Basic Details</h4>
                      <ul>
                        {activeDrawerDetailSections.simpleFields.map((item) => (
                          <li key={`drawer-basic-${item.key}`}>{formatDrawerFieldLabel(item.key)}: {formatDrawerFieldValue(item.value)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {activeDrawerDetailSections.groupedFields.map((group) => (
                    <div key={`drawer-group-${group.key}`} className="admin-drawer-section">
                      <h4>{formatDrawerFieldLabel(group.key)}</h4>
                      <ul>
                        {Object.entries(group.value || {}).map(([nestedKey, nestedValue]) => (
                          <li key={`drawer-group-${group.key}-${nestedKey}`}>{formatDrawerFieldLabel(nestedKey)}: {formatDrawerFieldValue(nestedValue)}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {activeDrawerDetailSections.listFields.map((group) => (
                    <div key={`drawer-list-${group.key}`} className="admin-drawer-section">
                      <h4>{formatDrawerFieldLabel(group.key)}</h4>
                      {group.value.length === 0 ? (
                        <div className="admin-drawer-empty">No items available.</div>
                      ) : (
                        <ul>
                          {group.value.map((item, index) => (
                            <li key={`drawer-list-${group.key}-${index}`}>
                              {typeof item === 'object'
                                ? Object.entries(item || {}).map(([nestedKey, nestedValue]) => `${formatDrawerFieldLabel(nestedKey)}: ${formatDrawerFieldValue(nestedValue)}`).join(', ')
                                : formatDrawerFieldValue(item)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                  {activeDrawerDetailSections.simpleFields.length === 0 && activeDrawerDetailSections.groupedFields.length === 0 && activeDrawerDetailSections.listFields.length === 0 && (
                    <div className="admin-drawer-section">
                      <h4>Details</h4>
                      <div className="admin-drawer-empty">No structured data available.</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeAdminTab === 'announcements' && (
          <div className="admin-section">
            <div key={announcementDraftFormKey} className="admin-form admin-form--announcements">
              <input
                className="form-input"
                aria-label="Announcement title"
                placeholder="Announcement title"
                defaultValue={announcementDraft.title}
                onChange={(e) => { announcementDraftRef.current = { ...announcementDraftRef.current, title: e.target.value }; }}
              />
              <select
                className="form-input"
                aria-label="Announcement target scope"
                defaultValue={announcementDraft.targetScope}
                onChange={(e) => { announcementDraftRef.current = { ...announcementDraftRef.current, targetScope: e.target.value }; }}
              >
                <option value="all">All Users</option>
                <option value="active">Active Users</option>
                <option value="expiring">Expiring Soon</option>
                <option value="expired">Expired Users</option>
                {PACKAGE_OPTIONS.map((pkg) => (
                  <option key={`announcement-${pkg}`} value={String(pkg).toLowerCase()}>{pkg}</option>
                ))}
              </select>
              <select
                className="form-input"
                aria-label="Announcement notice type"
                defaultValue={announcementDraft.noticeType}
                onChange={(e) => { announcementDraftRef.current = { ...announcementDraftRef.current, noticeType: e.target.value }; }}
              >
                <option value="notice">General Notice</option>
                <option value="renewal">Renewal Alert</option>
                <option value="maintenance">Maintenance</option>
                <option value="approval">Approval Notice</option>
              </select>
              <input
                className="form-input"
                aria-label="Announcement expiry date"
                type="date"
                defaultValue={announcementDraft.expiresAt}
                onChange={(e) => { announcementDraftRef.current = { ...announcementDraftRef.current, expiresAt: e.target.value }; }}
              />
              <textarea
                className="form-input admin-announcement-message"
                aria-label="Announcement message"
                rows="3"
                placeholder="Type announcement message"
                defaultValue={announcementDraft.message}
                onChange={(e) => { announcementDraftRef.current = { ...announcementDraftRef.current, message: e.target.value }; }}
              />
              <button onClick={() => { if (requireLiveAdminData()) handleCreateAnnouncement(); }} disabled={!canMutateAdminData}>Publish</button>
            </div>
            <div className="admin-table-wrap" style={{ marginTop: '14px' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Target</th>
                    <th>Expires</th>
                    <th>Status</th>
                    <th>Message</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedAnnouncements.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="admin-empty-cell">No announcements created yet.</td>
                    </tr>
                  ) : (
                    pagedAnnouncements.map((item) => (
                      <tr key={item.id}>
                        <td>{item.title || '-'}</td>
                        <td>{item.noticeType || '-'}</td>
                        <td>{getAnnouncementScopeLabel(item.targetScope)}</td>
                        <td>{item.expiresAt || '-'}</td>
                        <td>
                          <span className={`admin-status-chip admin-status-chip--${item.active ? 'approved' : 'rejected'}`}>
                            {item.active ? 'Active' : 'Paused'}
                          </span>
                        </td>
                        <td>{item.message || '-'}</td>
                        <td>
                          <div className="admin-actions">
                            <button onClick={() => { if (requireLiveAdminData()) toggleAnnouncementStatus(item.id); }} disabled={!canMutateAdminData}>
                              {item.active ? 'Pause' : 'Activate'}
                            </button>
                            <button onClick={() => { if (requireLiveAdminData()) deleteAnnouncement(item.id); }} disabled={!canMutateAdminData}>Delete</button>
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

        {activeAdminTab === 'recycle-bin' && (
          <div className="admin-section">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Deleted At</th>
                    <th>Deleted By</th>
                    <th>Reason</th>
                    <th>Restores</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedDeletedUsers.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="admin-empty-cell">Recycle bin is empty.</td>
                    </tr>
                  ) : (
                    pagedDeletedUsers.map((user, index) => (
                      <tr key={`${user.id || user.dealerCode}-${index}`}>
                        <td>{user.dealerCode || '-'}</td>
                        <td>
                          <div className="admin-recycle-user">
                            <strong>{user.dealerName || '-'}</strong>
                            <span>{user.mobile || user.email || '-'}</span>
                            <span>{user.package || '-'} | {getUserAccountStatus(user)}</span>
                          </div>
                        </td>
                        <td>{formatDisplayDateTime(user.deletedAt)}</td>
                        <td>{user.deletedBy || '-'}</td>
                        <td>{user.deleteReason || '-'}</td>
                        <td>{Number(user.restoreCount || 0)}</td>
                        <td>
                          <div className="admin-actions">
                            <button
                              type="button"
                              onClick={() => {
                                openInputDialog({
                                  title: 'Restore Reason',
                                  message: `Restore ${user.dealerCode || 'this user'} from recycle bin. Reason kya hai?`,
                                  value: '',
                                  submitLabel: 'Restore User',
                                  onSubmit: async (restoreReason) => {
                                    if (!requireLiveAdminData()) return false;
                                    return await restoreDeletedUser(
                                      user,
                                      confirmAdminAction,
                                      deletedUsersBin,
                                      persistDeletedUsersBin,
                                      logAdminActivity,
                                      loadData,
                                      pushToast,
                                      restoreReason,
                                    );
                                  },
                                });
                              }}
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
                                pushToast,
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

        {['pending-registration', 'approval', 'dictionary', 'active-user', 'total-user', 'announcements', 'recycle-bin', 'audit'].includes(activeAdminTab) && adminTotalPages > 1 && (
          <div className="admin-pagination">
            <button className="admin-ghost-btn" onClick={() => setAdminCurrentPage((prev) => Math.max(1, prev - 1))} disabled={adminCurrentPage === 1}>Previous</button>
            <span>Page {adminCurrentPage} of {adminTotalPages}</span>
            <button className="admin-ghost-btn" onClick={() => setAdminCurrentPage((prev) => Math.min(adminTotalPages, prev + 1))} disabled={adminCurrentPage === adminTotalPages}>Next</button>
          </div>
        )}

      </div>
    );
  };

function App() {
  useEffect(() => { clearLegacyRegistrationStorage(); }, []);
  const fileInputRef = useRef(null);
  const translationMemoryCacheRef = useRef(new Map());
  const [translationDictionary, setTranslationDictionary] = useState(() => {
    try {
      const raw = localStorage.getItem('translationDictionaryCache');
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  });
  const [toastItems, setToastItems] = useState([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [savedFilterPresets, setSavedFilterPresets] = useState([]);
  const [userPinVisible, setUserPinVisible] = useState(false);
  const [recentActivities, setRecentActivities] = useState([]);
  const [compactWorkspaceMode, setCompactWorkspaceMode] = useState(false);
  const [reportViewMode, setReportViewMode] = useState('filtered');
  const [announcements, setAnnouncements] = useState(() => {
    try {
      const raw = localStorage.getItem(ANNOUNCEMENTS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [announcementDraft, setAnnouncementDraft] = useState(createDefaultAnnouncementDraft);
  const announcementDraftRef = useRef(announcementDraft);
  const [announcementDraftFormKey, setAnnouncementDraftFormKey] = useState(0);
  const [isUserLoginSubmitting, setIsUserLoginSubmitting] = useState(false);
  const [isAdminLoginSubmitting, setIsAdminLoginSubmitting] = useState(false);
  const adminLoginInFlightRef = useRef(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMainMenu, setShowMainMenu] = useState(false);
  const [showLogoUpdates, setShowLogoUpdates] = useState(false);
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
  const [showCashmemoLayout, setShowCashmemoLayout] = useState(false);
  const [showCashmemoPrintGuide, setShowCashmemoPrintGuide] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);
  const [attendanceOpenSettings, setAttendanceOpenSettings] = useState(false);
  const [showIdCard, setShowIdCard] = useState(false);
  const [showEmployeeProfile, setShowEmployeeProfile] = useState(false);
  const [showEmployeeProfileCreate, setShowEmployeeProfileCreate] = useState(false);
  const [showSalarySlipPage, setShowSalarySlipPage] = useState(false);
  const [salarySlipEmployeeId, setSalarySlipEmployeeId] = useState('');
  const [showAttendanceReportPage, setShowAttendanceReportPage] = useState(false);
  const [showEmployeeReportPage, setShowEmployeeReportPage] = useState(false);
  const [showStockRegister, setShowStockRegister] = useState(false);
  const [showUpgradePlan, setShowUpgradePlan] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showUserLogin, setShowUserLogin] = useState(false);
  const [adminLoginId, setAdminLoginId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [userDealerCode, setUserDealerCode] = useState('');
  const [userPin, setUserPin] = useState('');
  const [userDeviceUserName, setUserDeviceUserName] = useState(readDeviceUserName);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const loginAttemptRef = useRef(0);
  const [dealerWelcome, setDealerWelcome] = useState('');
  const [sampleDataLoaded, setSampleDataLoaded] = useState(false);
  const [sampleDataLoading, setSampleDataLoading] = useState(false);
  const [sampleDataAttempted, setSampleDataAttempted] = useState(false);
  const [adminFlashMessage, setAdminFlashMessage] = useState(null);
  const [showOnboardingTour, setShowOnboardingTour] = useState(false);
  const [onboardingStepIndex, setOnboardingStepIndex] = useState(0);
  const [translationObservability, setTranslationObservability] = useState({
    apiCount: 0,
    dictionaryCount: 0,
    transliterationCount: 0,
    queuedCount: 0,
    lastUpdatedAt: '',
    apiWords: [],
  });
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null, onCancel: null, confirmLabel: 'Confirm', cancelLabel: 'Cancel', previewItems: [], previewTitle: '', previewMoreText: '', dangerNote: '' });
  const [inputDialog, setInputDialog] = useState({ open: false, title: '', message: '', value: '', onSubmit: null, submitLabel: 'Save' });
  const onboardingAutoOpenedRef = useRef(false);
//test the
  const pushToast = useCallback((message, tone = 'info') => {
    if (!message) return;
    const toastId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToastItems((prev) => [...prev, { id: toastId, message, tone }]);
    window.setTimeout(() => {
      setToastItems((prev) => prev.filter((item) => item.id !== toastId));
    }, 3600);
  }, []);

  const openConfirmDialog = useCallback((config = {}) => {
    setConfirmDialog({
      open: true,
      title: config.title || 'Please Confirm',
      message: config.message || '',
      confirmLabel: config.confirmLabel || 'Confirm',
      cancelLabel: config.cancelLabel || 'Cancel',
      onConfirm: typeof config.onConfirm === 'function' ? config.onConfirm : null,
      onCancel: typeof config.onCancel === 'function' ? config.onCancel : null,
      previewItems: Array.isArray(config.previewItems) ? config.previewItems : [],
      previewTitle: config.previewTitle || '',
      previewMoreText: config.previewMoreText || '',
      dangerNote: config.dangerNote || '',
    });
  }, []);

  const closeConfirmDialog = useCallback(() => {
    const callback = confirmDialog.onCancel;
    setConfirmDialog({ open: false, title: '', message: '', onConfirm: null, onCancel: null, confirmLabel: 'Confirm', cancelLabel: 'Cancel', previewItems: [], previewTitle: '', previewMoreText: '', dangerNote: '' });
    if (typeof callback === 'function') {
      callback();
    }
  }, [confirmDialog.onCancel]);

  const resetConfirmDialog = useCallback(() => {
    setConfirmDialog({ open: false, title: '', message: '', onConfirm: null, onCancel: null, confirmLabel: 'Confirm', cancelLabel: 'Cancel', previewItems: [], previewTitle: '', previewMoreText: '', dangerNote: '' });
  }, []);

  const handleConfirmDialogSubmit = useCallback(() => {
    const callback = confirmDialog.onConfirm;
    resetConfirmDialog();
    if (typeof callback === 'function') {
      callback();
    }
  }, [confirmDialog.onConfirm, resetConfirmDialog]);

  const confirmAdminActionWithDialog = useCallback((config) => new Promise((resolve) => {
    const normalizedConfig = typeof config === 'string' ? { message: config } : (config || {});
    openConfirmDialog({
      title: normalizedConfig.title || 'Admin Confirmation',
      message: normalizedConfig.message || 'Continue with this admin action?',
      confirmLabel: normalizedConfig.confirmLabel || 'Confirm',
      previewItems: normalizedConfig.previewItems,
      previewTitle: normalizedConfig.previewTitle,
      previewMoreText: normalizedConfig.previewMoreText,
      dangerNote: normalizedConfig.dangerNote,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    });
  }), [openConfirmDialog]);

  const openInputDialog = useCallback((config = {}) => {
    setInputDialog({
      open: true,
      title: config.title || 'Enter Value',
      message: config.message || '',
      value: config.value || '',
      submitLabel: config.submitLabel || 'Save',
      onSubmit: typeof config.onSubmit === 'function' ? config.onSubmit : null,
    });
  }, []);

  const closeInputDialog = useCallback(() => {
    setInputDialog({ open: false, title: '', message: '', value: '', onSubmit: null, submitLabel: 'Save' });
  }, []);

  const handleInputDialogSubmit = useCallback(() => {
    const callback = inputDialog.onSubmit;
    const value = String(inputDialog.value || '').trim();
    if (!value) {
      pushToast('Please enter a valid value.', 'error');
      return;
    }
    closeInputDialog();
    if (typeof callback === 'function') {
      callback(value);
    }
  }, [closeInputDialog, inputDialog.onSubmit, inputDialog.value, pushToast]);

  const handleReUploadClick = () => {
    if (String(loggedInUser?.dealerCode || '').trim() === '41099999') return;
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const getRecentActivityStorageKey = (dealerCode = '') => (
    `${RECENT_ACTIVITY_STORAGE_KEY_PREFIX}${String(dealerCode || 'guest').trim() || 'guest'}`
  );
  const readRecentActivitiesForDealer = useCallback((dealerCode = '') => {
    try {
      const storageKey = getRecentActivityStorageKey(dealerCode);
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);
  const logRecentActivity = useCallback((message, dealerCodeOverride = '') => {
    if (!message) return;
    const dealerCode = String(dealerCodeOverride || loggedInUser?.dealerCode || 'guest').trim() || 'guest';
    const nextEntry = {
      id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      message,
      createdAt: new Date().toISOString(),
    };
    setRecentActivities((prev) => {
      const next = [nextEntry, ...prev].slice(0, 50);
      try {
        localStorage.setItem(getRecentActivityStorageKey(dealerCode), JSON.stringify(next));
      } catch {
        void 0;
      }
      return next;
    });
  }, [loggedInUser?.dealerCode]);

  // Demo/test user: PIN verification already happened at login, so the
  // dealerCode check alone is sufficient (PIN never stored in runtime state).
  const isTestUser = String(loggedInUser?.dealerCode || '').trim() === '41099999';

  // Support-reply inbox has been retired with the removed feature. Keep
  // neutral empty values for the surrounding menu/dashboard layout.
  const contactReplyItems = [];
  const contactReplyCount = 0;
  const markUserContactRepliesAsRead = () => {};

  const getPendingDictionaryRequestCount = (user) => (
    Array.isArray(user?.pendingDictionaryRequests)
      ? user.pendingDictionaryRequests.filter((req) => String(req?.status || 'pending').toLowerCase() === 'pending').length
      : 0
  );

  const readApprovalRepliesFromStorage = () => {
    try {
      const raw = localStorage.getItem(APPROVAL_REPLIES_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };
  const ADMIN_CONTACTS = {
    email: 'deepak.youvi@gmail.com',
    whatsapp: 'https://wa.me/918789358400',
  };

  const userMenuRef = useRef(null);
  const userMenuButtonRef = useRef(null);
  const firstUserMenuActionRef = useRef(null);
  const mainMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (mainMenuRef.current && !mainMenuRef.current.contains(event.target)) {
        setShowMainMenu(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setShowUserMenu(false);
        setShowMainMenu(false);
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
      firstUserMenuActionRef.current?.focus({ preventScroll: true });
    }
  }, [showUserMenu]);

  useEffect(() => {
    const loadDict = async () => {
      if (!isLoggedIn && !showAdminPanel) return;
      try {
        // Fast path: previously-synced dictionary from localStorage so the app
        // works instantly even when Firestore is unreachable.
        let nextDictionary = {};
        try {
          const cached = localStorage.getItem('translationDictionaryCache');
          const parsed = cached ? JSON.parse(cached) : {};
          if (parsed && typeof parsed === 'object') nextDictionary = parsed;
        } catch {
          // Corrupt cache — ignore and fetch fresh.
        }
        if (Object.keys(nextDictionary).length > 0) {
          setTranslationDictionary(nextDictionary);
        }
        const withTimeout = (promise, ms) => Promise.race([
          promise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout — using cached dictionary')), ms)),
        ]);
        try {
          const docSnap = await withTimeout(getDoc(doc(db, 'settings', 'translationDictionary')), 8000);
          if (docSnap.exists()) {
            nextDictionary = { ...nextDictionary, ...(docSnap.data() || {}) };
          }
        } catch {
          // Backend unreachable — try the persistent Firestore cache before giving up.
          try {
            const cachedSnap = await getDocFromCache(doc(db, 'settings', 'translationDictionary'));
            if (cachedSnap.exists()) {
              nextDictionary = { ...nextDictionary, ...(cachedSnap.data() || {}) };
            }
          } catch {
            // No cached document yet — keep whatever we have (localStorage / empty).
          }
        }
        try {
          const dictRowsSnap = await withTimeout(getDocs(collection(db, 'translationDictionary')), 8000);
          dictRowsSnap.docs.forEach((item) => {
            const data = item.data() || {};
            const englishWord = String(data.englishWord || '').trim();
            const hindiTranslation = String(data.hindiTranslation || '').trim();
            if (englishWord && hindiTranslation) {
              nextDictionary[englishWord] = hindiTranslation;
            }
          });
        } catch {
          // Per-row collection is best-effort; offline cache fallback:
          try {
            const cachedRows = await getDocsFromCache(collection(db, 'translationDictionary'));
            cachedRows.docs.forEach((item) => {
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
        }
        setTranslationDictionary(nextDictionary);
        try {
          localStorage.setItem('translationDictionaryCache', JSON.stringify(nextDictionary));
        } catch {
          // Storage full / private mode — dictionary still works in memory.
        }
      } catch (err) {
        // Offline / flaky network: app keeps running on the cached dictionary
        // instead of spamming the console on every load.
        if (String(err?.code || '') !== 'unavailable' && !/offline|timeout/i.test(String(err?.message || ''))) {
          console.error('Failed to load dictionary', err);
        }
      }
    };
    loadDict();
  }, [isLoggedIn, showAdminPanel]);

  useEffect(() => {
    setHindiRuntimeDictionary(translationDictionary);
  }, [translationDictionary]);

  const persistDictionaryRowsToFirebase = useCallback(async (rows, options = {}) => {
    const entries = buildDictionaryEntriesForSave(rows);
    if (entries.length === 0) {
      if (options.notifyEmpty) {
        pushToast('No valid dictionary rows found. Use columns like English Word and Hindi Translation.', 'error');
      }
      return [];
    }

    const changedEntries = filterChangedDictionaryEntries(translationDictionary, entries);

    if (changedEntries.length === 0) {
      if (options.notifySuccess) {
        pushToast('All dictionary words are already saved in Firebase.', 'info');
      }
      return [];
    }

    const nextDict = mergeDictionaryWithEntries(translationDictionary, changedEntries);
    await setDoc(doc(db, 'settings', 'translationDictionary'), nextDict);
    await Promise.all(changedEntries.map((item) => setDoc(
      doc(db, 'translationDictionary', getDictionaryDocId(item.englishWord)),
      {
        englishWord: item.englishWord,
        hindiTranslation: item.hindiTranslation,
        source: options.source || 'app',
        status: options.status || 'approved',
        autoGenerated: Boolean(options.autoGenerated),
        updatedAt: serverTimestamp(),
        ...(options.metadata || {}),
      },
      { merge: true },
    )));
    setTranslationDictionary(nextDict);

    if (options.notifySuccess) {
      pushToast(`${changedEntries.length} dictionary words saved to Firebase.`, 'success');
    }

    return changedEntries;
  }, [pushToast, translationDictionary]);

  const createDictionaryApprovalRecords = useCallback(async (rows, options = {}) => {
    const entries = buildDictionaryEntriesForSave(rows, { dedupeByPhraseKind: true });
    if (entries.length === 0) return [];

    const normalizedPendingWords = new Set();
    const existingPendingApprovalsByWord = new Map();
    if (options.skipExistingApprovals) {
      try {
        const existingApprovalsSnap = await getDocs(collection(db, 'updateApprovals'));
        existingApprovalsSnap.docs.forEach((approvalDoc) => {
          const data = approvalDoc.data() || {};
          if (String(data.status || 'pending').toLowerCase() !== 'pending') return;
          const approvalType = String(data.type || '').trim().toLowerCase();
          if (!['dictionary', 'dict', 'translationdictionary'].includes(approvalType)) return;
          const englishWord = String(data?.payload?.englishWord || data?.payload?.eng || '').trim().toLowerCase();
          if (englishWord) {
            normalizedPendingWords.add(englishWord);
            existingPendingApprovalsByWord.set(englishWord, {
              id: approvalDoc.id,
              ...data,
            });
          }
        });
      } catch (error) {
        void error;
      }
    }

    const filteredEntries = entries.filter((entry) => {
      const normalizedWord = String(entry.englishWord || '').trim().toLowerCase();
      if (!normalizedWord) return false;
      if (options.skipExistingStored && getExistingDictionaryEntry(translationDictionary, entry.englishWord)) return false;
      if (options.skipExistingApprovals && normalizedPendingWords.has(normalizedWord)) return false;
      return true;
    });

    if (filteredEntries.length === 0) {
      if (!options.skipExistingApprovals) return [];
      return entries
        .map((entry) => {
          const normalizedWord = String(entry.englishWord || '').trim().toLowerCase();
          const existingApproval = existingPendingApprovalsByWord.get(normalizedWord);
          if (!existingApproval) return null;
          return {
            id: existingApproval.id,
            ...existingApproval,
          };
        })
        .filter(Boolean);
    }

    const approvalDocs = await Promise.all(filteredEntries.map((entry, index) => addDoc(collection(db, 'updateApprovals'), {
      userId: options.userId || '',
      dealerCode: options.dealerCode || 'ADMIN-IMPORT',
      dealerName: options.dealerName || 'Admin Bulk Import',
      type: 'dictionary',
      payload: buildDictionaryApprovalPayload(entry, {
        ...options,
        matchedExistingEntry: options.matchedExistingEntry
          || getExistingDictionaryEntry(translationDictionary, entry.englishWord)?.hindiTranslation
          || '',
      }, index),
      status: 'pending',
      requestedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      source: options.source || 'admin-import',
    })));

    const createdApprovals = approvalDocs.map((docRef, index) => ({
      id: docRef.id,
      ...filteredEntries[index],
    }));

    if (!options.skipExistingApprovals) {
      return createdApprovals;
    }

    const reusedApprovals = entries
      .map((entry) => {
        const normalizedWord = String(entry.englishWord || '').trim().toLowerCase();
        const existingApproval = existingPendingApprovalsByWord.get(normalizedWord);
        if (!existingApproval) return null;
        return {
          id: existingApproval.id,
          ...existingApproval,
        };
      })
      .filter(Boolean);

    const mergedApprovals = new Map();
    [...createdApprovals, ...reusedApprovals].forEach((approval) => {
      mergedApprovals.set(String(approval.id || ''), approval);
    });

    return Array.from(mergedApprovals.values());
  }, [translationDictionary]);

  // users cache & session persistence now live in src/services/storage.js

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
    const safeNextUser = sanitizeUserForCache(nextUser);
    setLoggedInUser((prev) => {
      if (!prev) return prev;
      if (prev?.id === userId) return safeNextUser;
      if (dealerCode && String(prev?.dealerCode || '').trim() === String(dealerCode).trim()) return safeNextUser;
      return prev;
    });
    return nextUser;
  };

  const updateUserInFirebase = async (userId, patch, dealerCode = '') => {
    const payload = { ...patch, updatedAt: serverTimestamp() };

    if (userId) {
      try {
        await updateUserData(userId, payload);
        return userId;
      } catch (e) { void e; }
    }

    if (dealerCode) {
      const snap = await getDocs(query(collection(db, 'users'), where('dealerCode', '==', String(dealerCode).trim())));
      if (!snap.empty) {
        const resolvedId = snap.docs[0].id;
        await updateUserData(resolvedId, payload);
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
      const batch = writeBatch(db);

        const approvalsSnap = await getDocs(query(collection(db, 'updateApprovals'), where('userId', '==', loggedInUser.id)));
        const existingPending = approvalsSnap.docs.find((d) => d.data()?.type === type && d.data()?.status === 'pending');
        if (existingPending) {
          batch.update(doc(db, 'updateApprovals', existingPending.id), {
            payload,
            dealerCode: loggedInUser.dealerCode || '',
            dealerName: loggedInUser.dealerName || '',
            status: 'pending',
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(doc(collection(db, 'updateApprovals')), {
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
    const pendingUpdatePatch = {
      [`pendingUpdates.${type}`]: {
        status: 'pending',
        payload,
        requestedAt: new Date().toISOString(),
        adminReply: '',
        adminReplyAt: '',
      },
      lastApprovalStorage: 'collection',
    };
      batch.update(doc(db, 'users', loggedInUser.id), { ...pendingUpdatePatch, updatedAt: serverTimestamp() });
      await batch.commit();
      const resolvedId = loggedInUser.id;
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
    } catch (error) {
      const errorCode = String(error?.code || 'unknown').replace('firestore/', '');
      console.error('Update approval request failed:', error);
      pushToast(`Request submit failed (${errorCode}). Please try again.`, 'error');
      return false;
    }
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
    const loginAttempt = ++loginAttemptRef.current;
    let firestoreUser = null;
    let dealerLookupStatus = 'not-found';
    try {
      const lookup = await lookupDealerByCode(dealerCode, pin);
      dealerLookupStatus = lookup.dealerLookupStatus || 'not-found';
      if (lookup.outcome === 'duplicate') {
        pushToast('Is dealer code par multiple accounts mil rahe hain. Login block kiya gaya hai, admin se contact kijiye.', 'error');
        setIsUserLoginSubmitting(false);
        return;
      }
      if (lookup.outcome === 'ok') {
        firestoreUser = lookup.firestoreUser;
      }
    } catch (loginError) {
      const reason = loginError instanceof Error ? loginError.message : '';
      pushToast(
        loginError?.code === 'rate-limited' || reason === 'login-rate-limited'
          ? 'Bahut zyada login attempts. Kuch minute baad dobara koshish karein.'
          : loginError?.code === 'server-not-configured' || reason === 'login-not-configured'
            ? 'Login service server par configure nahi hai. Admin se contact kijiye.'
            // Server returned a specific, actionable setup error — show it.
            : reason && !reason.startsWith('login-')
              ? reason
              : 'Firebase login check failed. Please try again.',
        'error',
      );
      setIsUserLoginSubmitting(false);
      return;
    }
//Ok
    if (!firestoreUser) {
      if (dealerLookupStatus === 'pending') {
        pushToast('Aapka account admin approval ke liye pending hai.', 'info');
      } else if (dealerLookupStatus === 'disabled') {
        pushToast('Aapka account disabled hai. Admin se contact kijiye.', 'error');
      } else if (dealerLookupStatus === 'dealer-found') {
        pushToast('Dealer Code mil gaya, lekin PIN sahi nahi hai.', 'error');
      } else {
        pushToast('Dealer Code ya PIN sahi nahi hai. Please check and try again.', 'error');
      }
      setIsUserLoginSubmitting(false);
      return;
    }

    const deviceResult = await registerLoginDevice(firestoreUser, { deferSave: true, deviceUserName: userDeviceUserName });
    if (deviceResult.outcome === 'blocked') {
      pushToast('Is device par login blocked hai. Admin se unblock karwaiye.', 'error');
      setIsUserLoginSubmitting(false);
      return;
    }
    if (deviceResult.outcome === 'save-failed') {
      pushToast('Login device could not be saved to Firestore. Device history was not updated.', 'warning');
    }

    if (getUserAccountStatus(firestoreUser) === 'pending') {
      pushToast('Your registration is pending with admin approval.', 'info');
      setIsUserLoginSubmitting(false);
      return;
    }

    if (getUserAccountStatus(firestoreUser) === 'disabled') {
      pushToast('Your account is disabled. Please contact admin.', 'error');
      setIsUserLoginSubmitting(false);
      return;
    }

    const expiryResult = await markUserExpiredIfDue(firestoreUser);
    if (!expiryResult.ok) {
      pushToast('Expiry status could not be saved to Firestore. Please retry. Plan validity still applies.', 'warning');
    }

    const localUser = mergeDealerIntoCache(firestoreUser);

    const userLabelSettings = mergeDealerLabelSettings(
      { ...firestoreUser, cashMemoLabelSettings: localUser.cashMemoLabelSettings },
      setCashMemoLabelSettings,
    );
    localUser.cashMemoLabelSettings = userLabelSettings;
    setLabelDraftSettings(mergeCashMemoLabelSettings(userLabelSettings));
    setLoggedInUser(localUser);
    setIsLoggedIn(true);
    setSampleDataLoaded(false);
    setSampleDataLoading(false);
    setSampleDataAttempted(false);
    persistUserSession(localUser);
    setShowUserLogin(false);
    setShowHomeInfo(true);
    setUserDealerCode('');
    setUserPin('');
    setUserPinVisible(false);
    if (getUserAccountStatus(localUser) === 'expired') {
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
    if (deviceResult.outcome === 'ready') {
      const signedInUser = auth.currentUser;
      void deviceResult.save().then((result) => {
        if (auth.currentUser !== signedInUser || loginAttemptRef.current !== loginAttempt) return;
        if (result.outcome === 'save-failed') {
          pushToast('Login device could not be saved to Firestore. Device history was not updated.', 'warning');
        } else if (result.outcome === 'ok') {
          rememberDeviceUserName(userDeviceUserName);
          setLoggedInUser((current) => current?.id === localUser.id
            ? { ...current, loginDevices: result.loginDevices } : current);
        }
      }).catch(() => {
        if (auth.currentUser === signedInUser && loginAttemptRef.current === loginAttempt) {
          pushToast('Login device history could not be saved.', 'warning');
        }
      });
    }
  };

  const handleLogout = () => {
    loginAttemptRef.current += 1;
    hideAllViews();
    clearUserSession();
    onboardingAutoOpenedRef.current = false;
    setShowOnboardingTour(false);
    setOnboardingStepIndex(0);
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
    openConfirmDialog({
      title: 'Log Out',
      message: 'Are you sure you want to log out from this account?',
      confirmLabel: 'Log Out',
      onConfirm: handleLogout,
    });
  };

  const hideAllViews = () => {
    setShowHomeInfo(false);
    setShowAboutInfo(false);
    setShowInvoicePage(false);
    setShowLabelUpdate(false);
    setShowHeaderUpdate(false);
    setShowCashmemoLayout(false);
    setShowCashmemoPrintGuide(false);
    setShowAttendance(false);
    setShowIdCard(false);
    setShowEmployeeProfile(false);
    setShowEmployeeProfileCreate(false);
    setShowSalarySlipPage(false);
    setSalarySlipEmployeeId('');
    setShowAttendanceReportPage(false);
    setShowEmployeeReportPage(false);
    setShowStockRegister(false);
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
  const handleCashmemoLayoutOpen = () => {
    hideAllViews();
    setShowCashmemoLayout(true);
    setShowUserMenu(false);
  };
  const handleCashmemoPrintGuideOpen = () => {
    hideAllViews();
    setShowCashmemoPrintGuide(true);
    setShowUserMenu(false);
  };
  const handleAttendanceOpen = () => {
    hideAllViews();
    setAttendanceOpenSettings(false);
    setShowAttendance(true);
    setShowUserMenu(false);
  };
  const handleAttendanceSettingsOpen = () => {
    hideAllViews();
    setAttendanceOpenSettings(true);
    setShowAttendance(true);
    setShowUserMenu(false);
  };
  const handleStockRegisterOpen = () => {
    hideAllViews();
    setShowStockRegister(true);
    setShowUserMenu(false);
  };
  const handleIdCardOpen = () => {
    hideAllViews();
    setShowIdCard(true);
    setShowUserMenu(false);
  };
  const handleIdCardClose = () => {
    hideAllViews();
    setShowAttendance(true);
  };
  const handleEmployeeProfileOpen = () => {
    hideAllViews();
    setShowEmployeeProfile(true);
    setShowEmployeeProfileCreate(false);
    setShowUserMenu(false);
  };
  const handleEmployeeAddOpen = () => {
    hideAllViews();
    setShowEmployeeProfile(true);
    setShowEmployeeProfileCreate(true);
    setShowUserMenu(false);
  };
  const handleEmployeeProfileClose = () => {
    hideAllViews();
    setShowAttendance(true);
  };
  const handleSalarySlipOpen = () => {
    hideAllViews();
    setSalarySlipEmployeeId('');
    setShowSalarySlipPage(true);
    setShowUserMenu(false);
  };
  const handleSalarySlipForEmployee = (employeeId) => {
    hideAllViews();
    setSalarySlipEmployeeId(employeeId || '');
    setShowSalarySlipPage(true);
    setShowUserMenu(false);
  };
  const handleSalarySlipClose = () => {
    hideAllViews();
    setSalarySlipEmployeeId('');
    setShowAttendance(true);
  };
  const handleAttendanceReportOpen = () => {
    hideAllViews();
    setShowAttendanceReportPage(true);
    setShowUserMenu(false);
  };
  const handleAttendanceReportClose = () => {
    hideAllViews();
    setShowAttendance(true);
  };
  const handleEmployeeReportOpen = () => {
    hideAllViews();
    setShowEmployeeReportPage(true);
    setShowUserMenu(false);
  };
  const handleEmployeeReportClose = () => {
    hideAllViews();
    setShowAttendance(true);
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
          status: getUserAccountStatus(matchedUser),
          cashMemoLabelSettings: mergeCashMemoLabelSettings(matchedUser.cashMemoLabelSettings || {}),
          deliveryAreaUpdates: Array.isArray(matchedUser.deliveryAreaUpdates) ? matchedUser.deliveryAreaUpdates : [],
          deliveryStaffUpdates: Array.isArray(matchedUser.deliveryStaffUpdates) ? matchedUser.deliveryStaffUpdates : [],
        };

      setLoggedInUser(sanitizeUserForCache(restoredUser));
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

  useEffect(() => {
    if (!isLoggedIn || !loggedInUser || onboardingAutoOpenedRef.current) return;
    const onboardingUserKey = String(
      loggedInUser?.dealerCode
      || loggedInUser?.profileData?.distributorCode
      || loggedInUser?.id
      || 'guest'
    ).trim();
    try {
      const raw = localStorage.getItem(getOnboardingTourStorageKey(onboardingUserKey));
      if (raw) {
        onboardingAutoOpenedRef.current = true;
        return;
      }
    } catch {
      void 0;
    }
    onboardingAutoOpenedRef.current = true;
    setOnboardingStepIndex(0);
    setShowOnboardingTour(true);
  }, [isLoggedIn, loggedInUser]);

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
    openConfirmDialog({
      title: 'Admin Access',
      message: 'Are you admin?, if Yes then login',
      confirmLabel: 'Yes, Login as Admin',
      cancelLabel: 'No, Go to User Login',
      onConfirm: () => {
        hideAllViews();
        setShowAdminLogin(true);
        setShowUserMenu(false);
      },
      onCancel: handleLogin,
    });
  };

  const onboardingSteps = [
    {
      id: 'upload',
      title: 'Upload Data',
      description: 'Yahin se aap cDCMS ka latest Pending Booking file upload karke kaam start karte ho.',
      hint: 'CSV ya XLSX upload ke baad filters, print aur quick profile sab active ho jaate hain.',
      actionLabel: 'Open Data Upload',
      action: () => {
        if (!showParsedData) {
          handleShowData();
        }
      },
    },
    {
      id: 'invoice',
      title: 'Invoice Page',
      description: 'Invoice page par customer invoice bana, save, aur duplicate karke fast billing kar sakte ho.',
      hint: 'Quick profile se bhi invoice directly open ho sakta hai.',
      actionLabel: 'Open Invoice',
      action: handleInvoiceOpen,
    },
    {
      id: 'support',
      title: 'Approval Reply & Support',
      description: 'Yahan admin replies, support messages, aur pending follow-up dekh sakte ho.',
      hint: 'Agar upload ya plan me issue aaye to sabse pehle isi section ko check karo.',
      actionLabel: 'Open Support',
      action: handleContactOpen,
    },
    {
      id: 'dictionary',
      title: 'Dictionary & Delivery Updates',
      description: 'Dictionary, delivery area, aur delivery staff requests isi flow se manage hote hain.',
      hint: 'Hindi print aur local naming consistency ke liye ye section important hai.',
      actionLabel: 'Open Dictionary',
      action: handleDictionaryOpen,
    },
  ];

  const activeOnboardingStep = onboardingSteps[onboardingStepIndex] || onboardingSteps[0];

  const markOnboardingTourSeen = useCallback((dealerCode = '') => {
    try {
      localStorage.setItem(getOnboardingTourStorageKey(dealerCode), JSON.stringify({
        completedAt: new Date().toISOString(),
      }));
    } catch {
      void 0;
    }
  }, []);

  const openOnboardingTour = useCallback((stepIndex = 0) => {
    setOnboardingStepIndex(Math.max(0, Math.min(stepIndex, onboardingSteps.length - 1)));
    setShowOnboardingTour(true);
  }, [onboardingSteps.length]);

  const closeOnboardingTour = useCallback((markSeen = true) => {
    if (markSeen) {
      const onboardingUserKey = String(
        loggedInUser?.dealerCode
        || loggedInUser?.profileData?.distributorCode
        || loggedInUser?.id
        || 'guest'
      ).trim();
      markOnboardingTourSeen(onboardingUserKey);
    }
    setShowOnboardingTour(false);
  }, [loggedInUser, markOnboardingTourSeen]);

  const handleOnboardingNext = useCallback(() => {
    setOnboardingStepIndex((prev) => {
      if (prev >= onboardingSteps.length - 1) {
        closeOnboardingTour(true);
        return prev;
      }
      return prev + 1;
    });
  }, [closeOnboardingTour, onboardingSteps.length]);

  const handleOnboardingBack = useCallback(() => {
    setOnboardingStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleOnboardingAction = useCallback(() => {
    activeOnboardingStep?.action?.();
  }, [activeOnboardingStep]);

  const handleAdminLogout = async () => {
    try {
      await adminSignOut();
    } catch (e) { void e; }
    hideAllViews();
    setShowAboutInfo(true);
    setAdminLoginId('');
    setAdminPassword('');
    pushToast('Admin logged out successfully!', 'success');
  };

  const handleAdminLoginSubmit = async () => {
    if (isAdminLoginSubmitting || adminLoginInFlightRef.current) return;
    const { loginId, password, valid } = validateAdminCredentials(adminLoginId, adminPassword);
    if (!valid) {
      pushToast('Admin Email and Password required.', 'error');
      return;
    }
    adminLoginInFlightRef.current = true;
    setIsAdminLoginSubmitting(true);
    try {
      await adminSignIn(loginId, password);
      setShowAdminLogin(false);
      setShowAdminPanel(true);
      setAdminLoginId('');
      setAdminPassword('');
      pushToast('Admin login successful.', 'success');
    } catch (error) {
      pushToast(error?.code === 'auth/network-request-failed'
        ? 'Firebase se connection nahi ho pa raha. Internet/DNS check karein ya mobile hotspot se dobara login karein.'
        : error?.code === 'auth/admin-role-required'
          ? error.message
          : 'Admin login failed. Check Firebase Authentication credentials.', 'error');
    } finally {
      adminLoginInFlightRef.current = false;
      setIsAdminLoginSubmitting(false);
    }
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
  const [cashmemoLayoutPageType, setCashmemoLayoutPageType] = useState('3 Cashmemo/Page');
  const [cashmemoLayoutLanguage, setCashmemoLayoutLanguage] = useState('English');
  const [cashmemoLayoutPageSize, setCashmemoLayoutPageSize] = useState('A4');
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
    setItemsPerPage,
    pageType,
    setPageType,
    printHeaderMode,
    setPrintHeaderMode,
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

  const persistAnnouncements = useCallback((nextAnnouncements) => {
    setAnnouncements(nextAnnouncements);
    localStorage.setItem(ANNOUNCEMENTS_STORAGE_KEY, JSON.stringify(nextAnnouncements));
  }, []);

  const handleCreateAnnouncement = useCallback(() => {
    const currentDraft = announcementDraftRef.current || createDefaultAnnouncementDraft();
    const title = String(currentDraft.title || '').trim();
    const message = String(currentDraft.message || '').trim();
    if (!title || !message) {
      pushToast('Announcement title aur message required hai.', 'error');
      return;
    }
    const nextAnnouncement = {
      id: `announcement-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      message,
      targetScope: currentDraft.targetScope || 'all',
      noticeType: currentDraft.noticeType || 'notice',
      expiresAt: currentDraft.expiresAt || '',
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: String(auth?.currentUser?.email || 'admin').trim().toLowerCase() || 'admin',
    };
    persistAnnouncements([nextAnnouncement, ...announcements]);
    const nextDraft = createDefaultAnnouncementDraft();
    announcementDraftRef.current = nextDraft;
    setAnnouncementDraft(nextDraft);
    setAnnouncementDraftFormKey((prev) => prev + 1);
    pushToast('Announcement created successfully.', 'success');
  }, [announcements, persistAnnouncements, pushToast]);

  const toggleAnnouncementStatus = useCallback((announcementId) => {
    const nextAnnouncements = announcements.map((item) => (
      item.id === announcementId ? { ...item, active: !item.active } : item
    ));
    persistAnnouncements(nextAnnouncements);
  }, [announcements, persistAnnouncements]);

  const deleteAnnouncement = useCallback((announcementId) => {
    const nextAnnouncements = announcements.filter((item) => item.id !== announcementId);
    persistAnnouncements(nextAnnouncements);
  }, [announcements, persistAnnouncements]);

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
    if (!loggedInUser) {
      setCompactWorkspaceMode(false);
      return;
    }
    try {
      const workspaceUserKey = String(
        loggedInUser?.dealerCode
        || loggedInUser?.profileData?.distributorCode
        || loggedInUser?.id
        || 'guest'
      ).trim();
      const raw = localStorage.getItem(getWorkspaceModeStorageKey(workspaceUserKey));
      setCompactWorkspaceMode(raw === 'compact');
    } catch {
      setCompactWorkspaceMode(false);
    }
  }, [loggedInUser]);

  useEffect(() => {
    if (!loggedInUser) return;
    try {
      const workspaceUserKey = String(
        loggedInUser?.dealerCode
        || loggedInUser?.profileData?.distributorCode
        || loggedInUser?.id
        || 'guest'
      ).trim();
      localStorage.setItem(getWorkspaceModeStorageKey(workspaceUserKey), compactWorkspaceMode ? 'compact' : 'default');
    } catch {
      void 0;
    }
  }, [compactWorkspaceMode, loggedInUser]);

  useEffect(() => {
    if (!uploadMetadata?.uploadedAt) return;
    logRecentActivity(
      `Uploaded ${uploadMetadata.fileName} with ${uploadMetadata.totalRows} rows`,
      loggedInUser?.dealerCode,
    );
  }, [
    logRecentActivity,
    loggedInUser?.dealerCode,
    uploadMetadata?.fileName,
    uploadMetadata?.totalRows,
    uploadMetadata?.uploadedAt,
  ]);

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

  const handleToggleCompactWorkspaceMode = () => {
    setCompactWorkspaceMode((prev) => !prev);
  };

  const confirmLargeBulkAction = useCallback((label, count, onConfirm) => {
    const safeCount = Number(count || 0);
    if (safeCount <= 50) {
      onConfirm();
      return;
    }

    openConfirmDialog({
      title: 'Confirm Bulk Action',
      message: `You are ${label} ${safeCount} records. Continue?`,
      confirmLabel: 'Continue',
      onConfirm,
    });
  }, [openConfirmDialog]);

  const exportRowsToCsvFile = (filename, rows, exportHeaders = visibleHeaders) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      pushToast('No data available to export.', 'info');
      return;
    }

    confirmLargeBulkAction('exporting', rows.length, () => {
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
    });
  };

  const getActiveFilterFilenamePart = () => {
    if (activeReportFilter) return sanitizeFilenamePart(activeReportFilter);
    if (hasMultiValueFilterSelection(eKycFilter)) return `ekyc-${sanitizeFilenamePart(getMultiValueFilterValues(eKycFilter).join('-'))}`;
    if (onlineRefillPaymentStatusFilter !== 'All') return `payment-${sanitizeFilenamePart(onlineRefillPaymentStatusFilter)}`;
    if (hasMultiValueFilterSelection(areaFilter)) return `area-${sanitizeFilenamePart(getMultiValueFilterValues(areaFilter).join('-'))}`;
    if (orderTypeFilter !== 'All') return `order-${sanitizeFilenamePart(orderTypeFilter)}`;
    if (searchTerm) return `search-${sanitizeFilenamePart(searchTerm)}`;
    return hasActiveDataFilters ? 'filtered' : 'all';
  };

  const buildExportFilename = (prefix) => {
    const today = new Date().toLocaleDateString('en-CA');
    return `${sanitizeFilenamePart(prefix)}-${getActiveFilterFilenamePart()}-${today}.csv`;
  };

  const getExportHeaders = (mode = 'visible') => {
    if (mode !== 'business') return visibleHeaders;
    const matchedHeaders = DEFAULT_EXPORT_HEADERS.filter((header) => headers.includes(header));
    return matchedHeaders.length > 0 ? matchedHeaders : visibleHeaders;
  };

  const exportSelectedBusinessRows = () => {
    exportRowsToCsvFile(
      buildExportFilename('selected-business'),
      selectedFilteredRows,
      getExportHeaders('business'),
    );
  };

  const exportFilteredRows = () => {
    exportRowsToCsvFile(
      buildExportFilename('filtered-cashmemo'),
      filteredData,
      visibleHeaders,
    );
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
    setEKycFilter(normalizeMultiValueFilter(preset.eKycFilter));
    setAreaFilter(normalizeMultiValueFilter(preset.areaFilter));
    setNatureFilter(normalizeMultiValueFilter(preset.natureFilter));
    setMobileStatusFilter(String(preset.mobileStatusFilter || 'All'));
    setConsumerStatusFilter(normalizeMultiValueFilter(preset.consumerStatusFilter));
    setConnectionTypeFilter(normalizeMultiValueFilter(preset.connectionTypeFilter));
    setOnlineRefillPaymentStatusFilter(String(preset.onlineRefillPaymentStatusFilter || 'All'));
    setOrderStatusFilter(String(preset.orderStatusFilter || 'All'));
    setOrderSourceFilter(normalizeMultiValueFilter(preset.orderSourceFilter));
    setOrderTypeFilter(String(preset.orderTypeFilter || 'All'));
    setCashMemoStatusFilter(String(preset.cashMemoStatusFilter || 'All'));
    setDeliveryManFilter(normalizeMultiValueFilter(preset.deliveryManFilter));
    setIsRegMobileFilter(String(preset.isRegMobileFilter || 'All'));
    setOrderDateStart(String(preset.orderDateStart || ''));
    setOrderDateEnd(String(preset.orderDateEnd || ''));
    setCashMemoDateStart(String(preset.cashMemoDateStart || ''));
    setCashMemoDateEnd(String(preset.cashMemoDateEnd || ''));
    setSortBy(String(preset.sortBy || 'Delivery Area'));
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
    openInputDialog({
      title: 'Save Filter Preset',
      message: 'Preset ka naam dijiye. Ye current filters ko future use ke liye save karega.',
      value: '',
      submitLabel: 'Save Preset',
      onSubmit: (presetName) => {
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
      },
    });
  };

  const handleDeletePreset = (presetId) => {
    const nextPresets = savedFilterPresets.filter((preset) => preset.id !== presetId);
    persistFilterPresets(nextPresets);
    pushToast('Preset removed.', 'info');
  };

  const buildDealerDetails = (isHindiPrint = false) => {
    const pd = loggedInUser?.profileData || null;
    const hd = loggedInUser?.hindiHeaderData || null;
    const baseDealerName = pd?.distributorName
      ? (pd?.distributorCode ? `${pd.distributorName} (${pd.distributorCode})` : pd.distributorName)
      : '-';

    return {
      name: (isHindiPrint && hd?.distributorName) ? hd.distributorName : (baseDealerName !== '-' ? baseDealerName : (hd?.distributorName || '-')),
      gstn: (isHindiPrint && hd?.gstn) ? hd.gstn : (pd?.gst || hd?.gstn || '-'),
      address: { plotNo: (isHindiPrint && hd?.address) ? hd.address : (pd?.address || hd?.address || '-') },
      contact: {
        email: (isHindiPrint && hd?.email) ? hd.email : (pd?.email || hd?.email || '-'),
        telephone: (isHindiPrint && hd?.telephone) ? hd.telephone : (pd?.contact || hd?.telephone || '-'),
      },
    };
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
  const handlePrintCashmemoLayout = async () => {
    const [{ renderToString }] = await Promise.all([
      import('react-dom/server'),
    ]);
    const isHindiLayout = cashmemoLayoutLanguage === 'Hindi';
    const dealerDetails = buildDealerDetails(isHindiLayout);
    const memosPerPage = getCashMemoPerPage(cashmemoLayoutPageType);
    const previewMarkup = Array.from({ length: memosPerPage }).map((_, index) => (
      `<div class="cashmemo-print-item cashmemo-print-item--${memosPerPage}" data-index="${index}">${renderToString(
        <CashmemoHeaderPreviewSheet
          pageType={cashmemoLayoutPageType}
          dealerDetails={dealerDetails}
          language={cashmemoLayoutLanguage}
        />
      )}</div>`
    )).join('');
    const layoutPrintStyles = getLayoutPrintStyles(cashmemoLayoutPageSize);
    const fullHtml = `
      <html>
        <head>
          <title>Cashmemo Header Layout</title>
          <style>
            ${layoutPrintStyles}
          </style>
        </head>
        <body>
          <div id="print-root">
            ${previewMarkup}
          </div>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      pushToast('Unable to open print window. Please allow pop-ups.', 'error');
      return;
    }
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
    logRecentActivity(`Printed cashmemo header layout (${cashmemoLayoutPageSize} - ${cashmemoLayoutPageType} - ${cashmemoLayoutLanguage})`);
  };
  const handlePrintCashmemo = async ({ skipBulkConfirm = false } = {}) => {
      if (selectedCustomerIds.length === 0) {
        pushToast('Please select at least one cashmemo to print.', 'info');
        return;
      }

      if (!skipBulkConfirm && selectedCustomerIds.length > 50) {
        confirmLargeBulkAction('printing', selectedCustomerIds.length, () => {
          void handlePrintCashmemo({ skipBulkConfirm: true });
        });
        return;
      }

      const isHindiPrint = printLanguage === 'Hindi';
      const shouldShowHeader = printHeaderMode === 'With Header';
      const translationMemoryCache = translationMemoryCacheRef.current;
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
        pushToast('Preparing translations, please wait...', 'info');
        const wordsToTranslate = new Set();
        const apiSuggestedDictionaryMap = new Map();
        const translationCounters = {
          apiCount: 0,
          dictionaryCount: 0,
          transliterationCount: 0,
        };

        const rememberApiSuggestion = (englishWord, hindiTranslation, metadata = {}) => {
          const normalizedEnglishWord = String(englishWord || '').trim();
          const normalizedHindiTranslation = String(hindiTranslation || '').trim();
          if (!normalizedEnglishWord || !normalizedHindiTranslation) return;
          const phraseKind = metadata.phraseKind || 'token';
          const dedupeKey = `${phraseKind}:${normalizedEnglishWord.toLowerCase()}`;
          apiSuggestedDictionaryMap.set(dedupeKey, {
            englishWord: normalizedEnglishWord,
            hindiTranslation: normalizedHindiTranslation,
            phraseKind,
            requestSource: 'api',
            queueLabel: 'API Request Dictionary',
            requestedFrom: metadata.requestedFrom || 'Hindi Cashmemo Print',
          });
        };

        customersToPrint.forEach((customer) => {
          const processField = (text, options = {}) => {
            if (!text) return;
            const fullLower = String(text).toLowerCase().trim();
            if (getDictionaryTranslation(translationDictionary, fullLower)) {
              translationCounters.dictionaryCount += 1;
              return;
            }
            if (translationMemoryCache.has(fullLower)) {
              translationCounters.apiCount += 1;
              rememberApiSuggestion(text, translationMemoryCache.get(fullLower), { phraseKind: 'phrase' });
              return;
            }
            if (!options.allowApi) {
              return;
            }

            const tokens = String(text).split(/(\s+|,|\/|-|\(|\))/);
            tokens.forEach(token => {
              if (!token || /^(\s+|,|\/|-|\(|\))$/.test(token) || /^\d+$/.test(token)) return;
              const lowerToken = token.toLowerCase();
              if (getDictionaryTranslation(translationDictionary, lowerToken)) {
                translationCounters.dictionaryCount += 1;
                return;
              }
              if (translationMemoryCache.has(lowerToken)) {
                translationCounters.apiCount += 1;
                rememberApiSuggestion(token, translationMemoryCache.get(lowerToken), { phraseKind: 'token' });
                return;
              }
              if (!translationMemoryCache.has(lowerToken)) {
                wordsToTranslate.add(token);
              }
            });
          };

          processField(customer['Consumer Name'], { allowApi: true });
          processField(customer['Address'], { allowApi: true });
          processField(customer['Delivery Area'], { allowApi: false });
          processField(customer['Delivery Man'], { allowApi: false });
        });

        if (wordsToTranslate.size > 0) {
          const uniqueWords = Array.from(wordsToTranslate);
          const chunkSize = 100;
          for (let i = 0; i < uniqueWords.length; i += chunkSize) {
            const chunk = uniqueWords.slice(i, i + chunkSize);
            const textToTranslate = chunk.join('\n');
            try {
              const response = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: textToTranslate,
                  source: 'en',
                  target: 'hi',
                  format: 'text'
                })
              });

              if (response.ok) {
                const data = await response.json();
                const translatedTextArray = (data.translatedText || '').split('\n');
                if (translatedTextArray.length === chunk.length) {
                  chunk.forEach((word, idx) => {
                    const hindiTranslation = translatedTextArray[idx].trim();
                    if (!hindiTranslation) return;
                    translationMemoryCache.set(word.toLowerCase(), hindiTranslation);
                    translationCounters.apiCount += 1;
                    rememberApiSuggestion(word, hindiTranslation, { phraseKind: 'token' });
                  });
                }
              }
            } catch (error) {
              console.error("Translation API failed:", error);
            }
          }
        }

        const runtimeDictionary = mergeDictionaryWithEntries(translationDictionary, [
          ...Array.from(translationMemoryCache.entries()).map(([englishWord, hindiTranslation]) => ({
            englishWord,
            hindiTranslation,
          })),
        ]);
        setHindiRuntimeDictionary(runtimeDictionary);

        const translateString = (fieldName, text, options = {}) => {
          if (!text) return { text: '', usedApiSuggestion: false };
          const fullLower = String(text).toLowerCase().trim();
          const directMatch = getDictionaryTranslation(runtimeDictionary, fullLower);
          if (directMatch && directMatch.toLowerCase() !== fullLower) {
            return { text: directMatch, usedApiSuggestion: false };
          }
          if (translationMemoryCache.has(fullLower)) {
            const cachedMatch = translationMemoryCache.get(fullLower);
            if (cachedMatch && cachedMatch.toLowerCase() !== fullLower) {
              translationCounters.apiCount += 1;
              return { text: cachedMatch, usedApiSuggestion: true };
            }
          }
          if (!options.allowApi) {
            return { text: String(text), usedApiSuggestion: false };
          }

          const tokens = String(text).split(/(\s+|,|\/|-|\(|\))/);
          let usedApiSuggestion = false;
          const translatedText = tokens.map(token => {
            if (!token || /^(\s+|,|\/|-|\(|\))$/.test(token) || /^\d+$/.test(token)) return token;
            const lowerToken = token.toLowerCase();
            const dictionaryValue = getDictionaryTranslation(runtimeDictionary, lowerToken);
            if (dictionaryValue && dictionaryValue.toLowerCase() !== lowerToken) {
              return dictionaryValue;
            }
            if (translationMemoryCache.has(lowerToken)) {
              const cachedValue = translationMemoryCache.get(lowerToken);
              if (cachedValue && cachedValue.toLowerCase() !== lowerToken) {
                usedApiSuggestion = true;
                translationCounters.apiCount += 1;
                return cachedValue;
              }
            }
            translationCounters.transliterationCount += 1;
            return getHindiValue(fieldName, token);
          }).join('');

          if (/[A-Za-z]/.test(translatedText)) {
            translationCounters.transliterationCount += 1;
            return { text: getHindiValue(fieldName, text), usedApiSuggestion };
          }

          return { text: translatedText, usedApiSuggestion };
        };

        customersToPrint = customersToPrint.map((customer) => {
          const translatedCustomer = { ...customer };
          const consumerNameResult = translateString('Consumer Name', customer['Consumer Name'] || '', { allowApi: true });
          const addressResult = translateString('Address', customer['Address'] || '', { allowApi: true });
          const deliveryAreaResult = translateString('Delivery Area', customer['Delivery Area'] || '', { allowApi: false });
          const deliveryManResult = translateString('Delivery Man', customer['Delivery Man'] || '', { allowApi: false });

          translatedCustomer['Consumer Name Hindi'] = consumerNameResult.text;
          translatedCustomer['Address Hindi'] = addressResult.text;
          translatedCustomer['Delivery Area'] = deliveryAreaResult.text;
          translatedCustomer['Delivery Man'] = deliveryManResult.text;

          if (consumerNameResult.usedApiSuggestion) {
            rememberApiSuggestion(customer['Consumer Name'] || '', consumerNameResult.text, { phraseKind: 'phrase' });
          }
          if (addressResult.usedApiSuggestion) {
            rememberApiSuggestion(customer['Address'] || '', addressResult.text, { phraseKind: 'phrase' });
          }
          return translatedCustomer;
        });

        const queuedApiDictionaryRows = await createDictionaryApprovalRecords(Array.from(apiSuggestedDictionaryMap.values()), {
          dealerCode: loggedInUser?.dealerCode || 'PRINT-API',
          dealerName: loggedInUser?.dealerName || 'Hindi Print',
          source: 'api-print',
          requestSource: 'api',
          queueLabel: 'API Request Dictionary',
          requestedFrom: 'Hindi Cashmemo Print',
          importMode: 'api-request',
          clientRequestIdPrefix: `api-print-${Date.now()}`,
          skipExistingStored: true,
          skipExistingApprovals: true,
        });
        if (queuedApiDictionaryRows.length > 0) {
          pushToast(`${queuedApiDictionaryRows.length} API translations admin review ke liye API Request Dictionary me bhej di gayi hain.`, 'info');
        }
        const apiWordPreviewRows = (
          queuedApiDictionaryRows.length > 0
            ? queuedApiDictionaryRows
            : Array.from(apiSuggestedDictionaryMap.values())
        )
          .map((entry) => getApiDictionaryPreviewEntry(entry))
          .filter((entry) => entry.englishWord && entry.hindiTranslation);
        setTranslationObservability({
          apiCount: apiWordPreviewRows.length,
          dictionaryCount: translationCounters.dictionaryCount,
          transliterationCount: translationCounters.transliterationCount,
          queuedCount: queuedApiDictionaryRows.length,
          lastUpdatedAt: new Date().toISOString(),
          apiWords: apiWordPreviewRows,
        });
      }

      let allCashMemosHtml = '';

      const dealerDetails = buildDealerDetails(isHindiPrint);

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
              const datedRates = resolveRatesForDate(
                rates,
                processedCustomer['Cash Memo Date'] || processedCustomer['Order Date'],
              );
              const productText = String(processedCustomer['Consumer Package'] || '').toLowerCase();
              const match = datedRates.find(r => {
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
          <CashMemoTemplate
            customer={processedCustomer}
            pageType={pageType}
            dealerDetails={dealerDetails}
            formatDateToDDMMYYYY={formatDateToDDMMYYYY}
            labelSettings={cashMemoLabelSettings[pageType]}
            showHeader={shouldShowHeader}
          />
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
              .print-placeholder-block {
                visibility: hidden;
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
      persistDeletedUsersBinFn,
      logAdminActivityFn,
      loadDataFn,
      notifyFn,
      restoreReason = '',
    ) => {
      if (!item) return;
      const confirmAction = typeof confirmFn === 'function' ? confirmFn : window.confirm;
      const confirmed = await confirmAction({
        title: 'Restore Deleted User',
        message: `Restore ${item.dealerCode || 'this user'} from recycle bin?`,
        confirmLabel: 'Restore User',
        previewTitle: 'Restore Preview',
        previewItems: [
          `Dealer: ${item.dealerCode || '-'} ${item.dealerName ? `- ${item.dealerName}` : ''}`,
          `Deleted by: ${item.deletedBy || '-'}`,
          `Deleted at: ${formatDisplayDateTime(item.deletedAt) || '-'}`,
          `Reason: ${item.deleteReason || '-'}`,
        ],
      });
      if (!confirmed) return false;

      const nextBin = (Array.isArray(currentDeletedUsersBin) ? currentDeletedUsersBin : []).filter(
        (user) => !(user.id === item.id && user.dealerCode === item.dealerCode),
      );
      const restoredUser = {
        ...buildAdminUserRestoreData(item),
        status: item.status || 'active',
        restoreCount: Number(item?.restoreCount || 0) + 1,
        restoredBy: String(auth?.currentUser?.email || '').trim().toLowerCase() || 'admin',
        restoreReason: String(restoreReason || '').trim(),
      };

      try {
        await saveAdminUser(restoredUser, { mode: 'restore', userId: item.id || undefined });

      } catch (error) {
        if (typeof notifyFn === 'function') {
          notifyFn(`Restore failed. Recycle-bin entry kept. Retry.${error?.message ? ` ${error.message}` : ''}`, 'error');
        }
        return false;
      }
      if (typeof persistDeletedUsersBinFn === 'function') {
        persistDeletedUsersBinFn(nextBin);
      }

      if (typeof logAdminActivityFn === 'function') {
        logAdminActivityFn('user_restored', {
          dealerCode: item.dealerCode || '',
          restoreCount: restoredUser.restoreCount,
          restoreReason: restoredUser.restoreReason || '',
        });
      }
      if (typeof notifyFn === 'function') {
        notifyFn(`${item.dealerCode || 'User'} restored from recycle bin.`, 'success');
      }
      if (typeof loadDataFn === 'function') {
        try {
          await loadDataFn();
        } catch {
          if (typeof notifyFn === 'function') {
            notifyFn('User restored in Firestore, but the list could not refresh. Refresh the list.', 'warning');
          }
        }
      }
      return true;
    };

    const permanentlyDeleteBinItem = async (
      item,
      confirmFn,
      currentDeletedUsersBin,
      persistDeletedUsersBinFn,
      logAdminActivityFn,
      notifyFn,
    ) => {
      if (!item) return;
      const confirmAction = typeof confirmFn === 'function' ? confirmFn : window.confirm;
      const confirmed = await confirmAction({
        title: 'Permanent Delete',
        message: `Permanently remove ${item.dealerCode || 'this deleted user'} from recycle bin?`,
        confirmLabel: 'Permanently Delete',
        dangerNote: 'This removes the recycle-bin copy and cannot be restored from this screen.',
        previewTitle: 'Deleting',
        previewItems: [
          `Dealer: ${item.dealerCode || '-'} ${item.dealerName ? `- ${item.dealerName}` : ''}`,
          `Deleted by: ${item.deletedBy || '-'}`,
          `Deleted at: ${formatDisplayDateTime(item.deletedAt) || '-'}`,
          `Reason: ${item.deleteReason || '-'}`,
        ],
      });
      if (!confirmed) return;

      const nextBin = (Array.isArray(currentDeletedUsersBin) ? currentDeletedUsersBin : []).filter(
        (user) => !(user.id === item.id && user.dealerCode === item.dealerCode),
      );
      try {
        if (item.id) {
          await deleteAdminUser(item.id);
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
      if (typeof notifyFn === 'function') {
        notifyFn(`${item.dealerCode || 'Deleted user'} removed permanently.`, 'info');
      }
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
      case 'aadhaarNotSeeded':
        return isAadhaarNotSeededStatus(row['EKYC Status']);
      case 'unregisteredNumber':
        return !isRegisteredMobileRow(row);
      case 'distributorManual':
        return isOrderSourceCategoryMatch(row['Order Source'], 'Distributor Manual');
      case 'vitranManual':
        return isOrderSourceCategoryMatch(row['Order Source'], 'Vitran Manual');
      case 'natureDomestic':
        return isConsumerStatusMatch(row['Consumer Nature'], '1 - Domestic');
      case 'natureUjjwala':
        return isConsumerStatusMatch(row['Consumer Nature'], '16-Scheme Ujjwala');
      case 'natureBpl':
        return isConsumerStatusMatch(row['Consumer Nature'], '11 - Scheme-BPL');
      case 'natureNonDomesticNonEssential':
        return isConsumerStatusMatch(row['Consumer Nature'], '4 - Non Domestic Non Essential');
      case 'natureNonDomesticExempted':
        return isConsumerStatusMatch(row['Consumer Nature'], '2 - Non Domestic Exempted');
      case 'sbcBooking':
        return isConsumerStatusMatch(row['Consumer Type'], 'SBC');
      case 'dbcBooking':
        return isConsumerStatusMatch(row['Consumer Type'], 'DBC');
      case 'pending01To02Days':
        return ageInDays !== null && ageInDays >= 1 && ageInDays <= 2;
      case 'pending02To05Days':
        return ageInDays !== null && ageInDays >= 3 && ageInDays <= 5;
      case 'pending05To10Days':
        return ageInDays !== null && ageInDays >= 6 && ageInDays <= 10;
      case 'freshPendingToday':
        return ageInDays === 0;
      case 'freshPending1To2Days':
        return ageInDays !== null && ageInDays >= 1 && ageInDays <= 2;
      case 'oldPending3To5Days':
        return ageInDays !== null && ageInDays >= 3 && ageInDays <= 5;
      case 'oldPending6To10Days':
        return ageInDays !== null && ageInDays >= 6 && ageInDays <= 10;
      case 'oldPendingAbove10Days':
        return ageInDays !== null && ageInDays > 10;
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
      case 'pendingAbove5Days':
        return ageInDays !== null && ageInDays > 5;
      case 'pendingAbove3Days':
        return ageInDays !== null && ageInDays > 3;
      case 'todayBooking':
        return orderDate && orderDate.getTime() === today.getTime();
      case 'cashMemoNotGenerated':
        return isCashMemoNotGeneratedRow(row);
      case 'pendingSv':
        return isPendingSvRow(row);
      default:
        return true;
    }
  };

  const applyStructuredFilters = (rows, excludedFilters = []) => {
    const excluded = new Set(excludedFilters);

    let tempFilteredData = rows.filter((row) => hasValidPendingConsumerNo(row));

    if (searchTerm) {
      tempFilteredData = tempFilteredData.filter((row) => matchesSmartSearch(row, searchTerm, SMART_SEARCH_FIELDS));
    }

    if (!excluded.has('eKycFilter') && hasMultiValueFilterSelection(eKycFilter)) {
      tempFilteredData = tempFilteredData.filter(row => matchesMultiValueFilter(eKycFilter, row['EKYC Status']));
    }
    if (!excluded.has('areaFilter') && hasMultiValueFilterSelection(areaFilter)) {
      tempFilteredData = tempFilteredData.filter(row => matchesMultiValueFilter(areaFilter, row['Delivery Area']));
    }
    if (!excluded.has('natureFilter') && hasMultiValueFilterSelection(natureFilter)) {
      tempFilteredData = tempFilteredData.filter(row => matchesMultiValueFilter(natureFilter, row['Consumer Nature']));
    }
    if (!excluded.has('mobileStatusFilter') && mobileStatusFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row =>
        mobileStatusFilter === 'Available'
          ? hasMeaningfulCellValue(row['Mobile No.'])
          : !hasMeaningfulCellValue(row['Mobile No.'])
      );
    }
    if (!excluded.has('consumerStatusFilter') && hasMultiValueFilterSelection(consumerStatusFilter)) {
      tempFilteredData = tempFilteredData.filter(row => matchesMultiValueFilter(consumerStatusFilter, row['Consumer Type']));
    }
    if (!excluded.has('connectionTypeFilter') && hasMultiValueFilterSelection(connectionTypeFilter)) {
      tempFilteredData = tempFilteredData.filter(row => matchesMultiValueFilter(connectionTypeFilter, row['Consumer Package']));
    }
    if (!excluded.has('onlineRefillPaymentStatusFilter') && onlineRefillPaymentStatusFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Online Refill Payment status'] === onlineRefillPaymentStatusFilter);
    }
    if (!excluded.has('orderStatusFilter') && orderStatusFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Order Status'] === orderStatusFilter);
    }
    if (!excluded.has('orderSourceFilter') && hasMultiValueFilterSelection(orderSourceFilter)) {
      tempFilteredData = tempFilteredData.filter(row => matchesMultiValueFilter(orderSourceFilter, row['Order Source']));
    }
    if (!excluded.has('orderTypeFilter') && orderTypeFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Order Type'] === orderTypeFilter);
    }
    if (!excluded.has('cashMemoStatusFilter') && cashMemoStatusFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row => row['Cash Memo Status'] === cashMemoStatusFilter);
    }
    if (!excluded.has('deliveryManFilter') && hasMultiValueFilterSelection(deliveryManFilter)) {
      tempFilteredData = tempFilteredData.filter(row => matchesMultiValueFilter(deliveryManFilter, row['Delivery Man']));
    }
    if (!excluded.has('isRegMobileFilter') && isRegMobileFilter !== 'All') {
      tempFilteredData = tempFilteredData.filter(row =>
        isRegMobileFilter === 'Yes'
          ? isRegisteredMobileRow(row)
          : !isRegisteredMobileRow(row)
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

  const sortRows = useCallback((rows) => {
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
  }, [sortBy, sortOrder]);

  const allPendingRows = useMemo(() => sortRows(parsedData.filter((row) => hasValidPendingConsumerNo(row))), [
    parsedData,
    sortRows,
  ]);

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
    reportViewMode,
  ]);

  const buildBookingReport = (rows) => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const metrics = {
      totalPendingBooking: rows.length,
      onlinePaid: 0,
      eKycNotDone: 0,
      aadhaarNotSeeded: 0,
      unregisteredNumber: 0,
      distributorManual: 0,
      vitranManual: 0,
      natureDomestic: 0,
      natureUjjwala: 0,
      natureBpl: 0,
      natureNonDomesticNonEssential: 0,
      natureNonDomesticExempted: 0,
      sbcBooking: 0,
      dbcBooking: 0,
      cashMemoNotGenerated: 0,
      freshPendingToday: 0,
      freshPending1To2Days: 0,
      oldPending3To5Days: 0,
      oldPending6To10Days: 0,
      oldPendingAbove10Days: 0,
      pending01To02Days: 0,
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
      pendingAbove5Days: 0,
      pendingAbove3Days: 0,
      todayBooking: 0,
      pendingSv: 0,
    };

    const areaPendingCounts = new Map();

    rows.forEach((row) => {
      const ageInDays = getElapsedDays(row['Order Date'], now);
      const orderDate = getStartOfDay(row['Order Date']);
      const deliveryArea = String(row['Delivery Area'] || '').trim();

      if (deliveryArea) {
        areaPendingCounts.set(deliveryArea, (areaPendingCounts.get(deliveryArea) || 0) + 1);
      }

      if (isOnlinePaidStatus(row['Online Refill Payment status'])) {
        metrics.onlinePaid += 1;
      }

      if (isEkycNotDoneStatus(row['EKYC Status'])) {
        metrics.eKycNotDone += 1;
      }

      if (isAadhaarNotSeededStatus(row['EKYC Status'])) {
        metrics.aadhaarNotSeeded += 1;
      }

      if (!isRegisteredMobileRow(row)) {
        metrics.unregisteredNumber += 1;
      }

      if (isOrderSourceCategoryMatch(row['Order Source'], 'Distributor Manual')) {
        metrics.distributorManual += 1;
      }

      if (isOrderSourceCategoryMatch(row['Order Source'], 'Vitran Manual')) {
        metrics.vitranManual += 1;
      }

      if (isConsumerStatusMatch(row['Consumer Nature'], '1 - Domestic')) {
        metrics.natureDomestic += 1;
      }

      if (isConsumerStatusMatch(row['Consumer Nature'], '16-Scheme Ujjwala')) {
        metrics.natureUjjwala += 1;
      }

      if (isConsumerStatusMatch(row['Consumer Nature'], '11 - Scheme-BPL')) {
        metrics.natureBpl += 1;
      }

      if (isConsumerStatusMatch(row['Consumer Nature'], '4 - Non Domestic Non Essential')) {
        metrics.natureNonDomesticNonEssential += 1;
      }

      if (isConsumerStatusMatch(row['Consumer Nature'], '2 - Non Domestic Exempted')) {
        metrics.natureNonDomesticExempted += 1;
      }

      if (isConsumerStatusMatch(row['Consumer Type'], 'SBC')) {
        metrics.sbcBooking += 1;
      }

      if (isConsumerStatusMatch(row['Consumer Type'], 'DBC')) {
        metrics.dbcBooking += 1;
      }

      if (isCashMemoNotGeneratedRow(row)) {
        metrics.cashMemoNotGenerated += 1;
      }

      if (ageInDays !== null) {
        if (ageInDays === 0) metrics.freshPendingToday += 1;
        if (ageInDays >= 1 && ageInDays <= 2) metrics.freshPending1To2Days += 1;
        if (ageInDays >= 3 && ageInDays <= 5) metrics.oldPending3To5Days += 1;
        if (ageInDays >= 6 && ageInDays <= 10) metrics.oldPending6To10Days += 1;
        if (ageInDays > 10) metrics.oldPendingAbove10Days += 1;
        if (ageInDays >= 1 && ageInDays <= 2) metrics.pending01To02Days += 1;
        if (ageInDays >= 3 && ageInDays <= 5) metrics.pending02To05Days += 1;
        if (ageInDays >= 6 && ageInDays <= 10) metrics.pending05To10Days += 1;
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
        if (ageInDays > 5) metrics.pendingAbove5Days += 1;
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

    const topPendingAreas = [...areaPendingCounts.entries()]
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0], undefined, { sensitivity: 'base', numeric: true });
      })
      .slice(0, 3)
      .map(([areaName, value], index) => ({
        key: `highestPb${index + 1}`,
        label: `Highest PB ${index + 1}${index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'}`,
        areaName,
        value,
      }));

    return { metrics, topPendingAreas };
  };

  const reportSourceData = reportViewMode === 'full' ? allPendingRows : baseFilteredData;

  const bookingReport = useMemo(() => buildBookingReport(reportSourceData), [reportSourceData]);

  const topPendingAreaFilterMap = useMemo(
    () => Object.fromEntries((bookingReport.topPendingAreas || []).map((item) => [item.key, item.areaName])),
    [bookingReport.topPendingAreas],
  );

  const filteredData = useMemo(() => {
    const reportFilterSourceData = reportViewMode === 'full' ? allPendingRows : baseFilteredData;
    if (!activeReportFilter) {
      return reportFilterSourceData;
    }
    if (topPendingAreaFilterMap[activeReportFilter]) {
      return reportFilterSourceData.filter((row) => String(row['Delivery Area'] || '').trim() === topPendingAreaFilterMap[activeReportFilter]);
    }
    return reportFilterSourceData.filter((row) => matchesReportFilter(row, activeReportFilter));
  }, [activeReportFilter, allPendingRows, baseFilteredData, reportViewMode, topPendingAreaFilterMap]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
    }, 0);
    return () => clearTimeout(timer);
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
  const totalPages = itemsPerPage === 0 ? 1 : Math.max(1, Math.ceil(filteredData.length / itemsPerPage));

  // Get current page data
  const currentTableData = useMemo(() => {
    if (itemsPerPage === 0) return filteredData;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, itemsPerPage]);
  const hasActiveDataFilters = Boolean(
    searchTerm
    || activeReportFilter
    || hasMultiValueFilterSelection(eKycFilter)
    || hasMultiValueFilterSelection(areaFilter)
    || hasMultiValueFilterSelection(natureFilter)
    || mobileStatusFilter !== 'All'
    || hasMultiValueFilterSelection(consumerStatusFilter)
    || hasMultiValueFilterSelection(connectionTypeFilter)
    || onlineRefillPaymentStatusFilter !== 'All'
    || orderStatusFilter !== 'All'
    || hasMultiValueFilterSelection(orderSourceFilter)
    || orderTypeFilter !== 'All'
    || cashMemoStatusFilter !== 'All'
    || hasMultiValueFilterSelection(deliveryManFilter)
    || isRegMobileFilter !== 'All'
    || orderDateStart
    || orderDateEnd
    || cashMemoDateStart
    || cashMemoDateEnd
    || sortBy !== 'Delivery Area'
    || sortOrder !== 'asc'
  );
  const shouldShowEmptyUploadState = showParsedData && parsedData.length === 0;
  const shouldShowFilteredEmptyState = showParsedData && parsedData.length > 0 && filteredData.length === 0;
  const emptyUploadSuggestions = [
    {
      key: 'tour',
      label: 'Open Quick Tour',
      onClick: () => openOnboardingTour(0),
    },
    {
      key: 'invoice',
      label: 'See Invoice Screen',
      onClick: handleInvoiceOpen,
    },
  ];
  const {
    selectedCustomerIds,
    isAllFilteredRowsSelected,
    selectedCustomersForPrint,
    handleCheckboxChange,
    handleSelectAllChange,
    clearSelection,
  } = useCashmemoSelection(filteredData);

  const selectedFilteredRows = filteredData.filter((row) => selectedCustomerIds.includes(String(row['Consumer No.'])));

  const dangerReportCardKeys = new Set([
    'cashMemoNotGenerated',
    'pending02To05Days',
    'pending05To10Days',
    'pendingAbove5Days',
    'pendingAbove7Days',
    'pendingAbove10Days',
    'pendingAbove15Days',
    'pendingAbove21Days',
    'oldPending3To5Days',
    'oldPending6To10Days',
    'oldPendingAbove10Days',
    'eKycNotDone',
    'aadhaarNotSeeded',
    'unregisteredNumber',
  ]);

  const infoReportCardKeys = new Set([
    'onlinePaid',
    'freshPending1To2Days',
    'pendingAbove3Days',
  ]);

  const successReportCardKeys = new Set([
    'freshPendingToday',
  ]);

  const warningReportCardKeys = new Set([
    'oldPending3To5Days',
    'pending02To05Days',
  ]);

  const getReportTone = (key) => (
    successReportCardKeys.has(key)
      ? 'success'
      : dangerReportCardKeys.has(key)
      ? 'danger'
      : warningReportCardKeys.has(key)
        ? 'warning'
        : infoReportCardKeys.has(key)
          ? 'info'
          : 'default'
  );

  const createReportCard = (key, label, value, options = {}) => ({
    key,
    label,
    value,
    tone: getReportTone(key),
    displayValue: options.showPercentage
      ? `${value} (${getReportPercentage(value, bookingReport.metrics.totalPendingBooking)}%)`
      : String(value),
    ...options,
  });

  const reportSummaryCards = [
    createReportCard('freshPendingToday', 'Today', bookingReport.metrics.freshPendingToday, { showPercentage: true, icon: '🆕' }),
    createReportCard('freshPending1To2Days', '1-2 Days', bookingReport.metrics.freshPending1To2Days, { showPercentage: true, icon: '⏳' }),
    createReportCard('oldPending3To5Days', '3-5 Days', bookingReport.metrics.oldPending3To5Days, { showPercentage: true, icon: '⌛' }),
    createReportCard('oldPending6To10Days', '6-10 Days', bookingReport.metrics.oldPending6To10Days, { showPercentage: true, icon: '⚠️' }),
    createReportCard('oldPendingAbove10Days', '10+ Days', bookingReport.metrics.oldPendingAbove10Days, { showPercentage: true, icon: '🚨' }),
  ];

  const reportCards = [
    createReportCard('totalPendingBooking', 'Total Pending', bookingReport.metrics.totalPendingBooking),
    createReportCard('cashMemoNotGenerated', 'Cash Memo Not Generated', bookingReport.metrics.cashMemoNotGenerated),
    createReportCard('onlinePaid', 'Online Paid', bookingReport.metrics.onlinePaid),
    createReportCard('eKycNotDone', 'EKYC Pending', bookingReport.metrics.eKycNotDone),
    createReportCard('aadhaarNotSeeded', 'Aadhaar Not Seeded', bookingReport.metrics.aadhaarNotSeeded),
    createReportCard('unregisteredNumber', 'Unregistered Number', bookingReport.metrics.unregisteredNumber),
    createReportCard('distributorManual', 'Distributor Manual', bookingReport.metrics.distributorManual),
    createReportCard('vitranManual', 'Vitran Manual', bookingReport.metrics.vitranManual),
    createReportCard('natureDomestic', '1 - Domestic', bookingReport.metrics.natureDomestic),
    createReportCard('natureUjjwala', '16-Scheme Ujjwala', bookingReport.metrics.natureUjjwala),
    createReportCard('natureBpl', '11 - Scheme-BPL', bookingReport.metrics.natureBpl),
    createReportCard('natureNonDomesticNonEssential', '4 - Non Domestic Non Essential', bookingReport.metrics.natureNonDomesticNonEssential),
    createReportCard('natureNonDomesticExempted', '2 - Non Domestic Exempted', bookingReport.metrics.natureNonDomesticExempted),
    createReportCard('sbcBooking', 'SBC Booking', bookingReport.metrics.sbcBooking),
    createReportCard('dbcBooking', 'DBC Booking', bookingReport.metrics.dbcBooking),
    createReportCard('pendingSv', 'Pending SV', bookingReport.metrics.pendingSv),
    createReportCard('todayBooking', "Today's Booking", bookingReport.metrics.todayBooking),
    createReportCard('pendingDay1', '1 Day', bookingReport.metrics.pendingDay1),
    createReportCard('pendingDay2', '2 Days', bookingReport.metrics.pendingDay2),
    createReportCard('pendingDay3', '3 Days', bookingReport.metrics.pendingDay3),
    createReportCard('pendingDay4', '4 Days', bookingReport.metrics.pendingDay4),
    createReportCard('pendingDay5', '5 Days', bookingReport.metrics.pendingDay5),
    createReportCard('pendingDay6', '6 Days', bookingReport.metrics.pendingDay6),
    createReportCard('pendingDay7', '7 Days', bookingReport.metrics.pendingDay7),
    createReportCard('pendingDay8', '8 Days', bookingReport.metrics.pendingDay8),
    createReportCard('pendingDay9', '9 Days', bookingReport.metrics.pendingDay9),
    createReportCard('pendingDay10', '10 Days', bookingReport.metrics.pendingDay10),
    createReportCard('pending01To02Days', '1-2 Days', bookingReport.metrics.pending01To02Days),
    createReportCard('pending02To05Days', '3-5 Days', bookingReport.metrics.pending02To05Days),
    createReportCard('pending05To10Days', '6-10 Days', bookingReport.metrics.pending05To10Days),
    createReportCard('pendingAbove3Days', '> 3 Days', bookingReport.metrics.pendingAbove3Days),
    createReportCard('pendingAbove5Days', '> 5 Days', bookingReport.metrics.pendingAbove5Days),
    createReportCard('pendingAbove7Days', '> 7 Days', bookingReport.metrics.pendingAbove7Days),
    createReportCard('pendingAbove10Days', '> 10 Days', bookingReport.metrics.pendingAbove10Days),
    createReportCard('pendingAbove15Days', '> 15 Days', bookingReport.metrics.pendingAbove15Days),
    createReportCard('pendingAbove21Days', '> 21 Days', bookingReport.metrics.pendingAbove21Days),
    ...bookingReport.topPendingAreas,
  ].map((card) => ({
    ...card,
    tone: card.tone || getReportTone(card.key),
    displayValue: card.displayValue || String(card.value),
  }));
  const exceptionQueueCards = [
    {
      key: 'cashMemoNotGenerated',
      label: 'Cash Memo Pending',
      description: 'Rows jahan cash memo abhi generate ya mark nahi hua hai.',
      count: bookingReport.metrics.cashMemoNotGenerated,
    },
    {
      key: 'eKycNotDone',
      label: 'eKYC Pending',
      description: 'Complete these records first before dispatch or print follow-up.',
      count: bookingReport.metrics.eKycNotDone,
    },
    {
      key: 'aadhaarNotSeeded',
      label: 'Aadhaar Not Seeded',
      description: 'Identity linkage pending records needing dealer attention.',
      count: bookingReport.metrics.aadhaarNotSeeded,
    },
    {
      key: 'unregisteredNumber',
      label: 'Mobile Missing',
      description: 'Consumer contact is missing or not properly registered.',
      count: bookingReport.metrics.unregisteredNumber,
    },
    {
      key: 'pending02To05Days',
      label: 'Aging 3-5 Days',
      description: 'These bookings are aging out of the fresh window and need quick action.',
      count: bookingReport.metrics.pending02To05Days,
    },
    {
      key: 'pendingAbove5Days',
      label: 'Aging > 5 Days',
      description: 'Stale bookings crossing five days need priority follow-up.',
      count: bookingReport.metrics.pendingAbove5Days,
    },
    {
      key: 'pending05To10Days',
      label: 'Aging 6-10 Days',
      description: 'Bookings in the six to ten day window need focused action.',
      count: bookingReport.metrics.pending05To10Days,
    },
    {
      key: 'pendingAbove7Days',
      label: 'Aging > 7 Days',
      description: 'Highest priority stale bookings waiting too long.',
      count: bookingReport.metrics.pendingAbove7Days,
    },
    {
      key: 'onlinePaid',
      label: 'Online Paid',
      description: 'Review paid bookings that are ready for next processing step.',
      count: bookingReport.metrics.onlinePaid,
    },
  ]
    .filter((item) => item.count > 0)
    .map((item) => ({
      ...item,
      tone: dangerReportCardKeys.has(item.key)
        ? 'danger'
        : infoReportCardKeys.has(item.key)
          ? 'info'
          : 'default',
      isActive: activeReportFilter === item.key,
      onClick: () => {
        setShowBookingReport(true);
        setActiveReportFilter((prev) => (prev === item.key ? '' : item.key));
      },
    }));
  const reportFilterOptions = [...reportSummaryCards, ...reportCards].filter((card) => card.key !== 'totalPendingBooking');
  const reportLabelLookup = useMemo(
    () => Object.fromEntries(reportFilterOptions.map((card) => [card.key, card.label])),
    [reportFilterOptions],
  );
  const activeFilterChips = [
    searchTerm ? { key: 'search', label: `Search: ${searchTerm}`, clear: () => setSearchTerm('') } : null,
    activeReportFilter ? { key: 'report', label: `Report: ${reportLabelLookup[activeReportFilter] || activeReportFilter}`, clear: () => setActiveReportFilter('') } : null,
    reportViewMode === 'full' ? { key: 'reportView', label: 'Report View: Full Report', clear: () => setReportViewMode('filtered') } : null,
    hasMultiValueFilterSelection(eKycFilter) ? { key: 'ekyc', label: formatMultiValueFilterLabel('EKYC', eKycFilter), clear: () => setEKycFilter('All') } : null,
    hasMultiValueFilterSelection(areaFilter) ? { key: 'area', label: formatMultiValueFilterLabel('Area', areaFilter), clear: () => setAreaFilter('All') } : null,
    hasMultiValueFilterSelection(natureFilter) ? { key: 'nature', label: formatMultiValueFilterLabel('Nature', natureFilter), clear: () => setNatureFilter('All') } : null,
    mobileStatusFilter !== 'All' ? { key: 'mobile', label: `Mobile: ${mobileStatusFilter}`, clear: () => setMobileStatusFilter('All') } : null,
    onlineRefillPaymentStatusFilter !== 'All' ? { key: 'payment', label: `Payment: ${onlineRefillPaymentStatusFilter}`, clear: () => setOnlineRefillPaymentStatusFilter('All') } : null,
    orderTypeFilter !== 'All' ? { key: 'orderType', label: `Order Type: ${orderTypeFilter}`, clear: () => setOrderTypeFilter('All') } : null,
    hasMultiValueFilterSelection(consumerStatusFilter) ? { key: 'consumerType', label: formatMultiValueFilterLabel('Consumer Type', consumerStatusFilter), clear: () => setConsumerStatusFilter('All') } : null,
    hasMultiValueFilterSelection(connectionTypeFilter) ? { key: 'connection', label: formatMultiValueFilterLabel('Connection', connectionTypeFilter), clear: () => setConnectionTypeFilter('All') } : null,
    orderStatusFilter !== 'All' ? { key: 'orderStatus', label: `Order Status: ${orderStatusFilter}`, clear: () => setOrderStatusFilter('All') } : null,
    hasMultiValueFilterSelection(orderSourceFilter) ? { key: 'orderSource', label: formatMultiValueFilterLabel('Order Source', orderSourceFilter), clear: () => setOrderSourceFilter('All') } : null,
    cashMemoStatusFilter !== 'All' ? { key: 'cashMemoStatus', label: `Cash Memo: ${cashMemoStatusFilter}`, clear: () => setCashMemoStatusFilter('All') } : null,
    hasMultiValueFilterSelection(deliveryManFilter) ? { key: 'deliveryMan', label: formatMultiValueFilterLabel('Delivery Man', deliveryManFilter), clear: () => setDeliveryManFilter('All') } : null,
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
    (sortBy && (sortBy !== 'Delivery Area' || sortOrder !== 'asc')) ? {
      key: 'sort',
      label: `Sort: ${sortBy} (${sortOrder})`,
      clear: () => {
        setSortBy('Delivery Area');
        setSortOrder('asc');
      },
    } : null,
  ].filter(Boolean);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const availableEkycOptions = useMemo(() => sortedUniqueValues(applyStructuredFilters(parsedData, ['eKycFilter']).map(row => row['EKYC Status'])), [parsedData, searchTerm, areaFilter, natureFilter, mobileStatusFilter, consumerStatusFilter, connectionTypeFilter, onlineRefillPaymentStatusFilter, orderStatusFilter, orderSourceFilter, orderTypeFilter, cashMemoStatusFilter, deliveryManFilter, isRegMobileFilter, orderDateStart, orderDateEnd, cashMemoDateStart, cashMemoDateEnd, activeReportFilter]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const availableAreaOptions = useMemo(() => sortedUniqueValues(applyStructuredFilters(parsedData, ['areaFilter']).map(row => row['Delivery Area'])), [parsedData, searchTerm, eKycFilter, natureFilter, mobileStatusFilter, consumerStatusFilter, connectionTypeFilter, onlineRefillPaymentStatusFilter, orderStatusFilter, orderSourceFilter, orderTypeFilter, cashMemoStatusFilter, deliveryManFilter, isRegMobileFilter, orderDateStart, orderDateEnd, cashMemoDateStart, cashMemoDateEnd, activeReportFilter]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const availableNatureOptions = useMemo(() => sortedUniqueValues(applyStructuredFilters(parsedData, ['natureFilter']).map(row => row['Consumer Nature'])), [parsedData, searchTerm, eKycFilter, areaFilter, mobileStatusFilter, consumerStatusFilter, connectionTypeFilter, onlineRefillPaymentStatusFilter, orderStatusFilter, orderSourceFilter, orderTypeFilter, cashMemoStatusFilter, deliveryManFilter, isRegMobileFilter, orderDateStart, orderDateEnd, cashMemoDateStart, cashMemoDateEnd, activeReportFilter]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const availableMobileStatusOptions = useMemo(() => sortedUniqueValues(applyStructuredFilters(parsedData, ['mobileStatusFilter']).map(row => (hasMeaningfulCellValue(row['Mobile No.']) ? 'Available' : 'Not Available'))), [parsedData, searchTerm, eKycFilter, areaFilter, natureFilter, consumerStatusFilter, connectionTypeFilter, onlineRefillPaymentStatusFilter, orderStatusFilter, orderSourceFilter, orderTypeFilter, cashMemoStatusFilter, deliveryManFilter, isRegMobileFilter, orderDateStart, orderDateEnd, cashMemoDateStart, cashMemoDateEnd, activeReportFilter]);
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
  const availableIsRegMobileOptions = useMemo(() => sortedUniqueValues(applyStructuredFilters(parsedData, ['isRegMobileFilter']).map(row => (isRegisteredMobileRow(row) ? 'Yes' : 'No'))), [parsedData, searchTerm, eKycFilter, areaFilter, natureFilter, mobileStatusFilter, consumerStatusFilter, connectionTypeFilter, onlineRefillPaymentStatusFilter, orderStatusFilter, orderSourceFilter, orderTypeFilter, cashMemoStatusFilter, deliveryManFilter, orderDateStart, orderDateEnd, cashMemoDateStart, cashMemoDateEnd, activeReportFilter]);

  useEffect(() => {
    if (hasMultiValueFilterSelection(eKycFilter)) {
      const nextEkycValues = getMultiValueFilterValues(eKycFilter).filter((value) => availableEkycOptions.includes(value));
      const normalizedEkyc = normalizeMultiValueFilter(nextEkycValues);
      if (JSON.stringify(normalizedEkyc) !== JSON.stringify(normalizeMultiValueFilter(eKycFilter))) setEKycFilter(normalizedEkyc);
    }
    if (hasMultiValueFilterSelection(areaFilter)) {
      const nextAreaValues = getMultiValueFilterValues(areaFilter).filter((value) => availableAreaOptions.includes(value));
      const normalizedAreas = normalizeMultiValueFilter(nextAreaValues);
      if (JSON.stringify(normalizedAreas) !== JSON.stringify(normalizeMultiValueFilter(areaFilter))) setAreaFilter(normalizedAreas);
    }
    if (hasMultiValueFilterSelection(natureFilter)) {
      const nextNatureValues = getMultiValueFilterValues(natureFilter).filter((value) => availableNatureOptions.includes(value));
      const normalizedNatures = normalizeMultiValueFilter(nextNatureValues);
      if (JSON.stringify(normalizedNatures) !== JSON.stringify(normalizeMultiValueFilter(natureFilter))) setNatureFilter(normalizedNatures);
    }
    if (mobileStatusFilter !== 'All' && !availableMobileStatusOptions.includes(mobileStatusFilter)) setMobileStatusFilter('All');
    if (hasMultiValueFilterSelection(consumerStatusFilter)) {
      const nextConsumerStatusValues = getMultiValueFilterValues(consumerStatusFilter).filter((value) => availableConsumerStatusOptions.includes(value));
      const normalizedConsumerStatuses = normalizeMultiValueFilter(nextConsumerStatusValues);
      if (JSON.stringify(normalizedConsumerStatuses) !== JSON.stringify(normalizeMultiValueFilter(consumerStatusFilter))) setConsumerStatusFilter(normalizedConsumerStatuses);
    }
    if (hasMultiValueFilterSelection(connectionTypeFilter)) {
      const nextConnectionTypeValues = getMultiValueFilterValues(connectionTypeFilter).filter((value) => availableConnectionTypeOptions.includes(value));
      const normalizedConnectionTypes = normalizeMultiValueFilter(nextConnectionTypeValues);
      if (JSON.stringify(normalizedConnectionTypes) !== JSON.stringify(normalizeMultiValueFilter(connectionTypeFilter))) setConnectionTypeFilter(normalizedConnectionTypes);
    }
    if (onlineRefillPaymentStatusFilter !== 'All' && !availableOnlinePaymentOptions.includes(onlineRefillPaymentStatusFilter)) setOnlineRefillPaymentStatusFilter('All');
    if (orderStatusFilter !== 'All' && !availableOrderStatusOptions.includes(orderStatusFilter)) setOrderStatusFilter('All');
    if (hasMultiValueFilterSelection(orderSourceFilter)) {
      const nextOrderSourceValues = getMultiValueFilterValues(orderSourceFilter).filter((value) => availableOrderSourceOptions.includes(value));
      const normalizedOrderSources = normalizeMultiValueFilter(nextOrderSourceValues);
      if (JSON.stringify(normalizedOrderSources) !== JSON.stringify(normalizeMultiValueFilter(orderSourceFilter))) setOrderSourceFilter(normalizedOrderSources);
    }
    if (orderTypeFilter !== 'All' && !availableOrderTypeOptions.includes(orderTypeFilter)) setOrderTypeFilter('All');
    if (cashMemoStatusFilter !== 'All' && !availableCashMemoStatusOptions.includes(cashMemoStatusFilter)) setCashMemoStatusFilter('All');
    if (hasMultiValueFilterSelection(deliveryManFilter)) {
      const nextDeliveryManValues = getMultiValueFilterValues(deliveryManFilter).filter((value) => availableDeliveryManOptions.includes(value));
      const normalizedDeliveryMen = normalizeMultiValueFilter(nextDeliveryManValues);
      if (JSON.stringify(normalizedDeliveryMen) !== JSON.stringify(normalizeMultiValueFilter(deliveryManFilter))) setDeliveryManFilter(normalizedDeliveryMen);
    }
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
    return submitUpdateApprovalRequest({
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

//test
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
  // Central permission engine — single source for all access decisions.
  // (Declared early: isPlanExpired is referenced by blocks below.)
  const accessState = getAccessState(loggedInUser, {
    isLoggedIn,
    hasWorkingData: Array.isArray(parsedData) && parsedData.length > 0,
  });
  const isPlanExpired = accessState.isPlanExpired;
  const hasWorkingData = accessState.hasWorkingData;
  const hasHindiPackageAccess = accessState.hasHindiPackageAccess;
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
  const userMenuStatusText = getUserAccountStatus(loggedInUser);
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
      : showCashmemoLayout ? 'cashmemoLayout'
      : showAttendance ? 'attendance'
      : showIdCard ? 'idCard'
      : showEmployeeProfile ? 'employeeProfile'
      : showSalarySlipPage ? 'salarySlips'
      : showAttendanceReportPage ? 'attendanceReport'
      : showEmployeeReportPage ? 'employeeReport'
      : showStockRegister ? 'stockRegister'
      : showLabelUpdate ? 'labelUpdate'
      : showHeaderUpdate ? 'headerUpdate'
      : showInvoicePage ? 'invoice'
      : showAboutInfo ? 'about'
      : showHomeInfo ? 'home'
      : '';
  const updateInboxCount = pendingRequestCount + pendingDictionaryCount + contactReplyCount + (planUpgradeReplyText ? 1 : 0);
  const userNotificationItems = [
    isPlanExpired ? {
      id: 'plan-expired',
      title: 'Plan expired',
      detail: loggedInUser?.validTill ? `Expired on ${formatDisplayDate(loggedInUser.validTill)}` : 'Renewal required to continue tools.',
      tone: 'danger',
      actionLabel: 'Renew Now',
      action: { onClick: handleUpgradePlanOpen, viewKey: 'upgradePlan' },
    } : null,
    planUpgradeReplyText ? {
      id: 'plan-reply',
      title: 'Plan upgrade reply',
      detail: planUpgradeReplyText,
      tone: 'info',
      actionLabel: 'Open History',
      action: { onClick: handleRequestHistoryOpen, viewKey: 'userProfile', beforeOpen: () => setUserProfileInitialSection('history'), allowSameView: true },
    } : null,
    ...pendingUserApprovalTypes.map((type) => ({
      id: `pending-${type}`,
      title: `${type} request pending`,
      detail: 'Admin approval ka wait hai.',
      tone: 'pending',
      actionLabel: 'View History',
      action: { onClick: handleRequestHistoryOpen, viewKey: 'userProfile', beforeOpen: () => setUserProfileInitialSection('history'), allowSameView: true },
    })),
    pendingDictionaryCount > 0 ? {
      id: 'dictionary-pending',
      title: `${pendingDictionaryCount} dictionary request pending`,
      detail: 'Hindi dictionary updates admin approval mein hain.',
      tone: 'pending',
      actionLabel: 'Open Dictionary',
      action: { onClick: handleDictionaryOpen, viewKey: 'dictionaryUpdate' },
    } : null,
    ...contactReplyItems.filter((item) => !item.read).slice(0, 3).map((item) => ({
      id: `reply-${item.replyId}`,
      title: 'Admin reply received',
      detail: String(item.reply || '').slice(0, 90) || 'Support reply available.',
      tone: 'unread',
      actionLabel: 'Open Support',
      action: { onClick: handleContactOpen, viewKey: 'support' },
    })),
  ].filter(Boolean);
  const userMenuBadgeCount = updateInboxCount > 0 ? (updateInboxCount > 9 ? '9+' : updateInboxCount) : '';
  const userRole = String(loggedInUser?.role || 'user').toLowerCase();
  const profileData = loggedInUser?.profileData || {};
  const bankDetailsData = loggedInUser?.bankDetailsData || {};
  const headerData = loggedInUser?.hindiHeaderData || {};
  const ratesData = Array.isArray(loggedInUser?.ratesData) ? loggedInUser.ratesData : [];
  const profileCompletenessChecks = [
    {
      key: 'profile',
      label: 'Profile',
      complete: Boolean(profileData.distributorName && profileData.contact && profileData.address && profileData.gst),
      reason: 'Distributor identity aur billing details complete rahenge.',
    },
    {
      key: 'bank',
      label: 'Bank',
      complete: Boolean(bankDetailsData.bankName && bankDetailsData.accountNo && bankDetailsData.ifsc),
      reason: 'Bank missing hone par payout aur billing follow-up delay ho sakta hai.',
    },
    {
      key: 'header',
      label: 'Header',
      complete: Boolean(headerData.distributorName && headerData.address && headerData.email),
      reason: 'Hindi print output aur distributor header consistency ke liye needed hai.',
    },
    {
      key: 'rates',
      label: 'Rates',
      complete: ratesData.length > 0,
      reason: 'Rates ready hone se invoice aur cashmemo work smooth hota hai.',
    },
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
  const userAvatarImage = loggedInUser?.profileData?.photoDataUrl || '';
  const remainingDays = getRemainingDays(loggedInUser?.validTill);
  const renewalUrgencyLabel = isPlanExpired
    ? 'Plan expired. Renew to unlock tools again.'
    : remainingDays === null
      ? 'Validity not available.'
      : remainingDays < 0
        ? `Expired ${Math.abs(remainingDays)} day${Math.abs(remainingDays) === 1 ? '' : 's'} ago.`
        : remainingDays === 0
          ? 'Expires today.'
          : remainingDays === 1
            ? 'Expires tomorrow.'
            : remainingDays <= 7
              ? `${remainingDays} days left. Renewal recommended.`
              : `${remainingDays} days left on current plan.`;
  const userMenuPackageTips = hasHindiPackageAccess
    ? [
        {
          text: 'Hindi package active: dictionary, delivery area/staff, and header tools are available.',
          actionLabel: 'Open Hindi Tools',
          onClick: handleDictionaryOpen,
          viewKey: 'dictionaryUpdate',
          disabled: isPlanExpired || !hasHindiPackageAccess,
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
            text: 'Use request history to track approval updates.',
            actionLabel: 'Track Updates',
            onClick: handleRequestHistoryOpen,
            beforeOpen: () => setUserProfileInitialSection('history'),
            viewKey: 'userProfile',
            allowSameView: true,
          },
        ]
      : [
          {
            text: 'Complete your profile and bank details to keep your package setup ready.',
            actionLabel: incompleteProfileAreas.some((item) => item.key === 'profile') ? 'Complete Profile' : 'Update Bank',
            onClick: incompleteProfileAreas.some((item) => item.key === 'profile') ? handleProfileUpdate : handleBankDetails,
            viewKey: incompleteProfileAreas.some((item) => item.key === 'profile') ? 'profileUpdate' : 'bankUpdate',
            disabled: isPlanExpired,
          },
          {
            text: 'Review package renewal when your current validity is close to expiry.',
            actionLabel: 'Open Renewal',
            onClick: handleUpgradePlanOpen,
            viewKey: 'upgradePlan',
            requiresConfirm: isPlanExpired,
            confirmMessage: 'Do you want to open the renewal form now?',
          },
        ];
  const menuAccessRules = buildMenuAccessRules({ isPlanExpired, hasHindiPackageAccess });
  const canAccessMenuFeature = (featureKey) => canAccessMenuFeatureByRules(menuAccessRules, featureKey);
  const packageAccessBreakdown = buildPackageAccessBreakdown({
    canAccessMenuFeature,
    hasWorkingData,
    isPlanExpired,
    hasHindiPackageAccess,
  });
  const collectMenuNames = (labels = [], predicate) => labels.filter((label) => {
    try {
      return Boolean(predicate(label));
    } catch {
      return false;
    }
  });

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
    if (item?.requiresConfirm) {
      openConfirmDialog({
        title: item.label || 'Please Confirm',
        message: item.confirmMessage || `Open ${item.label}?`,
        confirmLabel: 'Open',
        onConfirm: () => {
          if (typeof item?.beforeOpen === 'function') {
            item.beforeOpen();
          }
          if (typeof item?.onClick === 'function') {
            item.onClick();
          }
        },
      });
      return;
    }
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
    : { label: 'Request History', onClick: handleRequestHistoryOpen, viewKey: 'userProfile', beforeOpen: () => setUserProfileInitialSection('history'), allowSameView: true };
  const userMenuEmptyGuidance = isPlanExpired
    ? 'Renew your plan to restore uploads, invoice tools, and update requests.'
    : !hasWorkingData
      ? 'No working data has been uploaded yet. Start with Upload Data.'
      : updateInboxCount === 0 && incompleteProfileAreas.length === 0
        ? 'Everything looks up to date. You can open Data View or Invoice tools next.'
        : 'Use the quick actions to complete the next best step.';
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
  const recommendedAction = isPlanExpired
    ? {
        label: 'Plan expired',
        actionLabel: 'Renew Now',
        description: 'Uploads, invoice, aur update requests tabhi resume honge jab renewal approve hoga.',
        onClick: handleUpgradePlanOpen,
        viewKey: 'upgradePlan',
      }
    : incompleteProfileAreas.length > 0
        ? {
            label: 'Profile setup pending',
            actionLabel: incompleteProfileActionItems[0]?.label || 'Complete Setup',
            description: `${incompleteProfileAreas[0]?.label || 'Profile'} abhi complete nahi hai. Isse onboarding aur smooth ho jayegi.`,
            ...(incompleteProfileActionItems[0] || primaryQuickAction),
          }
        : !hasWorkingData
          ? {
              label: 'No working data',
              actionLabel: 'Upload Data',
              description: 'Latest Pending Booking file upload karke filtering aur print start kijiye.',
              onClick: handleReUploadClick,
              viewKey: 'dataUpload',
            }
          : selectedCustomerIds.length === 0
            ? {
                label: 'Selection pending',
                actionLabel: showBookingReport ? 'Open Data View' : 'Show Report',
                description: 'Data ready hai. Ab filters lagakar rows select kijiye, phir cashmemo print kijiye.',
                onClick: showBookingReport ? handleShowData : () => setShowBookingReport(true),
                viewKey: 'dataUpload',
                allowSameView: true,
              }
            : {
                label: 'Ready to print',
                actionLabel: 'Open Data View',
                description: `${selectedCustomerIds.length} row selected hai. Ab direct print ya export kar sakte hain.`,
                onClick: handleShowData,
                viewKey: 'dataUpload',
                allowSameView: true,
              };
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
  const pendingEkycCount = parsedData.filter((row) => isEkycNotDoneStatus(row?.['EKYC Status'])).length;
  const activePackageStatus = loggedInUser?.package
    ? `${formatPackageNameForNavbar(loggedInUser.package)} (Valid till: ${formatDisplayDate(loggedInUser.validTill)})`
    : 'No active package';
  const homeQuickActions = [
    'cDCMS से Pending Booking डेटा download करके upload करें',
    'Filters और report cards से records verify करें',
    'Cashmemo / Invoice generate और print करें',
    'ज़रूरत होने पर profile, bank या rate update request भेजें',
  ];
  const homeTodayFocus = [
    `आज की bookings: ${todayOrders}`,
    `eKYC pending records: ${pendingEkycCount}`,
    hasWorkingData ? `${filteredData.length} rows current filters में visible हैं` : 'Fresh upload karke working data ready kijiye',
    selectedCustomerIds.length > 0 ? `${selectedCustomerIds.length} row print/export ke liye selected हैं` : 'Online paid ya priority rows select kijiye',
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
    { label: 'Account Status', value: getUserAccountStatus(loggedInUser) },
  ];
  const visibleAnnouncements = announcements.filter((item) => {
    if (!item?.active) return false;
    if (item?.expiresAt) {
      const expiryDate = new Date(`${item.expiresAt}T23:59:59`);
      if (!Number.isNaN(expiryDate.getTime()) && expiryDate < new Date()) return false;
    }
    const targetScope = String(item?.targetScope || 'all').toLowerCase();
    if (targetScope === 'all') return true;
    if (targetScope === 'active') return getUserAccountStatus(loggedInUser) === 'active';
    if (targetScope === 'expiring') {
      const days = getRemainingDays(loggedInUser?.validTill);
      return days !== null && days >= 0 && days <= 7;
    }
    if (targetScope === 'expired') return isPlanExpired;
    return String(loggedInUser?.package || '').toLowerCase() === targetScope;
  }).slice(0, 3);
  const dashboardActionCenterCards = [
    {
      key: 'continue',
      label: 'Recommended',
      title: recommendedAction?.actionLabel || 'Continue',
      description: recommendedAction?.description || 'Agla best step yahan se continue kijiye.',
      cta: recommendedAction?.label || 'Open next step',
      badge: recommendedAction?.label,
      tone: 'primary',
      action: recommendedAction || primaryQuickAction,
      disabled: recommendedAction?.disabled,
    },
    {
      key: 'profile',
      label: 'Profile Setup',
      title: `${profileCompletionPercent}% complete`,
      description: incompleteProfileAreas.length > 0
        ? `${incompleteProfileAreas.map((item) => item.label).join(', ')} abhi pending hai.`
        : 'Profile, bank, header, aur rates sab ready hain.',
      cta: incompleteProfileActionItems[0]?.label || 'View Profile',
      badge: profileCompletenessLabel,
      tone: incompleteProfileAreas.length > 0 ? 'warning' : 'success',
      action: incompleteProfileActionItems[0] || primaryQuickAction,
      disabled: incompleteProfileActionItems[0]?.disabled,
    },
    {
      key: 'work',
      label: 'Work Status',
      title: hasWorkingData ? `${parsedData.length} rows ready` : 'No working data',
      description: hasWorkingData
        ? `${uploadMetadata?.fileName || 'Latest file'} loaded hai. ${selectedCustomerIds.length > 0 ? `${selectedCustomerIds.length} rows selected hain.` : 'Ab filters ya selection continue kijiye.'}`
        : 'Pending Booking file upload karke data flow start kijiye.',
      cta: hasWorkingData ? (selectedCustomerIds.length > 0 ? 'Open Data View' : 'Filter Data') : 'Upload Data',
      badge: uploadMetadata?.fileName ? 'Uploaded' : '',
      tone: hasWorkingData ? 'success' : 'default',
      action: hasWorkingData
        ? { label: 'Open Data View', onClick: handleShowData, viewKey: 'dataUpload', allowSameView: true }
        : { label: 'Upload Data', onClick: handleReUploadClick, viewKey: 'dataUpload' },
      disabled: isPlanExpired && !hasWorkingData,
    },
  ];
  const handleDashboardQuickAction = (action) => {
    if (!action) return;
    if (action === 'showData') {
      handleShowData();
      return;
    }
    runUserMenuItem(action)();
  };

  const userMenuConfig = [
    {
      title: 'Updates',
      items: [
        { label: 'View Request History', onClick: handleRequestHistoryOpen, viewKey: 'userProfile', beforeOpen: () => setUserProfileInitialSection('history'), allowSameView: true, hint: pendingRequestCount > 0 ? `${pendingRequestCount} request pending or recently updated.` : 'See past approval and request activity.' },
      ],
    },
    {
      title: 'Work',
      items: [
        { label: 'Update Profile', onClick: handleProfileUpdate, viewKey: 'profileUpdate', disabled: !canAccessMenuFeature('profileUpdate'), reason: getDisabledReason('profileUpdate'), badge: getRequestBadge('profile'), hint: getRequestHint('profile', 'Update distributor profile details.') },
        { label: 'Update Bank Details', onClick: handleBankDetails, viewKey: 'bankUpdate', disabled: !canAccessMenuFeature('bankUpdate'), reason: getDisabledReason('bankUpdate'), badge: getRequestBadge('bank'), hint: getRequestHint('bank', 'Update bank details for records and billing.') },
        { label: 'Update Rates', onClick: handleRateUpdate, viewKey: 'rateUpdate', disabled: !canAccessMenuFeature('rateUpdate'), reason: getDisabledReason('rateUpdate'), badge: getRequestBadge('rates'), hint: getRequestHint('rates', 'Send revised rate data for approval.') },
        { label: 'Update Labels', onClick: handleLabelUpdate, viewKey: 'labelUpdate', disabled: !canAccessMenuFeature('labelUpdate'), reason: getDisabledReason('labelUpdate'), hint: isPlanExpired ? getDisabledReason('labelUpdate') : 'Adjust print layout labels for cashmemo output.' },
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
          reason: !hasHindiPackageAccess ? 'Available in Hindi package.' : getDisabledReason('deliveryAreaUpdate'),
          badge: getRequestBadge('deliveryArea'),
          hint: getRequestHint('deliveryArea', 'Update delivery area mappings for approval.'),
          show: hasHindiPackageAccess,
        },
        {
          label: 'Update Delivery Staff',
          onClick: handleDeliveryStaffUpdate,
          viewKey: 'deliveryStaffUpdate',
          disabled: !canAccessMenuFeature('deliveryStaffUpdate'),
          reason: !hasHindiPackageAccess ? 'Available in Hindi package.' : getDisabledReason('deliveryStaffUpdate'),
          badge: getRequestBadge('deliveryStaff'),
          hint: getRequestHint('deliveryStaff', 'Update delivery staff list for approval.'),
          show: hasHindiPackageAccess,
        },
        {
          label: 'Update Header',
          onClick: handleHeaderUpdate,
          viewKey: 'headerUpdate',
          disabled: !canAccessMenuFeature('headerUpdate'),
          reason: !hasHindiPackageAccess ? 'Available in Hindi package.' : getDisabledReason('headerUpdate'),
          badge: getRequestBadge('header'),
          hint: getRequestHint('header', 'Update Hindi header information for approval.'),
          show: hasHindiPackageAccess,
        },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'View Profile', onClick: handleUserProfile, viewKey: 'userProfile', allowSameView: true, hint: 'View account details, package info, and profile summary.' },
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
  const allWorkMenuItems = userMenuSections.find((section) => section.title === 'Work')?.items || [];
  const upgradePlanMenuItem = allWorkMenuItems.find((item) => item.viewKey === 'upgradePlan');
  const workMenuItems = allWorkMenuItems.filter((item) => item.viewKey !== 'upgradePlan');
  const allUpdateMenuItems = userMenuSections.find((section) => section.title === 'Updates')?.items || [];
  const updateMenuItems = allUpdateMenuItems.filter((item) => item.viewKey !== 'userProfile' || !item.beforeOpen);
  const profileMenuItem = userMenuSections
    .find((section) => section.title === 'Account')?.items
    .find((item) => item.viewKey === 'userProfile');
  const accountMenuSections = userMenuSections
    .filter((section) => !['Work', 'Updates'].includes(section.title))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.viewKey !== 'userProfile'),
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

  const isNotFoundPath = window.location.pathname !== '/';
  const handleNotFoundHome = () => {
    window.history.replaceState({}, '', '/');
    navigateToHome();
  };

  if (isNotFoundPath) {
    return <BrandedNotFound onHome={handleNotFoundHome} />;
  }

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
            <div className="navbar-main-menu" ref={mainMenuRef}>
              <button
                type="button"
                className={`navbar-brand-button ${showMainMenu ? 'active' : ''}`}
                onClick={() => setShowMainMenu((visible) => {
                  if (visible) setShowLogoUpdates(false);
                  return !visible;
                })}
                aria-label="Open main menu"
                aria-haspopup="menu"
                aria-expanded={showMainMenu}
              >
                <img src="/branding.png" alt="LPG CashMemo" />
              </button>
              {showMainMenu && (
                <div className="navbar-submenu" role="menu" aria-label="Main menu">
                  <button type="button" className="navbar-submenu-item" onClick={() => { handleHomeOpen(); setShowMainMenu(false); }} disabled={isPlanExpired} role="menuitem">🏠 Home</button>
                  {isLoggedIn && <button type="button" className="navbar-submenu-item" onClick={() => { handleCashmemoPrintGuideOpen(); setShowMainMenu(false); }} disabled={isPlanExpired} role="menuitem">🖨️ Cashmemo Print</button>}
                  {isLoggedIn && <button type="button" className="navbar-submenu-item" onClick={() => { handleAttendanceOpen(); setShowMainMenu(false); }} disabled={isPlanExpired} role="menuitem">👥 HR &amp; WORKFORCE</button>}
                  {isLoggedIn && <button type="button" className="navbar-submenu-item" onClick={() => { handleStockRegisterOpen(); setShowMainMenu(false); }} disabled={isPlanExpired} role="menuitem">📦 Inventory Reports</button>}
                  {isLoggedIn && <button type="button" className="navbar-submenu-item" onClick={() => { handleCashmemoLayoutOpen(); setShowMainMenu(false); }} disabled={!canAccessMenuFeature('labelUpdate')} role="menuitem">📋 Cashmemo Layout</button>}
                  {isLoggedIn && hasHindiPackageAccess && <button type="button" className="navbar-submenu-item" onClick={() => { handleDictionaryOpen(); setShowMainMenu(false); }} disabled={!canAccessMenuFeature('dictionaryUpdate')} role="menuitem">📖 Dictionary</button>}
                  {isLoggedIn && <button type="button" className="navbar-submenu-item" onClick={() => { handleInvoiceOpen(); setShowMainMenu(false); }} disabled={!canAccessMenuFeature('invoice')} role="menuitem">🧾 INVOICE WORKSPACE</button>}
                  <button type="button" className="navbar-submenu-item" onClick={() => { handleAboutOpen(); setShowMainMenu(false); }} role="menuitem">ℹ️ About Us</button>
                  {isLoggedIn && workMenuItems.length > 0 && (
                    <>
                      <div className="navbar-submenu-divider" />
                      <button type="button" className="navbar-submenu-heading navbar-submenu-heading--toggle" onClick={() => setShowLogoUpdates((visible) => !visible)} aria-expanded={showLogoUpdates}>
                        <span>Updates</span><span>{showLogoUpdates ? '−' : '+'}</span>
                      </button>
                      {showLogoUpdates && workMenuItems.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          className="navbar-submenu-item"
                          onClick={() => { runUserMenuItem(item)(); setShowMainMenu(false); }}
                          disabled={item.disabled}
                          title={item.reason || item.hint || ''}
                          role="menuitem"
                        >
                          {item.label}{item.badge ? ` (${item.badge.label})` : ''}
                        </button>
                      ))}
                    </>
                  )}
                  {isLoggedIn && updateMenuItems.length > 0 && (
                    <>
                      <div className="navbar-submenu-divider" />
                      <div className="navbar-submenu-heading">Updates</div>
                      {updateMenuItems.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          className="navbar-submenu-item"
                          onClick={() => { runUserMenuItem(item)(); setShowMainMenu(false); }}
                          disabled={item.disabled}
                          title={item.reason || item.hint || ''}
                          role="menuitem"
                        >
                          {item.label}{item.badge ? ` (${item.badge.label})` : ''}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
            {isLoggedIn && !isTestUser && showCashmemoPrintGuide && (
              <button type="button" onClick={handleReUploadClick} className="navbar-button" disabled={isPlanExpired}>
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
                {!isTestUser && (
                  <button type="button" onClick={handleReUploadClick} className="navbar-button">
                    Re-Upload
                  </button>
                )}
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
            <div className="user-menu-container" ref={userMenuRef} style={{ display: 'flex', alignItems: 'center' }}>
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
                    profileCompletenessChecks={profileCompletenessChecks}
                    profileCompletionPercent={profileCompletionPercent}
                    userRole={userRole}
                    userMenuPackageTips={userMenuPackageTips}
                    packageAccessBreakdown={packageAccessBreakdown}
                    renewalUrgencyLabel={renewalUrgencyLabel}
                    recentActivities={recentActivities}
                    userMenuEmptyGuidance={userMenuEmptyGuidance}
                    incompleteProfileAreas={incompleteProfileAreas}
                    incompleteProfileActionItems={incompleteProfileActionItems}
                    runUserMenuItem={runUserMenuItem}
                    getDisabledReason={getDisabledReason}
                    isPlanExpired={isPlanExpired}
                    pendingRequestCount={pendingRequestCount}
                    contactReplyCount={contactReplyCount}
                    updateInboxCount={updateInboxCount}
                    userNotificationItems={userNotificationItems}
                    primaryQuickAction={primaryQuickAction}
                    secondaryQuickAction={secondaryQuickAction}
                    recommendedAction={recommendedAction}
                    profileMenuItem={profileMenuItem}
                    upgradePlanMenuItem={upgradePlanMenuItem}
                    userMenuSections={accountMenuSections}
                    adminContacts={ADMIN_CONTACTS}
                    handleLogout={handleLogoutWithConfirm}
                    closeUserMenuAndRun={closeUserMenuAndRun}
                    firstUserMenuActionRef={firstUserMenuActionRef}
                    formatDisplayDate={formatDisplayDate}
                  />
                )}
              </div>
            ) : (
              <div className="navbar-auth-group">
                <button className="navbar-button navbar-button--ghost" onClick={handleLogin}>Login</button>
                <button className="navbar-button navbar-button--primary" onClick={handleRegister}>Register</button>
                <button className="navbar-button admin-nav-button" onClick={handleAdminLoginOpen}>
                  <span aria-hidden="true">&#128274;</span>
                  <span>Admin</span>
                </button>
              </div>
            )}
          </div>
        </nav>
      )}
      {isLoggedIn && visibleAnnouncements.length > 0 && (
        <div className="announcement-strip">
          {visibleAnnouncements.map((item) => (
            <div key={item.id} className={`announcement-strip__item announcement-strip__item--${item.noticeType || 'notice'}`}>
              <strong>{item.title}</strong>
              <span>{item.message}</span>
            </div>
          ))}
        </div>
      )}
      {isLoggedIn && isPlanExpired && !showUpgradePlan && !showAboutInfo && !showUserProfile && <ExpiredPlanGuide onUpgrade={handleUpgradePlanOpen} adminContacts={ADMIN_CONTACTS} />}
      {(showUpgradePlan || showUserProfile || showContactForm || showAboutInfo || (!isPlanExpired && (showProfileUpdate || showRateUpdate || showBankDetails || showRegisterForm || showDictionaryForm || showHomeInfo || showInvoicePage || showCashmemoLayout || showCashmemoPrintGuide || showAttendance || showIdCard || showEmployeeProfile || showSalarySlipPage || showAttendanceReportPage || showEmployeeReportPage || showStockRegister || showLabelUpdate || showHeaderUpdate || showAdminPanel || showAdminLogin || showUserLogin))) && (
        <div className="book-view">
          {showUpgradePlan && (
            <UpgradePlanForm
              onClose={navigateToHome}
              loggedInUser={loggedInUser}
              submitUpdateApprovalRequest={submitUpdateApprovalRequest}
              logRecentActivity={logRecentActivity}
              planUpgradeOptions={PLAN_UPGRADE_OPTIONS}
            />
          )}
          {showDictionaryForm && (
            <Suspense fallback={<div className="placeholder-container">Loading request form...</div>}>
              <LazyDictionaryRequestPanel
                loggedInUser={loggedInUser}
                pushToast={pushToast}
                getPendingDictionaryRequestCount={getPendingDictionaryRequestCount}
                deliveryAreaUpdates={deliveryAreaUpdates}
                deliveryStaffUpdates={deliveryStaffUpdates}
                submitUpdateApprovalRequest={submitUpdateApprovalRequest}
                updateUserInStore={updateUserInStore}
                mode={dictionaryFormMode}
                onClose={navigateToHome}
              />
            </Suspense>
          )}
          {showHomeInfo && (
            <Suspense fallback={<BrandedLoading label="Loading dashboard..." />}>
              <LazyHomeDashboard
                isLoggedIn={isLoggedIn}
                todayOrders={todayOrders}
                pendingEkycCount={pendingEkycCount}
                activePackageStatus={activePackageStatus}
                homeQuickActions={homeQuickActions}
                homeTodayFocus={homeTodayFocus}
                homeSupportPoints={homeSupportPoints}
                homeAccountDetails={homeAccountDetails}
                announcements={visibleAnnouncements}
                actionCenterCards={dashboardActionCenterCards}
                recentActivities={recentActivities.map((item) => ({
                  ...item,
                  createdAt: formatDisplayDateTime(item.createdAt),
                }))}
                onQuickAction={handleDashboardQuickAction}
                onLogin={handleLogin}
                onExplore={handleAboutOpen}
                onStockRegister={handleStockRegisterOpen}
                onAttendance={handleAttendanceOpen}
              />
            </Suspense>
          )}
          {showAboutInfo && <AboutInfo onLogin={handleLogin} isLoggedIn={isLoggedIn} isPlanExpired={isPlanExpired} onUpgrade={handleUpgradePlanOpen} adminContacts={ADMIN_CONTACTS} />}
          {showInvoicePage && (
            <Suspense fallback={<div className="placeholder-container">Loading invoice...</div>}>
              <LazyInvoicePage loggedInUser={loggedInUser} />
            </Suspense>
          )}
          {showCashmemoLayout && (
            <CashmemoLayoutPage
              pageSize={cashmemoLayoutPageSize}
              setPageSize={setCashmemoLayoutPageSize}
              pageType={cashmemoLayoutPageType}
              setPageType={setCashmemoLayoutPageType}
              language={cashmemoLayoutLanguage}
              setLanguage={setCashmemoLayoutLanguage}
              pageTypes={CASHMEMO_PAGE_TYPES}
              dealerDetails={buildDealerDetails(cashmemoLayoutLanguage === 'Hindi')}
              onPrint={handlePrintCashmemoLayout}
              onClose={navigateToHome}
            />
          )}
          {showCashmemoPrintGuide && <CashmemoPrintGuide onUpload={handleReUploadClick} canUpload={!isTestUser} />}
          {showAttendance && (
            <Suspense fallback={<div className="placeholder-container">Loading attendance...</div>}>
              <LazyAttendancePage loggedInUser={loggedInUser} onClose={navigateToHome} onEmployeeProfileOpen={handleEmployeeProfileOpen} onSalarySlipOpen={handleSalarySlipOpen} onAttendanceReportOpen={handleAttendanceReportOpen} onEmployeeReportOpen={handleEmployeeReportOpen} onIdCardOpen={handleIdCardOpen} onEmployeeAddOpen={handleEmployeeAddOpen} initialShowSettings={attendanceOpenSettings} />
            </Suspense>
          )}
          {(showIdCard || showEmployeeProfile || showSalarySlipPage || showAttendanceReportPage || showEmployeeReportPage) && (
            <div className="attendance-subpage-shell">
              <aside className="attendance-navigation attendance-subpage-navigation" aria-label="Attendance Centre menu"><div className="attendance-navigation__title"><span>HR Workspace</span><strong>Attendance Menu</strong></div><nav><button type="button" onClick={handleAttendanceOpen}><span>⌂</span>Attendance</button><button type="button" className={showEmployeeReportPage ? 'active' : ''} onClick={handleEmployeeReportOpen}><span>▤</span>Report</button><button type="button" className={showAttendanceReportPage ? 'active' : ''} onClick={handleAttendanceReportOpen}><span>▥</span>Attendance Report</button><button type="button" className={showSalarySlipPage ? 'active' : ''} onClick={handleSalarySlipOpen}><span>₹</span>Salary Slips</button><button type="button" className={showIdCard ? 'active' : ''} onClick={handleIdCardOpen}><span>▣</span>ID Cards</button><button type="button" className={showEmployeeProfile && !showEmployeeProfileCreate ? 'active' : ''} onClick={handleEmployeeProfileOpen}><span>●</span>Employee Profile</button><button type="button" onClick={handleAttendanceSettingsOpen}><span>⚙</span>Settings</button><button type="button" className={`attendance-navigation__add${showEmployeeProfileCreate ? ' active' : ''}`} onClick={handleEmployeeAddOpen}><span>＋</span>Add Employee</button><button type="button" className="attendance-navigation__close" onClick={navigateToHome}><span>←</span>Close</button></nav></aside>
              <div className="attendance-subpage-shell__content">
                {showIdCard && <Suspense fallback={<div className="placeholder-container">Loading ID cards...</div>}><LazyIdCardPage loggedInUser={loggedInUser} onClose={handleIdCardClose} /></Suspense>}
                {showEmployeeProfile && <Suspense fallback={<div className="placeholder-container">Loading employee profile...</div>}><LazyEmployeeProfilePage loggedInUser={loggedInUser} onClose={handleEmployeeProfileClose} createNew={showEmployeeProfileCreate} /></Suspense>}
                {showSalarySlipPage && <Suspense fallback={<div className="placeholder-container">Loading salary slips...</div>}><LazySalarySlipPage loggedInUser={loggedInUser} onClose={handleSalarySlipClose} initialEmployeeId={salarySlipEmployeeId} /></Suspense>}
                {showAttendanceReportPage && <Suspense fallback={<div className="placeholder-container">Loading attendance report...</div>}><LazyAttendanceReportPage loggedInUser={loggedInUser} onClose={handleAttendanceReportClose} /></Suspense>}
                {showEmployeeReportPage && <Suspense fallback={<div className="placeholder-container">Loading employee report...</div>}><LazyEmployeeReportPage loggedInUser={loggedInUser} onClose={handleEmployeeReportClose} onSalarySlipOpen={handleSalarySlipForEmployee} /></Suspense>}
              </div>
            </div>
          )}
          {showStockRegister && (
            <Suspense fallback={<div className="placeholder-container">Loading stock register...</div>}>
              <LazyStockRegisterPage loggedInUser={loggedInUser} onClose={navigateToHome} />
            </Suspense>
          )}
          {showLabelUpdate && (
            <LabelUpdatePage
              labelDraftSettings={labelDraftSettings}
              labelUpdatePageType={labelUpdatePageType}
              setLabelUpdatePageType={setLabelUpdatePageType}
              setAllCashMemoLabelsForPage={setAllCashMemoLabelsForPage}
              resetCashMemoLabelsForPage={resetCashMemoLabelsForPage}
              updateCashMemoLabelSetting={updateCashMemoLabelSetting}
              handleSaveCashMemoLabels={handleSaveCashMemoLabels}
              navigateToHome={navigateToHome}
              cashMemoLabelSettings={cashMemoLabelSettings}
              setLabelDraftSettings={setLabelDraftSettings}
            />
          )}
          {showHeaderUpdate && (
            <HeaderUpdateForm
              onClose={navigateToHome}
              loggedInUser={loggedInUser}
              submitUpdateApprovalRequest={submitUpdateApprovalRequest}
              logRecentActivity={logRecentActivity}
            />
          )}
          {showAdminPanel && <AdminPanel onAdminLogout={handleAdminLogout} {...{
            announcementDraft,
            announcementDraftFormKey,
            announcementDraftRef,
            announcements,
            confirmAdminActionWithDialog,
            createDictionaryApprovalRecords,
            deleteAnnouncement,
            handleCreateAnnouncement,
            openInputDialog,
            permanentlyDeleteBinItem,
            persistDictionaryRowsToFirebase,
            pushToast,
            readRecentActivitiesForDealer,
            restoreDeletedUser,
            setLoggedInUser,
            setTranslationDictionary,
            toggleAnnouncementStatus,
            translationDictionary,
            translationObservability,
            updateUserInStore,
          }} />}
          {showAdminLogin && (
            <Suspense fallback={<div className="placeholder-container">Loading admin login...</div>}>
              <LazyAdminLoginPanel
                adminLoginId={adminLoginId}
                setAdminLoginId={setAdminLoginId}
                adminPassword={adminPassword}
                setAdminPassword={setAdminPassword}
                isAdminLoginSubmitting={isAdminLoginSubmitting}
                handleAdminLoginSubmit={handleAdminLoginSubmit}
                navigateToHome={navigateToHome}
              />
            </Suspense>
          )}
          {showUserLogin && (
            <Suspense fallback={<BrandedLoading label="Loading login..." />}>
              <LazyUserLoginPanel
                userDealerCode={userDealerCode}
                setUserDealerCode={setUserDealerCode}
                userPinVisible={userPinVisible}
                setUserPinVisible={setUserPinVisible}
                userPin={userPin}
                setUserPin={setUserPin}
                deviceUserName={userDeviceUserName}
                setDeviceUserName={setUserDeviceUserName}
                isUserLoginSubmitting={isUserLoginSubmitting}
                handleUserLoginSubmit={handleUserLoginSubmit}
                navigateToHome={navigateToHome}
                onRegister={handleRegister}
              />
            </Suspense>
          )}
          {showProfileUpdate && (
            <Suspense fallback={<div className="placeholder-container">Loading profile update...</div>}>
              <LazyProfileUpdatePanel
                loggedInUser={loggedInUser}
                pushToast={pushToast}
                readImageFileAsDataUrl={readImageFileAsDataUrl}
                submitUpdateApprovalRequest={submitUpdateApprovalRequest}
                logRecentActivity={logRecentActivity}
                onClose={navigateToHome}
              />
            </Suspense>
          )}
          {showRateUpdate && (
            <Suspense fallback={<div className="placeholder-container">Loading rate update...</div>}>
              <LazyRateUpdatePage
                onClose={navigateToHome}
                initialRatesData={Array.isArray(loggedInUser?.ratesData) ? loggedInUser.ratesData : null}
                onSaveRates={handleSaveRatesForUser}
                updatedBy={loggedInUser?.dealerName || loggedInUser?.dealerCode || 'Dealer'}
                requestState={loggedInUser?.pendingUpdates?.rates || null}
              />
            </Suspense>
          )}
          {showBankDetails && (
            <Suspense fallback={<div className="placeholder-container">Loading bank details...</div>}>
              <LazyBankDetailsPanel
                loggedInUser={loggedInUser}
                submitUpdateApprovalRequest={submitUpdateApprovalRequest}
                logRecentActivity={logRecentActivity}
                onClose={navigateToHome}
              />
            </Suspense>
          )}
          {showRegisterForm && (
            <Suspense fallback={<div className="placeholder-container">Loading registration...</div>}>
              <LazyRegisterPanel
                packageOptions={PACKAGE_OPTIONS}
                packagePricing={PACKAGE_PRICING}
                paymentUpiId={PAYMENT_UPI_ID}
                pushToast={pushToast}
                logRecentActivity={logRecentActivity}
                onClose={navigateToHome}
                onLogin={handleLogin}
              />
            </Suspense>
          )}
          {showUserProfile && (
            <Suspense fallback={<div className="placeholder-container">Loading profile...</div>}>
              <LazyUserProfilePanel
                loggedInUser={loggedInUser}
                formatDisplayDate={formatDisplayDate}
                initialSection={userProfileInitialSection}
                onClose={navigateToHome}
              />
            </Suspense>
          )}
          {showContactForm && (
            <Suspense fallback={<div className="placeholder-container">Loading support...</div>}>
              <LazyContactSupportPanel
                loggedInUser={loggedInUser}
                pushToast={pushToast}
                updateUserInFirebase={updateUserInFirebase}
                updateUserInStore={updateUserInStore}
                formatDisplayDateTime={formatDisplayDateTime}
                onClose={navigateToHome}
              />
            </Suspense>
          )}
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

        .user-icon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: linear-gradient(135deg, #007bff, #0056b3);
          color: white;
          border: 2px solid #fff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          cursor: pointer;
          position: relative;
          transition: transform 0.2s ease;
        }
        .user-icon:hover {
          transform: scale(1.05);
        }
        .user-icon__photo {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }
        .user-icon__avatar {
          font-weight: 700;
          font-size: 16px;
          letter-spacing: 0.5px;
          line-height: 1;
        }
      `}</style>


      {!isPlanExpired && parsedData.length > 0 && showParsedData && (
        <Suspense fallback={<div className="filters-shell"><div className="data-empty-state">Loading data workspace...</div></div>}>
          <LazyDataWorkspace
            showBookingReport={showBookingReport}
            filteredData={filteredData}
            activeReportFilter={activeReportFilter}
            reportViewMode={reportViewMode}
            setReportViewMode={setReportViewMode}
            setActiveReportFilter={setActiveReportFilter}
            setShowBookingReport={setShowBookingReport}
            reportSummaryCards={reportSummaryCards}
            reportCards={reportCards}
            exceptionQueueCards={exceptionQueueCards}
            reportRecordCount={reportSourceData.length}
            uploadInProgress={uploadInProgress}
            selectedCustomerIds={selectedCustomerIds}
            hasActiveDataFilters={hasActiveDataFilters}
            parsedData={parsedData}
            uploadMetadata={uploadMetadata}
            formatDisplayDateTime={formatDisplayDateTime}
            activeFilterChips={activeFilterChips}
            handleResetAllFilters={handleResetAllFilters}
            handleSaveCurrentPreset={handleSaveCurrentPreset}
            showAdvancedFilters={showAdvancedFilters}
            setShowAdvancedFilters={setShowAdvancedFilters}
            savedFilterPresets={savedFilterPresets}
            applyFilterPreset={applyFilterPreset}
            handleDeletePreset={handleDeletePreset}
            selectedFilteredRows={selectedFilteredRows}
            handlePrintCashmemo={handlePrintCashmemo}
            exportSelectedBusinessRows={exportSelectedBusinessRows}
            exportRowsToCsvFile={exportRowsToCsvFile}
            buildExportFilename={buildExportFilename}
            visibleHeaders={visibleHeaders}
            setVisibleHeaders={setVisibleHeaders}
            clearSelection={clearSelection}
            pushToast={pushToast}
            recentActivities={recentActivities}
            reportFilterOptions={reportFilterOptions}
            eKycFilter={eKycFilter}
            setEKycFilter={setEKycFilter}
            availableEkycOptions={availableEkycOptions}
            areaFilter={areaFilter}
            setAreaFilter={setAreaFilter}
            availableAreaOptions={availableAreaOptions}
            onlineRefillPaymentStatusFilter={onlineRefillPaymentStatusFilter}
            setOnlineRefillPaymentStatusFilter={setOnlineRefillPaymentStatusFilter}
            availableOnlinePaymentOptions={availableOnlinePaymentOptions}
            orderTypeFilter={orderTypeFilter}
            setOrderTypeFilter={setOrderTypeFilter}
            availableOrderTypeOptions={availableOrderTypeOptions}
            orderDateStart={orderDateStart}
            setOrderDateStart={setOrderDateStart}
            orderDateEnd={orderDateEnd}
            setOrderDateEnd={setOrderDateEnd}
            natureFilter={natureFilter}
            setNatureFilter={setNatureFilter}
            availableNatureOptions={availableNatureOptions}
            mobileStatusFilter={mobileStatusFilter}
            setMobileStatusFilter={setMobileStatusFilter}
            availableMobileStatusOptions={availableMobileStatusOptions}
            consumerStatusFilter={consumerStatusFilter}
            setConsumerStatusFilter={setConsumerStatusFilter}
            availableConsumerStatusOptions={availableConsumerStatusOptions}
            connectionTypeFilter={connectionTypeFilter}
            setConnectionTypeFilter={setConnectionTypeFilter}
            availableConnectionTypeOptions={availableConnectionTypeOptions}
            orderStatusFilter={orderStatusFilter}
            setOrderStatusFilter={setOrderStatusFilter}
            availableOrderStatusOptions={availableOrderStatusOptions}
            orderSourceFilter={orderSourceFilter}
            setOrderSourceFilter={setOrderSourceFilter}
            availableOrderSourceOptions={availableOrderSourceOptions}
            cashMemoStatusFilter={cashMemoStatusFilter}
            setCashMemoStatusFilter={setCashMemoStatusFilter}
            availableCashMemoStatusOptions={availableCashMemoStatusOptions}
            deliveryManFilter={deliveryManFilter}
            setDeliveryManFilter={setDeliveryManFilter}
            availableDeliveryManOptions={availableDeliveryManOptions}
            isRegMobileFilter={isRegMobileFilter}
            setIsRegMobileFilter={setIsRegMobileFilter}
            availableIsRegMobileOptions={availableIsRegMobileOptions}
            cashMemoDateStart={cashMemoDateStart}
            setCashMemoDateStart={setCashMemoDateStart}
            cashMemoDateEnd={cashMemoDateEnd}
            setCashMemoDateEnd={setCashMemoDateEnd}
            sortBy={sortBy}
            setSortBy={setSortBy}
            headers={headers}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            handleSearchChange={handleSearchChange}
            addColumn={addColumn}
            removeColumn={removeColumn}
            pageType={pageType}
            setPageType={setPageType}
            isHindiEnterprisePackage={isHindiEnterprisePackage}
            loggedInUser={loggedInUser}
            printHeaderMode={printHeaderMode}
            setPrintHeaderMode={setPrintHeaderMode}
            printLanguage={printLanguage}
            setPrintLanguage={setPrintLanguage}
            handlePrintData={handlePrintData}
            exportFilteredRows={exportFilteredRows}
            shouldShowFilteredEmptyState={shouldShowFilteredEmptyState}
            handleReUploadClick={handleReUploadClick}
            canUpload={!isTestUser}
            openOnboardingTour={openOnboardingTour}
            compactWorkspaceMode={compactWorkspaceMode}
            onToggleCompactWorkspaceMode={handleToggleCompactWorkspaceMode}
            currentTableData={currentTableData}
            handleSelectAllChange={handleSelectAllChange}
            isAllFilteredRowsSelected={isAllFilteredRowsSelected}
            handleCheckboxChange={handleCheckboxChange}
            formatDateToDDMMYYYY={formatDateToDDMMYYYY}
            excelSerialDateToJSDate={excelSerialDateToJSDate}
            parseDateString={parseDateString}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            setItemsPerPage={setItemsPerPage}
          />
        </Suspense>
      )}
      {!isTestUser && !isPlanExpired && shouldShowEmptyUploadState && (
        <div className="filters-shell">
          <div className="data-empty-state data-empty-state--upload">
            <p className="data-empty-state__eyebrow">Start Here</p>
            <h3>Abhi koi working data loaded nahi hai.</h3>
            <p>
              Aaj ka `Pending Booking` CSV ya XLSX upload karte hi filters, cashmemo print,
              reports, aur quick profile actions start ho jayenge.
            </p>
            <p>Agar pehli baar use kar rahe ho to quick tour dekh lo. Format ya process me doubt ho to Support & Replies use kijiye.</p>
            <div className="data-empty-state__actions">
              <button type="button" className="table-action table-action--blue" onClick={handleReUploadClick}>
                Upload Today's File
              </button>
            </div>
            <div className="data-empty-state__suggestions">
              {emptyUploadSuggestions.map((item) => (
                <button key={item.key} type="button" className="data-empty-state__shortcut" onClick={item.onClick}>
                  {item.label}
                </button>
              ))}
            </div>
            <p className="data-empty-state__helper">
              Current access: {formatPackageNameForNavbar(loggedInUser?.package)}.
            </p>
          </div>
        </div>
      )}



      <CashmemoPrintPreview
        customersToPrint={customersToPrint}
        cashMemoRef={cashMemoRef}
        pageType={pageType}
        getCashMemoPerPage={getCashMemoPerPage}
        renderCashMemo={(customer) => <CashMemoEnglish customerData={customer} />}
      />

      <ConfirmDialog
        dialog={confirmDialog}
        onClose={closeConfirmDialog}
        onConfirm={handleConfirmDialogSubmit}
      />

      <InputDialog
        dialog={inputDialog}
        setDialog={setInputDialog}
        onClose={closeInputDialog}
        onSubmit={handleInputDialogSubmit}
      />

      <OnboardingTourDialog
        isOpen={showOnboardingTour}
        onClose={closeOnboardingTour}
        activeOnboardingStep={activeOnboardingStep}
        onboardingSteps={onboardingSteps}
        onboardingStepIndex={onboardingStepIndex}
        setOnboardingStepIndex={setOnboardingStepIndex}
        handleOnboardingAction={handleOnboardingAction}
        handleOnboardingBack={handleOnboardingBack}
        handleOnboardingNext={handleOnboardingNext}
      />

      <AdminFlashMessage
        message={adminFlashMessage}
        onClose={() => setAdminFlashMessage(null)}
      />

      <footer className="app-footer">
        <span>Designed by Deepak Singh </span>
        <a href="mailto:deepak.youvi@gmail.com">💌deepak.youvi@gmail.com</a>
      </footer>
    </>
  );
}

export default App;
